import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import { darkModeToggleJsMatcher } from './dark-mode-toggle.ts';

void test('dark-mode-toggle: positive brownfield matches', async (t) => {
  await t.test('flags theme toggle persisting in localStorage and toggling documentElement.classList("dark")', () => {
    const code = `
      function toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
      }
    `;
    const matches = matchJsRule(darkModeToggleJsMatcher, 'theme-toggle.ts', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /color-scheme/);
  });

  await t.test('flags theme toggle setting document.documentElement.dataset.theme with localStorage', () => {
    const code = `
      const saved = localStorage.getItem('darkMode');
      document.documentElement.dataset.theme = saved === 'true' ? 'dark' : 'light';
    `;
    const matches = matchJsRule(darkModeToggleJsMatcher, 'theme.ts', code);
    assert.equal(matches.length, 1);
  });
});

void test('dark-mode-toggle: negative / exempt cases', async (t) => {
  await t.test('exempts modern toggle that updates <meta name="color-scheme">', () => {
    const code = `
      const meta = document.querySelector('meta[name="color-scheme"]');
      meta.content = localStorage.getItem('color-scheme') ?? 'light dark';
      document.documentElement.classList.toggle('dark');
    `;
    const matches = matchJsRule(darkModeToggleJsMatcher, 'modern-theme.ts', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts system matchMedia listener without localStorage (owned by dark-mode)', () => {
    const code = `
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        document.documentElement.classList.toggle('dark', e.matches);
      });
    `;
    const matches = matchJsRule(darkModeToggleJsMatcher, 'system-theme.ts', code);
    assert.equal(matches.length, 0);
  });
});
