import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  persistentAppToursJsMatcher,
  persistentAppToursPackageMatcher,
} from './persistent-app-tours.ts';

void test('persistent-app-tours: positive brownfield matches', async (t) => {
  await t.test('flags shepherd.js, driver.js, and bootstrap-tour in package.json', () => {
    const pkgJson = JSON.stringify({
      dependencies: {
        'bootstrap-tour': '^0.12.0',
        'shepherd.js': '^11.0.0',
      },
    });
    const matches = scanPackageJson('package.json', pkgJson, [
      persistentAppToursPackageMatcher,
    ]);
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /popover="manual"/);
  });

  await t.test('flags introJs() onboarding walkthrough call once per chain', () => {
    const code = `
      import introJs from 'intro.js';
      export function startOnboarding() {
        introJs().setOptions({ steps: [{ element: '#step1', intro: 'Welcome' }] }).start();
      }
    `;
    const matches = matchJsRule(persistentAppToursJsMatcher, 'tour.ts', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /popover="manual"/);
  });

  await t.test('flags new Shepherd.Tour() initialization', () => {
    const code = `
      import Shepherd from 'shepherd.js';
      const tour = new Shepherd.Tour({
        useModalOverlay: false,
      });
      tour.addStep({ id: 'first', text: 'Click here' });
    `;
    const matches = matchJsRule(persistentAppToursJsMatcher, 'shepherd-tour.ts', code);
    assert.equal(matches.length, 1);
  });

  await t.test('flags driver({ steps }) from driver.js', () => {
    const code = `
      import { driver } from 'driver.js';
      const d = driver({
        steps: [{ element: '#nav', popover: { title: 'Nav' } }],
      });
      d.drive();
    `;
    const matches = matchJsRule(persistentAppToursJsMatcher, 'driver-tour.ts', code);
    assert.equal(matches.length, 1);
  });
});

void test('persistent-app-tours: negative / exempt cases', async (t) => {
  await t.test('exempts files already using popover="manual" or anchor positioning', () => {
    const code = `
      import introJs from 'intro.js';
      const step = document.querySelector('[popover="manual"]');
      introJs().start();
    `;
    const matches = matchJsRule(persistentAppToursJsMatcher, 'modern-tour.ts', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-tour database driver calls', () => {
    const code = `
      import { driver } from 'neo4j-driver';
      const db = driver('bolt://localhost:7687');
    `;
    const matches = matchJsRule(persistentAppToursJsMatcher, 'db.ts', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts modal spotlight tours blocking interaction (disableInteraction: true) or chaining onbeforechange hooks', () => {
    const code = `
      import introJs from 'intro.js';
      function initIntro() {
        introJs().setOptions({
          exitOnEsc: false,
          disableInteraction: true,
        }).onbeforechange(function(ele) {
          ele.click();
        }).start();
      }
    `;
    const matches = matchJsRule(persistentAppToursJsMatcher, '_actions.js', code);
    assert.equal(matches.length, 0);
  });
});
