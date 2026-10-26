import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  SCROLL_POSITION_AWARE_ELEMENTS_GUIDE_HASH,
  scrollPositionAwareElementsJsMatcher,
  scrollPositionAwareElementsRule,
  scrollPositionAwareElementsRules,
} from './scroll-position-aware-elements.ts';

describe('scroll-position-aware-elements rule', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(
      scrollPositionAwareElementsRule.id,
      'scroll-position-aware-elements/js-scroll-listener',
    );
    assert.equal(
      scrollPositionAwareElementsRule.guideId,
      'scroll-position-aware-elements',
    );
    assert.equal(
      scrollPositionAwareElementsRule.guideHash,
      SCROLL_POSITION_AWARE_ELEMENTS_GUIDE_HASH,
    );
    assert.equal(scrollPositionAwareElementsRule.guideHash.length, 12);
    assert.ok(scrollPositionAwareElementsRule.verifierRubric.keepWhen.length >= 1);
    assert.ok(scrollPositionAwareElementsRule.verifierRubric.dropWhen.length >= 2);
    assert.equal(scrollPositionAwareElementsRules.length, 1);
  });

  test('flags window scroll listener toggling back-to-top button visibility', () => {
    const code = `
      const backToTopBtn = document.querySelector('.back-to-top');
      window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
          backToTopBtn.classList.add('visible');
        } else {
          backToTopBtn.classList.remove('visible');
        }
      });
    `;
    const { matches } = scanJsSource(
      'src/back-to-top.js',
      code,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scroll-state/);
  });

  test('flags container scroll listener toggling .stuck class using scrollTop', () => {
    const code = `
      function initStickyHeader(scroller, header) {
        scroller.addEventListener('scroll', function() {
          const isStuck = scroller.scrollTop >= 50;
          header.classList.toggle('is-stuck', isStuck);
        });
      }
    `;
    const { matches } = scanJsSource(
      'src/sticky.js',
      code,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scroll-state/);
  });

  test('exempts scroll listener guarded by CSS scroll-state feature detection', () => {
    const code = `
      if (!CSS.supports('container-type', 'scroll-state')) {
        window.addEventListener('scroll', () => {
          btn.classList.toggle('visible', window.scrollY > 200);
        });
      }
    `;
    const { matches } = scanJsSource(
      'src/fallback.js',
      code,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('exempts scroll listener tracking analytics or scroll reading depth without class mutations', () => {
    const code = `
      window.addEventListener('scroll', () => {
        if (window.scrollY > 1000) {
          trackEvent('depth_reached');
        }
      });
    `;
    const { matches } = scanJsSource(
      'src/analytics.js',
      code,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('exempts lazy-loading, parallax, or infinite scroll handlers', () => {
    const code = `
      window.addEventListener('scroll', () => {
        const images = document.querySelectorAll('img[data-src]');
        images.forEach(img => {
          if (img.getBoundingClientRect().top < window.innerHeight) {
            img.setAttribute('src', img.dataset.src);
          }
        });
      });
    `;
    const { matches } = scanJsSource(
      'src/lazy.js',
      code,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('flags window.onscroll assignment toggling header sticky class', () => {
    const code = `
      window.onscroll = function() {
        if (window.pageYOffset > 80) {
          header.classList.add('sticky');
        } else {
          header.classList.remove('sticky');
        }
      };
    `;
    const { matches } = scanJsSource(
      'src/onscroll.js',
      code,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scroll-state/);
  });

  test('flags scroll handler changing header size or logo dimensions', () => {
    const code = `
      window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
          document.getElementById('logo').style.width = '100px';
        } else {
          document.getElementById('logo').style.width = '200px';
        }
      });
    `;
    const { matches } = scanJsSource(
      'src/logo-shrink.js',
      code,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scroll-state/);
  });

  test('flags scroll handler calling same-file helper function', () => {
    const code = `
      window.onscroll = function() { scrollFunction(); };
      function scrollFunction() {
        if (document.documentElement.scrollTop > 100) {
          navbar.classList.add('nav-fixed');
        } else {
          navbar.classList.remove('nav-fixed');
        }
      }
    `;
    const { matches } = scanJsSource(
      'src/named-helper.js',
      code,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scroll-state/);
  });

  test('flags jQuery scroll handler comparing position variable on navbar', () => {
    const code = `
      $(window).scroll(function() {
        var scrollPos = $(window).scrollTop();
        if (scrollPos >= 80) {
          $('#site-header').addClass('nav-fixed');
        } else {
          $('#site-header').removeClass('nav-fixed');
        }
      });
    `;
    const { matches } = scanJsSource(
      'src/jquery-navbar.js',
      code,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scroll-state/);
  });

  test('exempts scroll listeners dynamically registered inside touch/click interaction listeners', () => {
    const code = `
      $('body').on('touchstart', function() {
        $(window).scroll(function() {
          if ($(window).scrollTop() > 200) {
            $('#topIcon').removeClass('Hide');
          } else {
            $('#topIcon').addClass('Hide');
          }
        });
      });
    `;
    const { matches } = scanJsSource(
      'src/nested-touch.js',
      code,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('flags scroll listener toggling custom class on .fixed-top or .sticky-top element', () => {
    const jqCode = `
      $(window).scroll(function () {
        if ($(window).scrollTop() > 200) {
          $('.fixed-top').addClass('menu-bg');
        } else {
          $('.fixed-top').removeClass('menu-bg');
        }
      });
    `;
    const jqResult = scanJsSource(
      'src/fixed-top-menu.js',
      jqCode,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(jqResult.matches.length, 1);

    const domCode = `
      const bar = document.querySelector('.sticky-top');
      window.addEventListener('scroll', () => {
        bar.classList.toggle('elevated', window.scrollY > 16);
      });
    `;
    const domResult = scanJsSource(
      'src/sticky-top-bar.js',
      domCode,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(domResult.matches.length, 1);
  });

  test('flags jQuery .offset().top compared against constant threshold variable', () => {
    const code = `
      var SCROLLING_NAVBAR_OFFSET_TOP = 50;
      $(window).on('scroll', function () {
        var $navbar = $('.navbar');
        if ($navbar.length) {
          if ($navbar.offset().top > SCROLLING_NAVBAR_OFFSET_TOP) {
            $('.scrolling-navbar').addClass('top-nav-collapse');
          } else {
            $('.scrolling-navbar').removeClass('top-nav-collapse');
          }
        }
      });
    `;
    const { matches } = scanJsSource(
      'public/js/modules/scrolling-navbar.js',
      code,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
  });

  test('exempts getBoundingClientRect clamping and scrollTop setter calls', () => {
    const clampingCode = `
      function stickyEl(adBanner, beforeEl) {
        const getTop = () => beforeEl.getBoundingClientRect().top;
        let scrollPos = 0;
        window.addEventListener('scroll', () => {
          scrollPos = window.scrollY;
          if (scrollPos > 100) {
            adBanner.classList.add('fixed');
          } else {
            adBanner.classList.remove('fixed');
          }
        });
        return getTop;
      }
    `;
    const clampingResult = scanJsSource(
      'src/ad-clamp.js',
      clampingCode,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(clampingResult.matches.length, 0);

    const setterOnlyCode = `
      $(window).on('scroll', function () {
        if (locked) {
          $(window).scrollTop(0);
          $('.navbar').addClass('fixed-top');
        }
      });
    `;
    const setterResult = scanJsSource(
      'src/scroll-lock.js',
      setterOnlyCode,
      [scrollPositionAwareElementsJsMatcher],
      project,
    );
    assert.equal(setterResult.matches.length, 0);
  });
});
