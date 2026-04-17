import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parseHTML } from 'linkedom';
import { Parser, CSSStyleRule } from '/usr/local/google/home/paulirish/code/cssom/src/index.ts';


describe('Grader Assertions - CSSOM + DOM Integration', () => {
  
  test('Case 1: Simple Selector Matching with linkedom', () => {
    const html = `<div class="target">Hello</div>`;
    const css = `.target { color: red; }`;
    
    const { document } = parseHTML(html);
    const rules = Parser.parseStyleSheetText(css);
    
    const target = document.querySelector('.target');
    assert.ok(target);
    
    let matched = false;
    rules.forEach(rule => {
      if (rule instanceof CSSStyleRule) {
        const matches = document.querySelectorAll(rule.selectorText);
        for (let i = 0; i < matches.length; i++) {
          if (matches[i] === target) {
            matched = true;
            break;
          }
        }
      }
    });
    
    assert.strictEqual(matched, true);
  });

  test('Case 2: Specificity Sorting (Conceptual)', () => {
    const html = `<div id="hero" class="target">Hello</div>`;
    const css = `
      .target { color: red; }
      #hero { color: blue; }
    `;
    
    const { document } = parseHTML(html);
    const rules = Parser.parseStyleSheetText(css);
    
    const target = document.querySelector('#hero');
    
    // Find all matching rules
    const matchingRules: CSSStyleRule[] = [];
    rules.forEach(rule => {
      if (rule instanceof CSSStyleRule) {
        const elements = document.querySelectorAll(rule.selectorText);
        for (let i = 0; i < elements.length; i++) {
          if (elements[i] === target) {
            matchingRules.push(rule);
            break;
          }
        }
      }
    });
    
    assert.strictEqual(matchingRules.length, 2);
    
    // TODO: Implement specificity calculation and sorting
    // For now we just assert they both matched.
    assert.strictEqual(matchingRules[0].selectorText, '.target');
    assert.strictEqual(matchingRules[1].selectorText, '#hero');
  });

  test('Case 3: Cascade Resolution (Conceptual)', () => {
    const html = `<div class="target" style="color: green;">Hello</div>`;
    const css = `.target { color: red; }`;
    
    const { document } = parseHTML(html);
    const rules = Parser.parseStyleSheetText(css);
    
    const target = document.querySelector('.target') as any;
    
    // Inline styles win over author styles (usually, unless !important)
    const inlineStyle = target.style.getPropertyValue('color');
    assert.strictEqual(inlineStyle, 'green');
    
    // TODO: Merge with author styles from matching rules
  });
});
