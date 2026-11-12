import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { generateDemosManifest, generateGroupedTasksManifest, stagePages } from './generate-manifests.js';
import { DISCIPLINE_GUIDES } from '../core/guide-validation.ts';
import { dashboardDir, rootDir } from '../core/paths.ts';

let tempDir = '';
let manifestDir = '';

before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demos-manifest-test-'));
    manifestDir = path.join(tempDir, 'dashboard');
});

after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('generateDemosManifest lists every guide with a demo.html, primary demo first', () => {
    const { guides, features } = generateDemosManifest(manifestDir);
    const written = JSON.parse(fs.readFileSync(path.join(manifestDir, 'demos.gen.json'), 'utf8'));
    assert.deepEqual(written.guides, guides);
    assert.deepEqual(written.features, features);
    assert.ok(features.length > 50, 'features should list unique web-feature ids');
    assert.ok(features.includes('user-pseudos'));

    const demoCount = fs.readdirSync(path.join(rootDir, 'guides'), { recursive: true, encoding: 'utf8' })
        .filter(rel => path.basename(rel) === 'demo.html' && fs.existsSync(path.join(rootDir, 'guides', path.dirname(rel), 'guide.md'))).length;
    assert.equal(guides.length, demoCount);

    assert.deepEqual(guides.filter(g => g.demos[0].id !== 'demo').map(g => g.id), []);
    assert.deepEqual(guides.flatMap(g => g.demos).filter(d => !fs.existsSync(path.join(rootDir, d.path))), []);

    const intrinsic = guides.find(g => g.id === 'animate-to-intrinsic-sizes');
    assert.deepEqual(intrinsic?.demos.map(d => d.id), ['demo', 'negative-demo']);
    assert.equal(intrinsic?.title, 'Animate to Intrinsic Sizes');
});

test('stagePages copies demo assets but not eval sources', () => {
    const stageDir = path.join(tempDir, 'staged');
    stagePages(stageDir, manifestDir);

    const expected = [
        'og-image.png',
        'demos/index.html',
        'demos/demos.js',
        'demos/demos.css',
        'search/index.html',
        'search/search.js',
        'search/search.css',
        'demos.gen.json',
        'guides/css/animate-to-intrinsic-sizes/demo.html',
    ];
    const missing = expected.filter(f => !fs.existsSync(path.join(stageDir, f)));
    assert.deepEqual(missing, []);

    const forbidden = fs.readdirSync(path.join(stageDir, 'guides'), { recursive: true, encoding: 'utf8' })
        .filter(rel => /\.(ts|md|patch)$/.test(rel) || rel.split(path.sep).includes('targets'));
    assert.deepEqual(forbidden, []);

    const stagedDemo = fs.readFileSync(path.join(stageDir, 'guides/css/animate-to-intrinsic-sizes/demo.html'), 'utf8');
    assert.ok(stagedDemo.includes('location.search.includes("preview=1")'), 'staged demo HTML should include preview focus/scroll shim');
});

test('generateGroupedTasksManifest includes sorted disciplineGuides alongside category-keyed guides', async () => {
    await generateGroupedTasksManifest(manifestDir);
    const written = JSON.parse(fs.readFileSync(path.join(manifestDir, 'grouped-tasks.gen.json'), 'utf8'));
    assert.deepEqual(written.disciplineGuides, [...DISCIPLINE_GUIDES].sort());
    assert.ok(Array.isArray(written.guides.css?.['css-layout']), 'named discipline guide retains its filesystem category directory');
});

test('public dashboard entry points declare Open Graph and Twitter social card metadata matching og-image.png', () => {
    const ogImagePath = path.join(dashboardDir, 'og-image.png');
    assert.ok(fs.existsSync(ogImagePath), 'og-image.png should exist in src/dashboard');

    const pngHeader = fs.readFileSync(ogImagePath).subarray(0, 24);
    assert.equal(pngHeader.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'og-image.png should be a valid PNG');
    const width = String(pngHeader.readUInt32BE(16));
    const height = String(pngHeader.readUInt32BE(20));

    const expectedOgImageUrl = 'https://googlechrome.github.io/modern-web-guidance-src/og-image.png';
    const pages: Array<[string, string | undefined]> = [
        ['index.html', 'https://googlechrome.github.io/modern-web-guidance-src/'],
        // Query-parameterized templates (?testId=, ?guide=) omit static og:url so unfurlers preserve deep links.
        ['dashboard.html', undefined],
        ['guide.html', undefined],
        ['search/index.html', 'https://googlechrome.github.io/modern-web-guidance-src/search/'],
        ['demos/index.html', 'https://googlechrome.github.io/modern-web-guidance-src/demos/'],
    ];

    for (const [relPath, expectedUrl] of pages) {
        const html = fs.readFileSync(path.join(dashboardDir, relPath), 'utf8');
        const getMeta = (attr: 'property' | 'name', key: string) =>
            html.match(new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]+)"`))?.[1];

        assert.equal(getMeta('property', 'og:type'), 'website', `${relPath} og:type`);
        assert.equal(getMeta('property', 'og:site_name'), 'Modern Web Guidance Evals', `${relPath} og:site_name`);
        assert.equal(getMeta('property', 'og:url'), expectedUrl, `${relPath} og:url`);
        assert.equal(getMeta('property', 'og:image'), expectedOgImageUrl, `${relPath} og:image`);
        assert.equal(getMeta('property', 'og:image:type'), 'image/png', `${relPath} og:image:type`);
        assert.equal(getMeta('property', 'og:image:width'), width, `${relPath} og:image:width`);
        assert.equal(getMeta('property', 'og:image:height'), height, `${relPath} og:image:height`);
        assert.ok((getMeta('property', 'og:title') ?? '').length > 0, `${relPath} og:title`);
        assert.ok((getMeta('property', 'og:description') ?? '').length > 0, `${relPath} og:description`);
        assert.ok((getMeta('property', 'og:image:alt') ?? '').length > 0, `${relPath} og:image:alt`);
        assert.equal(getMeta('name', 'twitter:card'), 'summary_large_image', `${relPath} twitter:card`);
        assert.ok((getMeta('name', 'twitter:title') ?? '').length > 0, `${relPath} twitter:title`);
        assert.ok((getMeta('name', 'twitter:description') ?? '').length > 0, `${relPath} twitter:description`);
        assert.equal(getMeta('name', 'twitter:image'), expectedOgImageUrl, `${relPath} twitter:image`);
        assert.ok((getMeta('name', 'twitter:image:alt') ?? '').length > 0, `${relPath} twitter:image:alt`);
    }
});
