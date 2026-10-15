import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  DEFER_WORK_UNTIL_SCROLL_ENDS_GUIDE_HASH,
  deferWorkUntilScrollEndsMatcher,
  deferWorkUntilScrollEndsRule,
} from './defer-work-until-scroll-ends.ts';

describe('defer-work-until-scroll-ends rule', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(deferWorkUntilScrollEndsRule.id, 'defer-work-until-scroll-ends');
    assert.equal(deferWorkUntilScrollEndsRule.guideId, 'defer-work-until-scroll-ends');
    assert.equal(deferWorkUntilScrollEndsRule.guideHash, DEFER_WORK_UNTIL_SCROLL_ENDS_GUIDE_HASH);
    assert.equal(deferWorkUntilScrollEndsRule.guideHash.length, 12);
    assert.ok(deferWorkUntilScrollEndsRule.phase2Rubric.keepWhen.length >= 2);
    assert.ok(deferWorkUntilScrollEndsRule.phase2Rubric.dropWhen.length >= 2);
  });

  test('flags addEventListener("scroll") with clearTimeout and setTimeout debounce', () => {
    const code = `
      let scrollTimer = null;
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          fetchMorePosts();
        }, 150);
      });
    `;
    const { matches } = scanJsSource(
      'views/feed.js',
      code,
      [deferWorkUntilScrollEndsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scrollend/);
  });

  test('flags addEventListener("scroll", debounce(...)) helper call', () => {
    const code = `
      window.addEventListener('scroll', debounce(() => {
        updateNavbar();
      }, 200));
    `;
    const { matches } = scanJsSource(
      'nav/sticky.js',
      code,
      [deferWorkUntilScrollEndsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scrollend/);
  });

  test('flags $(window).on("scroll", _.debounce(...)) helper', () => {
    const code = `
      $(window).on('scroll', _.debounce(function() {
        console.log('Scroll finished');
      }, 150));
    `;
    const { matches } = scanJsSource(
      'ui/scroll.js',
      code,
      [deferWorkUntilScrollEndsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scrollend/);
  });

  test('flags class method scroll listener setting timer with clearTimeout in class', () => {
    const code = `
      class Scroller {
        constructor() {
          this.timer = null;
          window.addEventListener('scroll', this.onScroll.bind(this));
        }
        clear() {
          clearTimeout(this.timer);
        }
        onScroll() {
          this.timer = setTimeout(() => this.onScrollEnd(), 100);
        }
      }
    `;
    const { matches } = scanJsSource(
      'components/scroller.js',
      code,
      [deferWorkUntilScrollEndsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scrollend/);
  });

  test('flags jQuery $(window).on("scroll") debounce handler', () => {
    const code = `
      var scrollTimeout;
      $(window).on('scroll', function() {
        window.clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(function() {
          console.log('User finished scrolling');
        }, 200);
      });
    `;
    const { matches } = scanJsSource(
      'ui/scroll-tracker.js',
      code,
      [deferWorkUntilScrollEndsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scrollend/);
  });

  test('flags window.onscroll assignment with debounce pattern', () => {
    const code = `
      let scrollTimer;
      window.onscroll = () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          saveScrollPosition();
        }, 250);
      };
    `;
    const { matches } = scanJsSource(
      'nav/persist.js',
      code,
      [deferWorkUntilScrollEndsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scrollend/);
  });

  test('ignores scroll listener inside onscrollend feature detection fallback block', () => {
    const code = `
      const scroller = document.querySelector('#scroller');
      if ('onscrollend' in window) {
        scroller.addEventListener('scrollend', onScrollEnd);
      } else {
        let timer;
        scroller.addEventListener('scroll', () => {
          clearTimeout(timer);
          timer = setTimeout(onScrollEnd, 100);
        });
      }
    `;
    const { matches } = scanJsSource(
      'utils/scroll-polyfill.js',
      code,
      [deferWorkUntilScrollEndsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores scroll listeners using requestAnimationFrame for continuous animation', () => {
    const code = `
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            updateProgressBar();
            ticking = false;
          });
          ticking = true;
        }
      });
    `;
    const { matches } = scanJsSource(
      'ui/progress.js',
      code,
      [deferWorkUntilScrollEndsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores resize debouncers', () => {
    const code = `
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          recalculateGrid();
        }, 150);
      });
    `;
    const { matches } = scanJsSource(
      'layout/grid.js',
      code,
      [deferWorkUntilScrollEndsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
