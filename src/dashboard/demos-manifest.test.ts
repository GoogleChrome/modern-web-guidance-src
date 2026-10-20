import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { generateDemosManifest, stagePages } from './generate-manifests.js';
import { rootDir } from '../core/paths.ts';

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
        'demos/index.html',
        'demos/demos.js',
        'demos/demos.css',
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
