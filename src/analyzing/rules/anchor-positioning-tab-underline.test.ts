import assert from 'node:assert/strict';
import test from 'node:test';
import { scanJsSource } from '../scanners/js-scanner.ts';
import type { JsRuleMatcher } from '../schema.ts';
import { anchorPositioningTabUnderlineRule } from './anchor-positioning-tab-underline.ts';

const matcher = anchorPositioningTabUnderlineRule.matcher as JsRuleMatcher;

void test('anchor-positioning-tab-underline: positive brownfield matches', async (suiteContext) => {
  await suiteContext.test('flags active tab offsetLeft measurement moving indicator style.transform', () => {
    const code = `
      function updateTabIndicator(activeTab: HTMLElement, indicator: HTMLElement) {
        const offset = activeTab.offsetLeft;
        const width = activeTab.offsetWidth;
        indicator.style.transform = \`translateX(\${offset}px)\`;
        indicator.style.width = \`\${width}px\`;
      }
    `;
    const { matches } = scanJsSource('tabs.ts', code, [matcher]);
    assert.ok(matches.length >= 1);
    assert.match(matches[0]?.message ?? '', /CSS Anchor Positioning/);
  });

  await suiteContext.test('flags getBoundingClientRect math updating tab underline style.left', () => {
    const code = `
      function moveUnderline(tabElement: HTMLElement, underline: HTMLElement, container: HTMLElement) {
        const tabRect = tabElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        underline.style.left = \`\${tabRect.left - containerRect.left}px\`;
        underline.style.width = \`\${tabRect.width}px\`;
      }
    `;
    const { matches } = scanJsSource('navigation.ts', code, [matcher]);
    assert.ok(matches.length >= 1);
    assert.match(matches[0]?.message ?? '', /CSS Anchor Positioning/);
  });

  await suiteContext.test('flags tab click handler setting indicator CSS variable', () => {
    const code = `
      function onTabClick(event: MouseEvent, tabList: HTMLElement) {
        const tab = event.currentTarget as HTMLElement;
        const left = tab.offsetLeft;
        tabList.style.setProperty('--indicator-left', \`\${left}px\`);
      }
    `;
    const { matches } = scanJsSource('segmentedControl.ts', code, [matcher]);
    assert.ok(matches.length >= 1);
  });

  await suiteContext.test('flags React component measuring active tab offsetLeft', () => {
    const code = `
      export function TabBar({ tabs, activeIndex }: any) {
        const tabRefs = useRef<HTMLButtonElement[]>([]);
        const indicatorRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
          const currentTab = tabRefs.current[activeIndex];
          if (currentTab && indicatorRef.current) {
            const tabLeft = currentTab.offsetLeft;
            indicatorRef.current.style.transform = \`translateX(\${tabLeft}px)\`;
          }
        }, [activeIndex]);

        return <div>{tabs.map((tab: any, index: number) => <button key={index}>{tab}</button>)}</div>;
      }
    `;
    const { matches } = scanJsSource('TabBar.tsx', code, [matcher]);
    assert.ok(matches.length >= 1);
  });
});

void test('anchor-positioning-tab-underline: negative / exempt cases', async (suiteContext) => {
  await suiteContext.test('exempts code protected by CSS.supports("position-anchor")', () => {
    const code = `
      function updateIndicator(tab: HTMLElement, indicator: HTMLElement) {
        if (CSS.supports('position-anchor: --active')) {
          return;
        }
        indicator.style.transform = \`translateX(\${tab.offsetLeft}px)\`;
      }
    `;
    const { matches } = scanJsSource('tabsWithFallback.ts', code, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts tooltip positioning with getBoundingClientRect', () => {
    const code = `
      function positionTooltip(tooltip: HTMLElement, targetButton: HTMLElement) {
        const rect = targetButton.getBoundingClientRect();
        tooltip.style.top = \`\${rect.bottom + 8}px\`;
        tooltip.style.left = \`\${rect.left}px\`;
      }
    `;
    const { matches } = scanJsSource('tooltip.ts', code, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts drag-and-drop handler with offsetLeft', () => {
    const code = `
      function onDragMove(dragItem: HTMLElement, event: MouseEvent) {
        const currentLeft = dragItem.offsetLeft;
        dragItem.style.left = \`\${currentLeft + event.movementX}px\`;
      }
    `;
    const { matches } = scanJsSource('dragDrop.ts', code, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts map marker position calculation', () => {
    const code = `
      function updateMapMarker(marker: HTMLElement, point: any) {
        marker.style.left = \`\${point.x}px\`;
        marker.style.top = \`\${point.y}px\`;
      }
    `;
    const { matches } = scanJsSource('map.ts', code, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts test and fixture files', () => {
    const code = `
      function updateTab(tab: HTMLElement, indicator: HTMLElement) {
        indicator.style.left = \`\${tab.offsetLeft}px\`;
      }
    `;
    const { matches } = scanJsSource('test/fixtures/tabs.ts', code, [matcher]);
    assert.equal(matches.length, 0);
  });
});
