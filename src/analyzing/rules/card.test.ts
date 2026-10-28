import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  cardJsMatcher,
} from './card.ts';

void test('card JS matcher', async (t) => {
  await t.test('flags card matchHeight() calls (deduplicated), equal-height card loops, and whole-card click listeners', () => {
    const code = `
      $('.card').matchHeight();
      $('.card-item').matchHeight();

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

  await t.test('exempts generic non-card matchHeight() calls and card button click handlers', () => {
    const code = `
      $('.CTA_section').children('.mheight').matchHeight();
      document.querySelector('.card-favorite-btn').addEventListener('click', (e) => {
        e.currentTarget.classList.toggle('is-favorited');
      });
    `;
    const matches = matchJsRule(cardJsMatcher, 'favorite.js', code);
    assert.equal(matches.length, 0);
  });
});
