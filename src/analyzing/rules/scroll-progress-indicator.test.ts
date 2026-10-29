import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  scrollProgressIndicatorMatcher
} from './scroll-progress-indicator.ts';
void test('scroll-progress-indicator JS matcher', async (t) => {
  await t.test('flags scroll listeners updating progress bar style.width, scaleX(), or --scroll-progress', () => {
    const code = `
      const progressBar = document.querySelector('#progress');
      window.addEventListener('scroll', () => {
        const el = document.documentElement;
        const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
        progressBar.style.width = pct + '%';
      });

      window.addEventListener('scroll', () => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = window.scrollY / scrollable;
        progressBar.style.transform = \`scaleX(\${ratio})\`;
      });

      window.addEventListener('scroll', () => {
        const ratio = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        document.documentElement.style.setProperty('--scroll-progress', String(ratio));
      });
    `;
    const matches = matchJsRule(scrollProgressIndicatorMatcher, 'progress.js', code);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by CSS.supports("animation-timeline", "scroll()")', () => {
    const code = `
      if (!CSS.supports('animation-timeline', 'scroll()')) {
        const progress = document.querySelector('#progress');
        window.addEventListener('scroll', () => {
          const scrollable = document.documentElement.scrollHeight - window.innerHeight;
          const progressPercentage = window.scrollY / scrollable;
          progress.style.transform = \`scaleX(\${progressPercentage})\`;
        });
      }
    `;
    const matches = matchJsRule(scrollProgressIndicatorMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('flags progress bar updates using scale3d transform', () => {
    const code = `
      const indicator = document.querySelector('.reading-progress');
      window.addEventListener('scroll', () => {
        const docHeight = document.documentElement.scrollHeight;
        const viewHeight = window.innerHeight;
        const scrolled = window.pageYOffset;
        const ratio = scrolled / (docHeight - viewHeight);
        indicator.style.transform = \`scale3d(\${ratio}, 1, 1)\`;
      });
    `;
    const matches = matchJsRule(scrollProgressIndicatorMatcher, 'scale3d.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('flags jQuery $(window).scroll and requestAnimationFrame scroll progress handlers', () => {
    const code = `
      $(window).scroll(() => {
        const s = $(window).scrollTop();
        const d = $(document).height();
        const c = $(window).height();
        const scrollPercent = (s / (d - c)) * 100;
        $('.progress .determinate').css('width', \`\${scrollPercent}%\`);
      });

      function updateScrollPosition() {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        document.getElementById('scroll-indicator').style.width = scrolled + '%';
      }
      function onScroll() {
        requestAnimationFrame(updateScrollPosition);
      }
      document.addEventListener('scroll', onScroll, false);
    `;
    const matches = matchJsRule(scrollProgressIndicatorMatcher, 'jquery-raf.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts scroll listeners that also write dynamic percentage text into .innerText', () => {
    const code = `
      window.addEventListener('scroll', () => {
        const contentHeight = document.body.scrollHeight - window.innerHeight;
        const scrollPercent = Math.min(100 * window.scrollY / contentHeight, 100);
        backToTop.querySelector('span').innerText = Math.round(scrollPercent) + '%';
        readingProgressBar.style.width = scrollPercent.toFixed(2) + '%';
      });
    `;
    const matches = matchJsRule(scrollProgressIndicatorMatcher, 'hexo-next.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts scroll listeners with comment slashes and non-percentage .css("width") layout adjustments', () => {
    const code = `
      function showFooterLink() {
        // If footer becomes default positioning
        if ($(document).scrollTop() + $(window).height() > $(document).height() - 41) {
          $("#foot").css("position", "inherit");
        } else {
          $("#foot").css("width", "calc(100% - 194px)");
        }
      }
      $(window).scroll(showFooterLink);
    `;
    const matches = matchJsRule(scrollProgressIndicatorMatcher, 'region.js', code);
    assert.equal(matches.length, 0);
  });
});
