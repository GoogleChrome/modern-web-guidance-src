import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parseHTML } from 'linkedom';
import { Project, SyntaxKind } from 'ts-morph';
import {
  parse,
  getRules,
  closestRule,
  resolveSelector,
  parseSelectorAST,
  getDeclaredProperties,
  getPropertyValues,
  getCascadedStyle,
  CSSMediaRule,
  CSSViewTransitionRule,
  CSSStyleRule,
  CSSSupportsRule,
  CSSContainerRule,
  CSSPositionTryRule,
} from 'cssomnom';

describe('Parser Pattern Library (Best Practices)', () => {
  
  test('Pattern 1: Static DOM Analysis with Linkedom', () => {
    const html = `
      <form>
        <label for="email">Email</label>
        <input id="email" type="email" required>
      </form>
    `;
    
    const { document } = parseHTML(html);
    
    // GOOD: Use standard DOM APIs
    const input = document.querySelector('input[type="email"]');
    assert.ok(input);
    assert.strictEqual(input.getAttribute('required'), '');
    
    const label = document.querySelector('label[for="email"]');
    assert.ok(label);
    assert.strictEqual(label.textContent, 'Email');
  });

  test('Pattern 2: Static CSS & Utility Analysis (cssomnom + Linkedom)', () => {
    const css = `
      @media (prefers-reduced-motion: no-preference) {
        @view-transition {
          navigation: auto;
        }
      }

      @supports (anchor-name: --my-anchor) {
        .tooltip {
          position-anchor: --my-anchor;
          inset-area: block-end;
        }
      }

      @position-try --below {
        inset-area: block-end;
      }

      @container (min-width: 400px) {
        .card {
          grid-template-rows: auto;
          grid-template-rows: subgrid;
          width: 300px;
          display: flex;
          color: blue;
          & > .title {
            color: darkblue;
          }
        }
      }

      .card {
        view-transition-name: card-item;
        contain: layout;
        display: block;
      }
    `;
    
    const stylesheet = parse(css);

    // 1. Recursive rule collection via getRules() across all grouping rules and @at-rules
    const mediaRules = getRules(stylesheet, CSSMediaRule);
    const mediaRule = mediaRules.find(r => r.conditionText.includes('no-preference'));
    assert.ok(mediaRule, 'Should find media rule with prefers-reduced-motion: no-preference');
    
    const viewTransitionRules = getRules(stylesheet, CSSViewTransitionRule);
    assert.strictEqual(viewTransitionRules.length, 1);
    assert.strictEqual(viewTransitionRules[0].navigation, 'auto');
    // Nearest enclosing rule traversal via closestRule()
    const enclosingMedia = closestRule(viewTransitionRules[0], CSSMediaRule);
    assert.strictEqual(enclosingMedia, mediaRule);

    // 2. Verify @supports rule and nested declarations
    const supportsRules = getRules(stylesheet, CSSSupportsRule);
    const supportsRule = supportsRules.find(r => r.conditionText.includes('anchor-name'));
    assert.ok(supportsRule, 'Should find @supports rule for anchor-name');
    const styleRules = getRules(stylesheet, CSSStyleRule);
    const tooltipRule = styleRules.find(r => r.selectorText === '.tooltip');
    assert.ok(tooltipRule, 'Should find .tooltip rule inside @supports');
    assert.strictEqual(tooltipRule.style.getPropertyValue('position-anchor'), '--my-anchor');

    // 3. Verify @container rule
    const containerRules = getRules(stylesheet, CSSContainerRule);
    const containerRule = containerRules.find(r => r.conditionText.includes('min-width: 400px'));
    assert.ok(containerRule, 'Should find @container rule');

    // 4. Verify style rules, nested selector resolution, and AST inspection
    const cardRule = styleRules.find(r => r.selectorText === '.card');
    assert.ok(cardRule, 'Should find .card style rule');
    const titleRule = styleRules.find(r => r.selectorText === '& > .title');
    assert.ok(titleRule, 'Should find nested & > .title style rule');
    assert.strictEqual(resolveSelector(titleRule), ':is(.card) > .title');
    const titleAst = parseSelectorAST(titleRule);
    assert.strictEqual(titleAst?.type, 'selector-list');

    // 5. Multiple property values (progressive enhancement fallback) and logical/physical mapping
    const rowValues = getPropertyValues(cardRule, 'grid-template-rows');
    assert.deepStrictEqual(rowValues, ['auto', 'subgrid']);
    const inlineSizeValues = getPropertyValues(cardRule, 'inline-size');
    assert.deepStrictEqual(inlineSizeValues, ['300px']);

    // 6. Inspecting declared properties across the entire stylesheet
    const declaredProps = getDeclaredProperties(stylesheet);
    assert.ok(declaredProps.has('grid-template-rows'));
    assert.ok(declaredProps.has('view-transition-name'));

    // 7. Verify @position-try rules via CSSPositionTryRule
    const tryRules = getRules(stylesheet, CSSPositionTryRule);
    assert.strictEqual(tryRules.length, 1);
    assert.strictEqual(tryRules[0].name, '--below');

    // 8. Utility CSS flexibility: Accept either standard CSS declarations or template utility classes
    const { document } = parseHTML('<div class="@container card @md:flex-row">Item</div>');
    const hasContainer = styleRules.some(r => /\b(inline-size|size)\b/.test(r.style.getPropertyValue('container-type')))
      || Boolean(document.querySelector('[class*="@container"]'));
    assert.strictEqual(hasContainer, true);
  });

  test('Pattern 3: Static Cascade & Selector Resolution (cssomnom + Linkedom)', () => {
    const html = `
      <div class="card highlight">Item</div>
    `;
    const css = `
      .card { color: red; display: block; }
      .card.highlight { color: blue; }
      @media (prefers-color-scheme: dark) {
        .card.highlight { color: white; }
      }
    `;

    const { document } = parseHTML(html);
    const cardEl = document.querySelector('.card');
    assert.ok(cardEl);

    const stylesheet = parse(css);

    // getCascadedStyle computes the winning cascade declaration directly from stylesheet
    const defaultCascaded = getCascadedStyle(cardEl, stylesheet);
    assert.strictEqual(defaultCascaded.getPropertyValue('color'), 'rgb(0, 0, 255)');
    assert.strictEqual(defaultCascaded.getPropertyValue('display'), 'block');

    // getCascadedStyle also supports media environments (e.g. prefersColorScheme, forcedColors)
    const darkCascaded = getCascadedStyle(cardEl, stylesheet, undefined, { prefersColorScheme: 'dark' });
    assert.strictEqual(darkCascaded.getPropertyValue('color'), 'rgb(255, 255, 255)');
  });

  test('Pattern 4: Handling Advanced Selectors with Linkedom (:has)', () => {
    const html = `
      <div class="container">
        <p class="child">Hello</p>
      </div>
      <div class="container">
        <span>No child p</span>
      </div>
    `;
    
    const { document } = parseHTML(html);
    
    // Linkedom supports :has()!
    const matched = document.querySelectorAll('.container:has(p)');
    assert.strictEqual(matched.length, 1);
  });

  test('Pattern 5: Static JS Analysis with ts-morph', () => {
    const html = `
      <script>
        function handleInteraction() {
          console.log('interacted');
        }
      </script>
    `;
    
    const { document } = parseHTML(html);
    const js = document.querySelector('script')?.textContent || '';
    const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile('test.js', js);
    
    // Find all function declarations
    const functionDecls = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
    assert.strictEqual(functionDecls.length, 1);
    assert.strictEqual(functionDecls[0].getName(), 'handleInteraction');
  });

  test('Pattern 6: Advanced JS Analysis with ts-morph (Feature Detection)', () => {
    const html = `
      <script>
        if ('onbeforematch' in HTMLElement.prototype) {
          // feature supported
        } else {
          // fallback
        }
      </script>
    `;
    
    const { document } = parseHTML(html);
    const js = document.querySelector('script')?.textContent || '';
    const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile('test.js', js);
    
    // Find binary expressions (like 'onbeforematch' in HTMLElement.prototype)
    const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    
    let hasFeatureDetection = false;
    binaryExpressions.forEach(expr => {
      const left = expr.getLeft().getText();
      const operator = expr.getOperatorToken().getText();
      const right = expr.getRight().getText();
      
      if (left === "'onbeforematch'" && operator === 'in' && right === 'HTMLElement.prototype') {
        hasFeatureDetection = true;
      }
    });
    
    assert.strictEqual(hasFeatureDetection, true);
  });
});
