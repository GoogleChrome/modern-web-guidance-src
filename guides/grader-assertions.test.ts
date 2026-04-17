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

  test.skip('Case 4: Full Computed Style Resolution (Perfect World)', () => {
    const html = `<div id="hero" class="target">Hello</div>`;
    const css = `
      .target { color: red; }
      #hero { color: blue; }
    `;
    
    const { document } = parseHTML(html);
    const rules = Parser.parseStyleSheetText(css);
    
    const target = document.querySelector('#hero');
    
    // In a perfect world, we have a getComputedStyle-like function
    const computedStyle = getComputedStyleStatically(target, rules);
    assert.strictEqual(computedStyle.getPropertyValue('color'), 'blue');
  });

  test.skip('Case 5: Advanced Selector Matching (:has) (Perfect World)', () => {
    const html = `
      <div class="container">
        <p class="child">Hello</p>
      </div>
      <div class="container">
        <span>No child p</span>
      </div>
    `;
    const css = `.container:has(p) { background: yellow; }`;
    
    const { document } = parseHTML(html);
    const rules = Parser.parseStyleSheetText(css);
    
    const containers = document.querySelectorAll('.container');
    
    // In a perfect world, querySelectorAll supports :has()
    const matched = document.querySelectorAll('.container:has(p)');
    assert.strictEqual(matched.length, 1);
    assert.strictEqual(matched[0], containers[0]);
  });

  test.skip('Case 6: Anchor Positioning Resolution (Perfect World)', () => {
    const html = `
      <div id="anchor">Anchor</div>
      <div id="tooltip">Tooltip</div>
    `;
    const css = `
      #anchor { anchor-name: --my-anchor; }
      #tooltip {
        position: absolute;
        position-anchor: --my-anchor;
        top: anchor(bottom);
      }
    `;
    
    const { document } = parseHTML(html);
    const rules = Parser.parseStyleSheetText(css);
    
    const tooltip = document.querySelector('#tooltip');
    
    // In a perfect world, we can resolve anchor positioning
    const computedStyle = getComputedStyleStatically(tooltip, rules);
    assert.strictEqual(computedStyle.getPropertyValue('top'), '<resolved pixel value>');
  });
});

