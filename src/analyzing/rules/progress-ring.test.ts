import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml } from '../scanners/dom-scanner.ts';
import { scanJsSource } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher, JsRuleMatcher } from '../schema.ts';
import { progressRingDomRule, progressRingRule } from './progress-ring.ts';

const jsMatcher = progressRingRule.matcher as JsRuleMatcher;
const domMatcher = progressRingDomRule.matcher as DomRuleMatcher;

void test('progress-ring: JS positive brownfield matches', async (suiteContext) => {
  await suiteContext.test('flags circumference math and strokeDashoffset formula', () => {
    const code = `
      function setProgress(percent: number, circle: SVGCircleElement, radius: number) {
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDashoffset = \`\${offset}\`;
      }
    `;
    const { matches } = scanJsSource('progressRing.ts', code, [jsMatcher]);
    assert.ok(matches.length >= 1);
    assert.match(matches[0]?.message ?? '', /conic-gradient/);
  });

  await suiteContext.test('flags React JSX circle with strokeDashoffset and strokeDasharray', () => {
    const code = `
      export function CircularProgress({ progress, size, strokeWidth }: any) {
        const radius = (size - strokeWidth) / 2;
        const circumference = radius * 2 * Math.PI;
        const strokeDashoffset = circumference - (progress / 100) * circumference;

        return (
          <svg width={size} height={size}>
            <circle
              className="progress-ring-circle"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
        );
      }
    `;
    const { matches } = scanJsSource('CircularProgress.tsx', code, [jsMatcher]);
    assert.ok(matches.length >= 1);
  });
});

void test('progress-ring: DOM positive brownfield matches', async (suiteContext) => {
  await suiteContext.test('flags circle with stroke-dashoffset inside progress ring svg', () => {
    const html = `
      <div class="progress-ring-wrapper">
        <svg class="progress-ring" width="120" height="120">
          <circle
            class="progress-ring-circle"
            stroke="blue"
            stroke-width="8"
            stroke-dasharray="314"
            stroke-dashoffset="100"
            r="50"
            cx="60"
            cy="60"
          />
        </svg>
      </div>
    `;
    const matches = scanHtml('progress.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /conic-gradient/);
  });
});

void test('progress-ring: negative / exempt cases', async (suiteContext) => {
  await suiteContext.test('exempts SVG circle with pathLength="100"', () => {
    const html = `
      <svg class="progress-ring">
        <circle pathLength="100" stroke-dasharray="75 100" r="50" cx="60" cy="60" />
      </svg>
    `;
    const matches = scanHtml('modernProgress.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts native <progress> element', () => {
    const html = `
      <div class="ring-wrapper">
        <progress value="75" max="100" class="progress-ring"></progress>
      </div>
    `;
    const matches = scanHtml('native.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts decorative circle without stroke-dashoffset', () => {
    const html = `
      <svg width="50" height="50">
        <circle cx="25" cy="25" r="20" fill="red" />
      </svg>
    `;
    const matches = scanHtml('icon.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts test and fixture files', () => {
    const code = `
      function testRing(circle: SVGCircleElement) {
        circle.style.strokeDashoffset = '50';
      }
    `;
    const { matches } = scanJsSource('test/fixtures/ring.ts', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });
});
