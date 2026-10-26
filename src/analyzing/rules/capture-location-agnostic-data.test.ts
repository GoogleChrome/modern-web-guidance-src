import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  CAPTURE_LOCATION_AGNOSTIC_DATA_GUIDE_HASH,
  captureLocationAgnosticDataJsMatcher,
  captureLocationAgnosticDataJsRule,
  captureLocationAgnosticDataPackageMatcher,
  captureLocationAgnosticDataPackageRule,
  captureLocationAgnosticDataRules,
} from './capture-location-agnostic-data.ts';

void test('capture-location-agnostic-data: rule metadata', () => {
  assert.equal(
    captureLocationAgnosticDataPackageRule.id,
    'capture-location-agnostic-data/package-iso-lookup',
  );
  assert.equal(
    captureLocationAgnosticDataPackageRule.guideId,
    'capture-location-agnostic-data',
  );
  assert.equal(
    captureLocationAgnosticDataPackageRule.guideHash,
    CAPTURE_LOCATION_AGNOSTIC_DATA_GUIDE_HASH,
  );
  assert.equal(CAPTURE_LOCATION_AGNOSTIC_DATA_GUIDE_HASH.length, 12);

  assert.equal(
    captureLocationAgnosticDataJsRule.id,
    'capture-location-agnostic-data/js-iso-lookup',
  );
  assert.equal(
    captureLocationAgnosticDataJsRule.guideId,
    'capture-location-agnostic-data',
  );
  assert.equal(
    captureLocationAgnosticDataJsRule.guideHash,
    CAPTURE_LOCATION_AGNOSTIC_DATA_GUIDE_HASH,
  );

  assert.equal(captureLocationAgnosticDataRules.length, 3);
  assert.ok(
    captureLocationAgnosticDataPackageRule.verifierRubric.keepWhen.length >= 1,
  );
  assert.ok(
    captureLocationAgnosticDataPackageRule.verifierRubric.dropWhen.length >= 2,
  );
  assert.ok(
    captureLocationAgnosticDataJsRule.verifierRubric.keepWhen.length >= 1,
  );
  assert.ok(
    captureLocationAgnosticDataJsRule.verifierRubric.dropWhen.length >= 2,
  );
});

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
    const project = createInMemoryProject();
    const code = `
      import countries from 'i18n-iso-countries';
      import countryList from 'country-list';
      const usName = countries.getName('US', 'en');
      const deName = countryList.getName('DE');
      const langName = ISO6391.getName('fr');
    `;
    const sourceFile = project.createSourceFile('locale.js', code);
    const matches = captureLocationAgnosticDataJsMatcher.matchFile(sourceFile, {
      filePath: 'locale.js',
      fileContent: code,
    });
    assert.equal(matches.length, 3);
    assert.match(matches[0]?.message ?? '', /Intl\.DisplayNames/);
  });

  await t.test('exempts countries.getNames() full-dictionary enumeration and unimported local objects', () => {
    const project = createInMemoryProject();
    const code = `
      import countries from 'i18n-iso-countries';
      const allCountries = countries.getNames('de');
      const localStore = { getName(code) { return code; } };
      function render(countryList) {
        return countryList.getName('US');
      }
    `;
    const sourceFile = project.createSourceFile('enumeration.js', code);
    const matches = captureLocationAgnosticDataJsMatcher.matchFile(sourceFile, {
      filePath: 'enumeration.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts getAlpha2Code, getAlpha3Code, and validation calls and files mixing them with getName', () => {
    const project = createInMemoryProject();
    const code = `
      import countries from 'i18n-iso-countries';
      const code2 = countries.getAlpha2Code('United States', 'en');
      const code3 = countries.getAlpha3Code('Germany', 'en');
      const valid = ISO6391.validate('en');
      const display = countries.getName(code2, 'en');
    `;
    const sourceFile = project.createSourceFile('conversion.js', code);
    const matches = captureLocationAgnosticDataJsMatcher.matchFile(sourceFile, {
      filePath: 'conversion.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts when guarded by Intl.DisplayNames check', () => {
    const project = createInMemoryProject();
    const code = `
      import countries from 'i18n-iso-countries';
      if (typeof Intl.DisplayNames === 'undefined') {
        const name = countries.getName('JP', 'en');
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = captureLocationAgnosticDataJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
