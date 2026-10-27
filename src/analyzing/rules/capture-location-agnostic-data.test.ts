import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  captureLocationAgnosticDataJsMatcher,
  captureLocationAgnosticDataPackageMatcher
} from './capture-location-agnostic-data.ts';
void test('capture-location-agnostic-data dependency matcher', async (t) => {
  await t.test('flags i18n-iso-countries, country-list, and iso-639-1', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'i18n-iso-countries': '^7.11.0',
          'country-list': '^2.3.0',
          'iso-639-1': '^3.1.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      captureLocationAgnosticDataPackageMatcher,
    ]);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts unrelated dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'libphonenumber-js': '^1.10.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      captureLocationAgnosticDataPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('capture-location-agnostic-data JS matcher', async (t) => {
  await t.test('flags imported countries.getName, countryList.getName, and ISO6391.getName when only single-code display-name translation is used', () => {
    const code = `
      import countries from 'i18n-iso-countries';
      import countryList from 'country-list';
      const usName = countries.getName('US', 'en');
      const deName = countryList.getName('DE');
      const langName = ISO6391.getName('fr');
    `;
    const matches = matchJsRule(captureLocationAgnosticDataJsMatcher, 'locale.js', code);
    assert.equal(matches.length, 3);
    assert.match(matches[0]?.message ?? '', /Intl\.DisplayNames/);
  });

  await t.test('exempts countries.getNames() full-dictionary enumeration and unimported local objects', () => {
    const code = `
      import countries from 'i18n-iso-countries';
      const allCountries = countries.getNames('de');
      const localStore = { getName(code) { return code; } };
      function render(countryList) {
        return countryList.getName('US');
      }
    `;
    const matches = matchJsRule(captureLocationAgnosticDataJsMatcher, 'enumeration.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts getAlpha2Code, getAlpha3Code, and validation calls and files mixing them with getName', () => {
    const code = `
      import countries from 'i18n-iso-countries';
      const code2 = countries.getAlpha2Code('United States', 'en');
      const code3 = countries.getAlpha3Code('Germany', 'en');
      const valid = ISO6391.validate('en');
      const display = countries.getName(code2, 'en');
    `;
    const matches = matchJsRule(captureLocationAgnosticDataJsMatcher, 'conversion.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts when guarded by Intl.DisplayNames check', () => {
    const code = `
      import countries from 'i18n-iso-countries';
      if (typeof Intl.DisplayNames === 'undefined') {
        const name = countries.getName('JP', 'en');
      }
    `;
    const matches = matchJsRule(captureLocationAgnosticDataJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });
});
