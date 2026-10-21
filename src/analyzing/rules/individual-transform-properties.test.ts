import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import {
  individualTransformPropertiesMatcher,
  individualTransformPropertiesRule,
  individualTransformPropertiesSingleFunctionStateMatcher,
  individualTransformPropertiesSingleFunctionStateRule,
  individualTransformPropertiesStandaloneChainMatcher,
  individualTransformPropertiesStandaloneChainRule,
} from './individual-transform-properties.ts';

const rules: readonly CssRuleMatcher[] = [individualTransformPropertiesMatcher];
const standaloneChainRules: readonly CssRuleMatcher[] = [
  individualTransformPropertiesStandaloneChainMatcher,
];
const singleFunctionStateRules: readonly CssRuleMatcher[] = [
  individualTransformPropertiesSingleFunctionStateMatcher,
];

describe('individualTransformPropertiesRule', () => {
  it('has valid rule metadata and non-empty phase2Rubric', () => {
    assert.equal(individualTransformPropertiesRule.id, 'individual-transform-properties');
    assert.equal(individualTransformPropertiesRule.guideId, 'individual-transform-properties');
    assert.ok(individualTransformPropertiesRule.phase2Rubric.keepWhen.length > 0);
    assert.ok(individualTransformPropertiesRule.phase2Rubric.dropWhen.length > 0);

    assert.equal(
      individualTransformPropertiesStandaloneChainRule.id,
      'individual-transform-properties/standalone-chain',
    );
    assert.equal(
      individualTransformPropertiesSingleFunctionStateRule.id,
      'individual-transform-properties/single-function-state',
    );
  });

  it('ignores standalone multi-function transform in default rule (Pattern C), flagged by opt-in standalone rule', () => {
    const css = `
      .icon {
        transform: translate(10px, 20px) rotate(45deg) scale(0.9);
      }
    `;
    const defaultMatches = scanCss('src/icon.css', css, rules);
    assert.equal(defaultMatches.length, 0);

    const optInMatches = scanCss('src/icon.css', css, standaloneChainRules);
    assert.equal(optInMatches.length, 1);
    assert.equal(optInMatches[0]?.line, 2);
  });

  it('ignores isolated :hover multi-function transform in default rule (Pattern C), flagged by opt-in standalone rule', () => {
    const css = `
      .card:hover {
        transform: translateY(-4px) scale(1.02);
      }
    `;
    const defaultMatches = scanCss('src/card.css', css, rules);
    assert.equal(defaultMatches.length, 0);

    const optInMatches = scanCss('src/card.css', css, standaloneChainRules);
    assert.equal(optInMatches.length, 1);
    assert.equal(optInMatches[0]?.line, 2);
  });

  it('ignores isolated :hover single-function transform in default rule (Pattern D), flagged by opt-in state rule', () => {
    const css = `
      .btn:hover {
        transform: scale(1.05);
      }
    `;
    const defaultMatches = scanCss('src/btn.css', css, rules);
    assert.equal(defaultMatches.length, 0);

    const optInMatches = scanCss('src/btn.css', css, singleFunctionStateRules);
    assert.equal(optInMatches.length, 1);
    assert.equal(optInMatches[0]?.line, 2);
  });

  it('ignores transform with unsupported skew function', () => {
    const css = `
      .tilted {
        transform: translateX(10px) skewX(12deg);
      }
    `;
    const matches = scanCss('src/tilted.css', css, rules);
    assert.equal(matches.length, 0);
  });

  it('ignores transform with matrix3d or perspective', () => {
    const css = `
      .complex {
        transform: perspective(500px) translateZ(20px) rotateY(15deg);
      }
    `;
    const matches = scanCss('src/complex.css', css, rules);
    assert.equal(matches.length, 0);
  });

  it('ignores transform containing var()', () => {
    const css = `
      .dynamic {
        transform: translateX(var(--offset)) scale(1.1);
      }
    `;
    const matches = scanCss('src/dynamic.css', css, rules);
    assert.equal(matches.length, 0);
  });

  it('ignores out-of-order transform where rotate or scale precedes translate', () => {
    const css = `
      .orbit {
        transform: rotate(0deg) translateX(50%);
      }
      .zoomed {
        transform: scale(2) translateX(10px);
      }
      .tilted-scale {
        transform: scale(1.2) rotate(15deg);
      }
    `;
    const matches = scanCss('src/orbit.css', css, rules);
    assert.equal(matches.length, 0);
  });

  it('ignores multi-axis rotate functions that cannot map to a single rotate property', () => {
    const css = `
      .cube {
        transform: translateX(10px) rotateX(15deg) rotateY(30deg);
      }
    `;
    const matches = scanCss('src/cube.css', css, rules);
    assert.equal(matches.length, 0);
  });

  it('exempts stylesheets already using scale property', () => {
    const css = `
      .badge {
        scale: 1;
      }
      .badge:hover {
        transform: translateY(-2px) scale(1.1);
      }
    `;
    const matches = scanCss('src/badge.css', css, rules);
    assert.equal(matches.length, 0);
  });

  it('exempts stylesheets already using translate property', () => {
    const css = `
      .drawer {
        translate: -100% 0;
      }
      .drawer.open {
        transform: translateX(0) rotate(5deg);
      }
    `;
    const matches = scanCss('src/drawer.css', css, rules);
    assert.equal(matches.length, 0);
  });

  it('ignores transform: none', () => {
    const css = `
      .reset {
        transform: none;
      }
    `;
    const matches = scanCss('src/reset.css', css, rules);
    assert.equal(matches.length, 0);
  });

  it('skips when paired with transition: transform on the same rule or base selector', () => {
    const css = `
      .card {
        transition: transform 0.2s ease, opacity 0.2s ease;
      }
      .card:hover {
        transform: translateY(-4px) scale(1.02);
      }
      .chip {
        transform: translateY(-2px) scale(1.05);
        transition-property: transform;
      }
    `;
    const matches = scanCss('src/transition.css', css, rules);
    assert.equal(matches.length, 0);
  });

  it('flags paired base + :hover rules that compose transforms across states', () => {
    const css = `
      .tooltip {
        transform: translateX(-50%);
      }
      .tooltip:hover {
        transform: translateX(-50%) scale(1.05);
      }
    `;
    const matches = scanCss('src/tooltip.css', css, rules);
    assert.equal(matches.length, 2);
  });

  it('flags paired base + state modifier class rules (.is-open)', () => {
    const css = `
      .popover-panel {
        transform: translateY(-8px);
      }
      .popover-panel.is-open {
        transform: scale(1);
      }
    `;
    const matches = scanCss('src/popover.css', css, rules);
    assert.equal(matches.length, 2);
  });

  it('flags @keyframes that repeat a static transform component across steps', () => {
    const css = `
      @keyframes pop-centered {
        0% {
          transform: translateX(-50%) scale(0.8);
        }
        100% {
          transform: translateX(-50%) scale(1);
        }
      }
    `;
    const matches = scanCss('src/keyframes.css', css, rules);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });

  it('ignores @keyframes with only a single animated transform group', () => {
    const css = `
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `;
    const matches = scanCss('src/spin.css', css, rules);
    assert.equal(matches.length, 0);
  });
});
