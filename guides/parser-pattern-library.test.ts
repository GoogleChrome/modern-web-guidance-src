import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parseHTML } from 'linkedom';
import { Parser, CSSStyleRule, CSSUnknownRule, serialize } from '../lib/third_party/cssom/index.js';

import { Project, SyntaxKind } from 'ts-morph';


describe('Parser Pattern Library (Best Practices)', () => {
  
  test('Pattern 1: Static DOM Analysis with Linkedom (Avoid Regex on HTML)', () => {
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

  test('Pattern 2: Static CSS Analysis with CSSOM (Avoid Regex on CSS)', () => {
    const css = `
      .target {
        appearance: base-select;
        color: red;
      }
    `;
    
    const rules = Parser.parseStyleSheetText(css);
    assert.strictEqual(rules.length, 1);
    
    const rule = rules[0];
    assert.ok(rule instanceof CSSStyleRule);
    assert.strictEqual(rule.selectorText, '.target');
    
    // GOOD: Use getPropertyValue instead of regex
    assert.strictEqual(rule.style.getPropertyValue('appearance'), 'base-select');
    assert.strictEqual(rule.style.getPropertyValue('color'), 'red');
  });

  test('Pattern 3: Selector Matching with Linkedom + CSSOM', () => {
    const html = `<div class="target">Hello</div>`;
    const css = `.target { color: red; }`;
    
    const { document } = parseHTML(html);
    const rules = Parser.parseStyleSheetText(css);
    
    const target = document.querySelector('.target');
    assert.ok(target);
    
    let matchedRule: CSSStyleRule | null = null;
    rules.forEach(rule => {
      if (rule instanceof CSSStyleRule) {
        const matches = document.querySelectorAll(rule.selectorText);
        for (let i = 0; i < matches.length; i++) {
          if (matches[i] === target) {
            matchedRule = rule;
            break;
          }
        }
      }
    });
    
    assert.ok(matchedRule);
    assert.strictEqual((matchedRule as unknown as CSSStyleRule).style.getPropertyValue('color'), 'red');
  });


  test('Pattern 4: Handling Advanced Selectors supported by Linkedom (:has)', () => {
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

  test('Pattern 5: Static JS Analysis with ts-morph (Avoid Regex on JS)', () => {
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
