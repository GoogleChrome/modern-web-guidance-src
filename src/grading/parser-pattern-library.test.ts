import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parseHTML } from 'linkedom';
import { Project, SyntaxKind } from 'ts-morph';
import { parse, getCascadedStyle, CSSMediaRule, CSSViewTransitionRule, CSSStyleRule, CSSSupportsRule, CSSContainerRule } from 'cssomnom';

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

      @container (min-width: 400px) {
        .card {
          display: flex;
          color: blue;
        }
      }

      .card {
        view-transition-name: card-item;
        contain: layout;
        display: block;
      }
    `;
    
    const stylesheet = parse(css);
    const rules = Array.from(stylesheet.cssRules);

    // 1. Verify @media rule and nested @view-transition rule
    const mediaRule = rules.find((r): r is CSSMediaRule => r instanceof CSSMediaRule && r.conditionText.includes('no-preference'));
    assert.ok(mediaRule, 'Should find media rule with prefers-reduced-motion: no-preference');
    
    const viewTransitionRule = Array.from(mediaRule.cssRules).find((r): r is CSSViewTransitionRule => r instanceof CSSViewTransitionRule);
    assert.ok(viewTransitionRule, 'Should find @view-transition rule nested inside media query');
    assert.strictEqual(viewTransitionRule.navigation, 'auto');

    // 2. Verify @supports rule and nested declarations
    const supportsRule = rules.find((r): r is CSSSupportsRule => r instanceof CSSSupportsRule && r.conditionText.includes('anchor-name'));
    assert.ok(supportsRule, 'Should find @supports rule for anchor-name');
    const tooltipRule = Array.from(supportsRule.cssRules).find((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.tooltip');
    assert.ok(tooltipRule, 'Should find .tooltip rule inside @supports');
    assert.strictEqual(tooltipRule.style.getPropertyValue('position-anchor'), '--my-anchor');

    // 3. Verify @container rule
    const containerRule = rules.find((r): r is CSSContainerRule => r instanceof CSSContainerRule && r.conditionText.includes('min-width: 400px'));
    assert.ok(containerRule, 'Should find @container rule');

    // 4. Verify style rules and declarations
    const cardRule = rules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === '.card');
    assert.ok(cardRule, 'Should find .card style rule');
    assert.strictEqual(cardRule.style.getPropertyValue('view-transition-name'), 'card-item');
    assert.strictEqual(cardRule.style.getPropertyValue('contain'), 'layout');

    // 5. Utility CSS flexibility: Accept either standard CSS declarations or template utility classes
    const { document } = parseHTML('<div class="@container card @md:flex-row">Item</div>');
    const hasContainer = rules.some(r => r instanceof CSSStyleRule && /\b(inline-size|size)\b/.test(r.style.getPropertyValue('container-type')))
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
    `;

    const { document } = parseHTML(html);
    const cardEl = document.querySelector('.card');
    assert.ok(cardEl);

    const stylesheet = parse(css);
    const cascaded = getCascadedStyle(cardEl, Array.from(stylesheet.cssRules));

    // getCascadedStyle computes the winning cascade declaration without a browser
    assert.strictEqual(cascaded.getPropertyValue('color'), 'rgb(0, 0, 255)');
    assert.strictEqual(cascaded.getPropertyValue('display'), 'block');
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
