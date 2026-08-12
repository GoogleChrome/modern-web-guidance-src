import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { features } from 'web-features';
import { scanAllGuides, scanDisciplineSkills } from '../lib/guide-validation.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pendingPath = path.resolve(__dirname, '../features/pending-web-features.json');
const featuresDir = path.resolve(__dirname, '../features');
const atlsPath = path.resolve(__dirname, '../guides/atls.json');

const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) as Record<string, unknown>;
let hasError = false;

// 1. Check for unregistered features/tmp-*.md files
const featureFiles = fs.readdirSync(featuresDir);
const unregisteredSnippetFiles: string[] = [];
for (const file of featureFiles) {
  if (file.startsWith('tmp-') && file.endsWith('.md')) {
    const tmpId = file.slice(0, -3); // remove .md
    if (!(tmpId in pending)) {
      unregisteredSnippetFiles.push(file);
    }
  }
}

if (unregisteredSnippetFiles.length > 0) {
  console.error('❌ Unregistered temporary feature snippet files found in features/:');
  for (const file of unregisteredSnippetFiles) {
    console.error(`  - ${file} (must be registered in features/pending-web-features.json)`);
  }
  hasError = true;
}

// 2. Scan all feature references across guides, skills, and atls.json
const featureToLocations = new Map<string, Set<string>>();
const recordLocation = (fid: string, location: string) => {
  if (!featureToLocations.has(fid)) featureToLocations.set(fid, new Set());
  featureToLocations.get(fid)!.add(location);
};

const allGuides = [...scanAllGuides(), ...scanDisciplineSkills()];
for (const guide of allGuides) {
  const relPath = path.relative(path.resolve(__dirname, '..'), guide.dir);
  const guideMd = path.join(guide.dir, 'guide.md');
  const fileToReport = fs.existsSync(guideMd) ? path.join(relPath, 'guide.md') : relPath;
  for (const fid of guide.featureIds) {
    recordLocation(fid, fileToReport);
  }
}

if (fs.existsSync(atlsPath)) {
  const atlsConfig = JSON.parse(fs.readFileSync(atlsPath, 'utf8'));
  for (const fid of Object.keys(atlsConfig.web_features || {})) {
    recordLocation(fid, 'guides/atls.json');
  }
}

// 3. Check for expired / graduating registered temporary feature IDs (primary, moved, or split)
interface ExpiredTempItem {
  tmpId: string;
  realId: string;
  kind: 'feature' | 'moved' | 'split';
  redirectTarget?: string;
  redirectTargets?: string[];
  hasSnippet: boolean;
  snippetFile: string;
  locations: string[];
}

const expiredTemps: ExpiredTempItem[] = [];
for (const id of Object.keys(pending)) {
  if (!id.startsWith('tmp-')) continue;
  const realId = id.slice(4);
  const feat = features[realId] as any;
  if (!feat) continue;

  const hasSnippet = fs.existsSync(path.join(featuresDir, `${id}.md`));
  const snippetFile = `features/${id}.md`;
  const locations = Array.from(featureToLocations.get(id) || []);

  if (feat.kind === 'moved') {
    expiredTemps.push({
      tmpId: id,
      realId,
      kind: 'moved',
      redirectTarget: feat.redirect_target,
      hasSnippet,
      snippetFile,
      locations,
    });
  } else if (feat.kind === 'split') {
    expiredTemps.push({
      tmpId: id,
      realId,
      kind: 'split',
      redirectTargets: feat.redirect_targets || [],
      hasSnippet,
      snippetFile,
      locations,
    });
  } else {
    expiredTemps.push({
      tmpId: id,
      realId,
      kind: 'feature',
      hasSnippet,
      snippetFile,
      locations,
    });
  }
}

if (expiredTemps.length > 0) {
  hasError = true;
  console.log('⚠️ Expired/graduated temporary feature IDs detected:');
  for (const item of expiredTemps) {
    if (item.kind === 'split') {
      console.log(`  - ${item.tmpId} was split upstream into: ${item.redirectTargets?.join(', ')}`);
    } else if (item.kind === 'moved') {
      console.log(`  - ${item.tmpId} was moved upstream to: "${item.redirectTarget}"`);
    } else {
      console.log(`  - ${item.tmpId} is now available upstream as "${item.realId}"`);
    }
    if (item.hasSnippet) {
      console.log(`    ↳ Remember to remove or rename ${item.snippetFile}`);
    }
    if (item.locations.length > 0) {
      console.log('    ↳ Referenced in:');
      for (const loc of item.locations) {
        console.log(`      • ${loc}`);
      }
    }
  }
}

// 4. Scan regular feature IDs for upstream moved/split status
interface ChangedRegularFeature {
  fid: string;
  kind: 'moved' | 'split';
  target?: string;
  targets?: string[];
  locations: string[];
}

const changedRegularFeatures: ChangedRegularFeature[] = [];
for (const [fid, locationsSet] of featureToLocations.entries()) {
  if (fid.startsWith('tmp-')) continue;
  const feat = features[fid] as any;
  if (!feat) continue;
  const locations = Array.from(locationsSet);

  if (feat.kind === 'moved') {
    changedRegularFeatures.push({
      fid,
      kind: 'moved',
      target: feat.redirect_target,
      locations,
    });
    hasError = true;
  } else if (feat.kind === 'split') {
    changedRegularFeatures.push({
      fid,
      kind: 'split',
      targets: feat.redirect_targets || [],
      locations,
    });
    hasError = true;
  }
}

if (changedRegularFeatures.length > 0) {
  console.log('⚡ Upstream moved or split feature records affecting regular feature IDs:');
  for (const item of changedRegularFeatures) {
    if (item.kind === 'split') {
      console.log(`  - "${item.fid}" was split upstream into: ${item.targets?.join(', ')}`);
    } else {
      console.log(`  - "${item.fid}" was moved upstream to: "${item.target}"`);
    }
    if (item.locations.length > 0) {
      console.log('    ↳ Referenced in:');
      for (const loc of item.locations) {
        console.log(`      • ${loc}`);
      }
    }
  }
}

// Write structured Markdown comment body to GITHUB_OUTPUT if any items were flagged
if (process.env.GITHUB_OUTPUT && (expiredTemps.length > 0 || changedRegularFeatures.length > 0)) {
  const sections: string[] = [
    '⚠️ **Action Required**: This automated `web-features` update introduced official feature IDs or platform record shifts (`moved` / `split`) affecting guidance in this repository.\n'
  ];

  if (expiredTemps.length > 0) {
    sections.push('### 1. Graduated Temporary Feature IDs (`tmp-*`)');
    for (const item of expiredTemps) {
      if (item.kind === 'split') {
        sections.push(`- **⚠️ \`${item.tmpId}\` was split upstream into:** \`${item.redirectTargets?.join('`, `')}\` — inspect affected files to assign appropriate sub-feature ID(s)`);
      } else if (item.kind === 'moved') {
        sections.push(`- **\`${item.tmpId}\` was moved upstream to:** \`${item.redirectTarget}\``);
      } else {
        sections.push(`- **\`${item.tmpId}\` → \`${item.realId}\`** (Primary feature available upstream)`);
      }
      if (item.hasSnippet) {
        sections.push(`  ↳ *Action:* Rename or delete \`${item.snippetFile}\``);
      }
      if (item.locations.length > 0) {
        sections.push('  ↳ *Referenced in:*');
        for (const loc of item.locations) {
          sections.push(`    - \`${loc}\``);
        }
      }
    }
    sections.push('');
  }

  if (changedRegularFeatures.length > 0) {
    sections.push('### 2. Regular Feature Records Split or Moved Upstream');
    for (const item of changedRegularFeatures) {
      if (item.kind === 'split') {
        sections.push(`- **⚡ \`${item.fid}\` was split upstream into:** \`${item.targets?.join('`, `')}\` — assign appropriate sub-feature ID(s).`);
      } else {
        sections.push(`- **\`${item.fid}\` was moved upstream to:** \`${item.target}\` — update reference to target ID.`);
      }
      if (item.locations.length > 0) {
        sections.push('  ↳ *Referenced in:*');
        for (const loc of item.locations) {
          sections.push(`    - \`${loc}\``);
        }
      }
    }
    sections.push('');
  }

  sections.push('Before merging this PR, please resolve the items flagged above and re-run guide validation checks.');

  const delimiter = `EOF_${Date.now()}`;
  const commentBody = sections.join('\n');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `comment_body<<${delimiter}\n${commentBody}\n${delimiter}\n`);
}

if (hasError) {
  process.exit(1);
} else {
  console.log('✅ All temporary and regular feature IDs are valid and active upstream.');
  process.exit(0);
}
