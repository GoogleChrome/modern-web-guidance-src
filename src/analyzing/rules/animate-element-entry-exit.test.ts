import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { scanJsSource } from '../scanners/index.ts';
import {
  animateElementEntryExitMatcher
} from './animate-element-entry-exit.ts';

describe('animate-element-entry-exit rule', () => {
  test('flags imperative jQuery fadeIn/fadeOut and slideUp/slideDown', () => {
    const code = `
      function hideToast(toast) {
        $("#toast-msg").fadeIn(200);
        $("#quick-menu").slideUp("fast");
        $(".banner").fadeOut();
        $(element).slideDown(300);
        $("#panel").slideToggle();
      }
    `;
    const { matches } = scanJsSource(
      'ui/components.js',
      code,
      [animateElementEntryExitMatcher]
    );
    assert.equal(matches.length, 5);
    assert.match(matches[0].message, /fadeIn/);
    assert.match(matches[1].message, /slideUp/);
    assert.match(matches[2].message, /fadeOut/);
    assert.match(matches[3].message, /slideDown/);
    assert.match(matches[4].message, /slideToggle/);
  });

  test('flags transitionend and animationend listeners removing DOM element', () => {
    const code = `
      function setupToast() {
        const toast = document.createElement('div');
        toast.addEventListener('animationend', () => {
          toast.remove();
        });

        const modal = document.querySelector('.modal');
        modal.addEventListener('transitionend', function() {
          this.style.display = 'none';
        });

        const alertBox = document.querySelector('.alert');
        alertBox.addEventListener('transitionend', () => {
          alertBox.hidden = true;
        });
      }
    `;
    const { matches } = scanJsSource(
      'ui/toast.js',
      code,
      [animateElementEntryExitMatcher]
    );
    assert.equal(matches.length, 3);
    assert.match(matches[0].message, /animationend/);
    assert.match(matches[1].message, /transitionend/);
    assert.match(matches[2].message, /transitionend/);
  });

  test('flags jQuery .on("animationend") and named callback removing element', () => {
    const code = `
      function dismissAlert($el) {
        $el.on("webkitAnimationEnd animationend", function() {
          $el.hide();
        });

        function handleEnd() {
          $el.remove();
        }
        $el.one("transitionend", handleEnd);
      }
    `;
    const { matches } = scanJsSource(
      'ui/alert.js',
      code,
      [animateElementEntryExitMatcher]
    );
    assert.equal(matches.length, 2);
  });

  test('ignores audio, sound, volume, and gain node fades', () => {
    const code = `
      function handleAudio(audioTrack, soundEffect, camera) {
        audioTrack.fadeIn(1000);
        soundEffect.fadeOut(500);
        camera.fadeIn(200);
      }
    `;
    const { matches } = scanJsSource(
      'audio/player.js',
      code,
      [animateElementEntryExitMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('ignores transitionend listeners that do not remove or hide elements', () => {
    const code = `
      function logTransition(el) {
        el.addEventListener('transitionend', (e) => {
          el.classList.remove('is-animating');
          console.log('Transition completed for', e.propertyName);
        });
      }
    `;
    const { matches } = scanJsSource(
      'ui/logger.js',
      code,
      [animateElementEntryExitMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('ignores animations protected by feature guards', () => {
    const code = `
      function dismiss(el) {
        if (!CSS.supports('transition-behavior', 'allow-discrete')) {
          $(el).fadeOut();
        }
      }
    `;
    const { matches } = scanJsSource(
      'ui/fallback.js',
      code,
      [animateElementEntryExitMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('ignores temporary toast auto-dismiss notifications (chained .delay or setTimeout)', () => {
    const codeA = `
      function showCopied() {
        $('#copied').fadeIn(100);
        setTimeout(() => $('#copied').fadeOut(100), 1000);
      }
    `;
    const resA = scanJsSource('ui/toastA.js', codeA, [animateElementEntryExitMatcher]);
    assert.equal(resA.matches.length, 0);

    const codeB = `
      function showToast() {
        $('.toast').fadeIn().delay(2000).fadeOut();
      }
    `;
    const resB = scanJsSource('ui/toastB.js', codeB, [animateElementEntryExitMatcher]);
    assert.equal(resB.matches.length, 0);

    const codeC = `
      function showModal() {
        $('#modal').fadeIn(200);
        $('#modal').fadeOut(200, () => $('#modal').remove());
      }
    `;
    const resC = scanJsSource('ui/modal.js', codeC, [animateElementEntryExitMatcher]);
    assert.equal(resC.matches.length, 2);
  });

  test('flags DOM jQuery caller whose name contains scene as a substring (e.g. scene_controls)', () => {
    const code = `
      var scene_controls = $('#scene_controls');
      scene_controls.fadeIn(100);
    `;
    const res = scanJsSource('ui/interface.js', code, [animateElementEntryExitMatcher]);
    assert.equal(res.matches.length, 1);
  });
});
