import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { globSync } from 'glob';
import { config } from '../../lib/skills-config.ts';

const repoRoot = path.resolve(import.meta.dirname, '../../');

interface AuditRecord {
  filePath: string;
  name: string;
  category: string;
  type: 'EXPOSED_DIST' | 'BUNDLED_GUIDE' | 'BUNDLED_INTERFACE' | 'UNMERGED_DRAFT' | 'INERT' | 'INTERNAL_AGENT';
  description: string;
}

function auditBuild() {
  console.log('🔍 Auditing Skills Architecture against Configuration...\n');

  const records: AuditRecord[] = [];

  // 1. Find all SKILL.md files
  const skillFiles = globSync(['**/SKILL.md'], {
    cwd: repoRoot,
    ignore: ['**/node_modules/**', '**/dist/**'],
    absolute: false,
  });

  // 2. Find all internalized discipline guides (guides/<cat>/<cat>/guide.md)
  const disciplineGuides = globSync(['guides/*/*/guide.md'], {
    cwd: repoRoot,
    ignore: ['**/node_modules/**', '**/dist/**'],
    absolute: false,
  }).filter(f => {
    const parts = f.split('/');
    return parts.length === 4 && parts[1] === parts[2];
  });

  const allFiles = [...skillFiles, ...disciplineGuides].sort();

  const bundledSet = new Set(config.monoskill.bundledCategories);
  const standaloneSet = new Set(config.standaloneSkills.map(s => s.name));

  for (const relPath of allFiles) {
    const absPath = path.join(repoRoot, relPath);
    const content = fs.readFileSync(absPath, 'utf8');
    const { data } = matter(content);

    const isSKILL = relPath.endsWith('SKILL.md');
    const parts = relPath.split('/');
    const folderName = parts[parts.length - 2];
    const name = data.name || folderName;
    const category = parts[1];

    let type: AuditRecord['type'] = 'INERT';

    if (relPath.startsWith('.agents/skills/')) {
      type = 'INTERNAL_AGENT';
    } else if (folderName.startsWith('megaskill-')) {
      type = 'INERT';
    } else if (standaloneSet.has(folderName) || standaloneSet.has(name)) {
      type = 'EXPOSED_DIST';
    } else if (!isSKILL && bundledSet.has(category)) {
      type = 'BUNDLED_GUIDE';
    } else if (isSKILL && (bundledSet.has(folderName) || bundledSet.has(name))) {
      const targetCat = bundledSet.has(folderName) ? folderName : name;
      const targetGuideDir = path.join(repoRoot, 'guides', targetCat);
      if (fs.existsSync(targetGuideDir)) {
        type = 'BUNDLED_INTERFACE';
      } else {
        type = 'UNMERGED_DRAFT';
      }
    }

    records.push({
      filePath: relPath,
      name,
      category,
      type,
      description: data.description ? data.description.trim().split('\n')[0] : 'No description',
    });
  }

  // Print beautiful grouped report
  const groups: Record<AuditRecord['type'], { title: string; symbol: string }> = {
    EXPOSED_DIST: { title: 'Exposed in dist/ Distribution (Standalone / Primary Monoskill)', symbol: '🟢' },
    BUNDLED_GUIDE: { title: 'Active Bundled Core Guides (Internalized Discipline Files)', symbol: '🔵' },
    BUNDLED_INTERFACE: { title: 'Active Source Interfaces for Bundled Guides', symbol: '🛡️' },
    UNMERGED_DRAFT: { title: 'Unmerged Draft Disciplines (Configured but Missing guides/ Folder)', symbol: '🟡' },
    INERT: { title: 'Inert Files (Sub-skills / Drafts / Megaskill Experiments)', symbol: '⚪' },
    INTERNAL_AGENT: { title: 'Internal Repo-Maintenance Bot Skills (.agents/)', symbol: '⚙️' },
  };

  for (const [typeKey, meta] of Object.entries(groups)) {
    const matching = records.filter(r => r.type === typeKey);
    if (matching.length === 0) continue;

    console.log(`${meta.symbol} **${meta.title}** (${matching.length})`);
    for (const r of matching) {
      const paddedName = `**${r.name}**`.padEnd(28);
      console.log(`   - ${paddedName} -> \`${r.filePath}\``);
    }
    console.log('');
  }

  // Final consistency validation checks
  console.log('--- Consistency Checks ---');
  const missingKeywords = config.monoskill.requiredKeywords.filter(kw => {
    const monoskillPath = path.join(repoRoot, 'guides/modern-web-guidance/SKILL.md');
    if (!fs.existsSync(monoskillPath)) return true;
    return !fs.readFileSync(monoskillPath, 'utf8').includes(kw);
  });

  if (missingKeywords.length > 0) {
    console.log(`❌ Monoskill description missing mandatory keywords: ${missingKeywords.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('✅ Monoskill explicitly incorporates all mandatory keywords.');
  }

  const unmerged = records.filter(r => r.type === 'UNMERGED_DRAFT');
  if (unmerged.length > 0) {
    console.log(`⚠️  Found ${unmerged.length} configured categories lacking active guides/ folders (waiting on PRs).`);
  }
}

auditBuild();
