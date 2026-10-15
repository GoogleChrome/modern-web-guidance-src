import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  ANIMATE_ELEMENT_ENTRY_EXIT_GUIDE_HASH,
  animateElementEntryExitMatcher,
  animateElementEntryExitRule,
} from './animate-element-entry-exit.ts';

describe('animate-element-entry-exit rule', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(animateElementEntryExitRule.id, 'animate-element-entry-exit');
    assert.equal(animateElementEntryExitRule.guideId, 'animate-element-entry-exit');
    assert.equal(animateElementEntryExitRule.guideHash, ANIMATE_ELEMENT_ENTRY_EXIT_GUIDE_HASH);
    assert.equal(animateElementEntryExitRule.guideHash.length, 12);
    assert.ok(animateElementEntryExitRule.phase2Rubric.keepWhen.length >= 2);
    assert.ok(animateElementEntryExitRule.phase2Rubric.dropWhen.length >= 2);
  });

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
      [animateElementEntryExitMatcher],
      project,
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
      [animateElementEntryExitMatcher],
      project,
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
      [animateElementEntryExitMatcher],
      project,
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
      [animateElementEntryExitMatcher],
      project,
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
      [animateElementEntryExitMatcher],
      project,
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
      [animateElementEntryExitMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
