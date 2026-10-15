import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { generateDemosManifest, stagePages, formatCategoryTitle } from './generate-manifests.js';
import { rootDir } from '../core/paths.ts';

let tempDir = '';
let testOutputDir = '';

before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demos-manifest-test-'));
    testOutputDir = path.join(tempDir, 'dashboard');
    fs.mkdirSync(testOutputDir, { recursive: true });
});

after(() => {
    if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('formatCategoryTitle converts slug to readable name', () => {
    assert.strictEqual(formatCategoryTitle('css'), 'CSS');
    assert.strictEqual(formatCategoryTitle('js'), 'JavaScript');
    assert.strictEqual(formatCategoryTitle('built-in-ai'), 'Built-in AI');
    assert.strictEqual(formatCategoryTitle('ui-behaviors'), 'UI Behaviors');
    assert.strictEqual(formatCategoryTitle('performance'), 'Performance');
});

test('generateDemosManifest generates valid manifest files', () => {
    const manifest = generateDemosManifest(testOutputDir);

    assert.ok(manifest);
    assert.ok(manifest.count > 150, `Expected > 150 guides with demos, found ${manifest.count}`);
    assert.ok(Array.isArray(manifest.categories));
    assert.ok(manifest.categories.length > 5);
    assert.ok(manifest.categories.includes('css'));
    assert.ok(manifest.categories.includes('forms'));

    // Check JSON output
    const jsonPath = path.join(testOutputDir, 'demos.gen.json');
    assert.ok(fs.existsSync(jsonPath), 'demos.gen.json must exist');
    const parsedJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.strictEqual(parsedJson.count, manifest.count);

    // Check JS output
    const jsPath = path.join(testOutputDir, 'demos.gen.js');
    assert.ok(fs.existsSync(jsPath), 'demos.gen.js must exist');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    assert.ok(jsContent.startsWith('// Automatically generated'));
    assert.ok(jsContent.includes('window.__demosManifest ='));

    // Verify individual guide structure
    for (const guide of manifest.guides) {
        assert.ok(guide.id, 'Guide must have an id');
        assert.ok(guide.title, `Guide ${guide.id} must have a title`);
        assert.ok(guide.category, `Guide ${guide.id} must have a category`);
        assert.ok(guide.categoryTitle, `Guide ${guide.id} must have a categoryTitle`);
        assert.ok(guide.dir, `Guide ${guide.id} must have a dir`);
        assert.ok(Array.isArray(guide.demos), `Guide ${guide.id} must have a demos array`);
        assert.ok(guide.demos.length > 0, `Guide ${guide.id} must have at least one demo`);

        for (const demo of guide.demos) {
            assert.ok(demo.id, `Demo in ${guide.id} must have an id`);
            assert.ok(demo.file, `Demo in ${guide.id} must have a file`);
            assert.ok(demo.path, `Demo in ${guide.id} must have a path`);

            // Verify file exists on disk in guidesDir
            const diskPath = path.join(rootDir, demo.path);
            assert.ok(fs.existsSync(diskPath), `Demo file on disk should exist: ${demo.path}`);
        }
    }
});

test('stagePages copies demo HTML and static assets to stageDir/guides', () => {
    const stageDir = path.join(tempDir, 'staged-pages');
    stagePages(stageDir, testOutputDir);

    assert.ok(fs.existsSync(stageDir), 'Stage directory must exist');
    const guidesStageDir = path.join(stageDir, 'guides');
    assert.ok(fs.existsSync(guidesStageDir), 'Stage guides directory must exist');

    // Verify demos.html, demos.js, demos.css exist
    assert.ok(fs.existsSync(path.join(stageDir, 'demos.html')), 'demos.html must be staged');
    assert.ok(fs.existsSync(path.join(stageDir, 'demos.js')), 'demos.js must be staged');
    assert.ok(fs.existsSync(path.join(stageDir, 'demos.css')), 'demos.css must be staged');

    // Verify demos.gen.json was copied
    assert.ok(fs.existsSync(path.join(stageDir, 'demos.gen.json')), 'demos.gen.json must be staged');

    // Verify demo.html files were staged under guides/
    const stagedDemoPath = path.join(guidesStageDir, 'css/animate-to-intrinsic-sizes/demo.html');
    assert.ok(fs.existsSync(stagedDemoPath), `Expected demo file staged at ${stagedDemoPath}`);

    // Verify targets/ directory was NOT copied
    const stagedTargetsPath = path.join(guidesStageDir, 'css/animate-to-intrinsic-sizes/targets');
    assert.ok(!fs.existsSync(stagedTargetsPath), 'targets/ should NOT be staged');

    // Verify no .ts or .md files in staged guides
    function checkNoSourceFiles(dir: string) {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                checkNoSourceFiles(fullPath);
            } else {
                assert.ok(!item.name.endsWith('.ts'), `Found forbidden .ts file in staged output: ${fullPath}`);
                assert.ok(!item.name.endsWith('.md'), `Found forbidden .md file in staged output: ${fullPath}`);
                assert.ok(!item.name.endsWith('.patch'), `Found forbidden .patch file in staged output: ${fullPath}`);
            }
        }
    }
    checkNoSourceFiles(guidesStageDir);
});
