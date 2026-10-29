import assert from 'node:assert/strict';
import test from 'node:test';
import { scanJsSource } from '../scanners/js-scanner.ts';
import {
  childStateBasedStylingJsMatcher,
} from './child-state-based-styling.ts';

const jsMatcher = childStateBasedStylingJsMatcher;

void test('child-state-based-styling/js-parent-class: JS positive matches', async (t) => {
  await t.test('flags focus/blur event listeners adding/removing focused class on parentElement', () => {
    const code = `
      const input = document.querySelector('input');
      input.addEventListener('focus', () => {
        input.parentElement.classList.add('is-focused');
      });
      input.addEventListener('blur', () => {
        input.parentElement.classList.remove('is-focused');
      });
    `;
    const { matches } = scanJsSource('input-focus.js', code, [jsMatcher]);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 4);
    assert.equal(matches[1]?.line, 7);
    assert.match(matches[0]?.message ?? '', /CSS :has\(\) selector/);
  });

  await t.test('flags closest(.form-group) class toggle on change event (including preventDefault)', () => {
    const code = `
      function bindInputEvents(field) {
        field.addEventListener('change', (e) => {
          e.preventDefault();
          const group = field.closest('.form-group');
          group.classList.toggle('has-value', field.value.length > 0);
        });
      }
    `;
    const { matches } = scanJsSource('field-change.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 6);
  });

  await t.test('flags onfocus property assignment modifying parentNode classList', () => {
    const code = `
      function setupField(input) {
        input.onfocus = function() {
          input.parentNode.classList.add('active');
        };
      }
    `;
    const { matches } = scanJsSource('onfocus.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 4);
  });

  await t.test('flags jQuery focus/blur and validity parent state class toggles', () => {
    const code = `
      $('.form-control').on("focus", function() {
        $(this).parent('.field').addClass("is-focused");
      }).on("blur", function() {
        $(this).parent(".field").removeClass("is-focused");
      });

      $('.form-control').focusin(function() {
        $(this).parent().addClass('focused');
      }).focusout(function() {
        $(this).parent().removeClass('focused');
      });

      $inputs.on('blur input', function () {
        $(this).parent().toggleClass('invalid', !(this.validity && this.validity.valid));
      });
    `;
    const { matches } = scanJsSource('jquery-parent-focus.js', code, [jsMatcher]);
    assert.equal(matches.length, 5);
  });
});

void test('child-state-based-styling/js-parent-class: JS negative / exempt cases', async (t) => {
  await t.test('exempts classList modification directly on input itself', () => {
    const code = `
      input.addEventListener('focus', () => {
        input.classList.add('focused');
      });
    `;
    const { matches } = scanJsSource('self-target.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts click listeners toggling non-form UI state', () => {
    const code = `
      button.addEventListener('click', () => {
        button.parentElement.classList.toggle('open');
      });
    `;
    const { matches } = scanJsSource('click-open.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts code guarded by CSS :has() feature check', () => {
    const code = `
      if (!CSS.supports('selector(:has(*))')) {
        input.addEventListener('focus', () => {
          input.parentElement.classList.add('is-focused');
        });
      }
    `;
    const { matches } = scanJsSource('guarded.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts event delegation handlers checking e.target.matches', () => {
    const code = `
      document.addEventListener('focusin', (e) => {
        if (e.target.matches('.form-input')) {
          e.target.parentElement.classList.add('is-focused');
        }
      });
    `;
    const { matches } = scanJsSource('delegation.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts state management dispatch or imperative JS animation inside focus handler', () => {
    const code = `
      input.addEventListener('focus', () => {
        dispatch({ type: 'INPUT_FOCUSED' });
        input.parentElement.classList.add('is-focused');
      });
      inputs.forEach(function (el) {
        var parent = el.parentNode;
        el.addEventListener('focus', function () {
          parent.classList.add('filled');
          placeholderAnimationIn(parent, true);
        }, false);
        el.addEventListener('blur', function () {
          if (el.value.length) return;
          parent.classList.remove('filled');
          placeholderAnimationIn(parent, false);
        }, false);
      });
    `;
    const { matches } = scanJsSource('redux-focus.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts jQuery custom validators, value.length checks, and non-form tab links', () => {
    const code = `
      $('#cardnumber').on('blur input', function () {
        $(this).closest('span').toggleClass('valid', $.payment.validateCardNumber(this.value));
      });
      $input.on('focus blur', function (e) {
        $(this).parents('.form-group').toggleClass('focused', (e.type === 'focus' || this.value.length > 0));
      });
      tabs.on('focus blur', 'a', function (e) {
        $(this).parent().toggleClass('ui-state-focus', e.type === 'focusin');
      });
    `;
    const { matches } = scanJsSource('jquery-negative.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });
});
