import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  cardJsMatcher,
  cardPackageMatcher,
} from './card.ts';

void test('card JS and package matchers', async (t) => {
  await t.test('flags matchHeight() calls, equal-height card loops, and whole-card click listeners', () => {
    const code = `
      $('.card').matchHeight();

      function equalizeCards() {
        const cards = document.querySelectorAll('.card');
        let maxH = 0;
        cards.forEach((c) => {
          maxH = Math.max(maxH, c.offsetHeight);
        });
        cards.forEach((c) => {
          c.style.height = maxH + 'px';
        });
      }

      document.querySelectorAll('.card').forEach((card) => {
        card.addEventListener('click', () => {
          card.querySelector('a.primary').click();
        });
      });
    `;
    const matches = matchJsRule(cardJsMatcher, 'cards.js', code);
    assert.equal(matches.length, 3);
  });

  await t.test('flags jquery-match-height in package.json', () => {
    const pkg = JSON.stringify({
      name: 'web-app',
      dependencies: {
        'jquery-match-height': '^0.7.2',
      },
    });
    const matches = scanPackageJson('package.json', pkg, [cardPackageMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /subgrid/);
  });

  await t.test('exempts card button click handlers that do not navigate the whole card', () => {
    const code = `
      document.querySelector('.card-favorite-btn').addEventListener('click', (e) => {
        e.currentTarget.classList.toggle('is-favorited');
      });
    `;
    const matches = matchJsRule(cardJsMatcher, 'favorite.js', code);
    assert.equal(matches.length, 0);
  });
});
