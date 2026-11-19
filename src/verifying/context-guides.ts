/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * `modern-web-guidance context-guides` — Maps `git diff` + touched HTML/CSS/JS files to
 * the top relevant Modern Web Guidance (MWG) guide IDs by calling `legacy-scan`,
 * `searchUseCases`, and `getGuide` directly in-process, paired with bespoke-glue
 * maintainability detection.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getGuide } from '../rag/guides.ts';
import { searchUseCases } from '../rag/search.ts';
import { detectProjectConfig, discoverTouchedFilesAndRoutes } from './discovery.ts';
import { stripCommentsPreservingLines } from './source-lexer.ts';
import {
  filterVerifiedGuides,
  getVerifiedMwgGuideSet,
  scanTouchedFilesWithLegacyScan,
} from './static-pass.ts';
import type {
  ActivePackName,
  ContextGuideItem,
  ContextGuidesOptions,
  ContextGuidesResult,
  MaintainabilityHint,
} from './types.ts';

interface CapabilityQueryTrigger {
  pattern: RegExp;
  query: string;
  fallbackGuides: string[];
  reason: string;
  weight: number;
}

const CAPABILITY_QUERY_TRIGGERS: CapabilityQueryTrigger[] = [
  {
    pattern: /\b(?:modal|dialog|lightbox|drawer|sheet|backdrop|showModal|aria-modal|closedby)\b/i,
    query: 'light dismiss modal dialog',
    fallbackGuides: ['dialog', 'light-dismiss-a-dialog', 'declarative-dialog-popover-control'],
    reason: 'Modal, dialog, or drawer overlay interaction',
    weight: 4,
  },
  {
    pattern:
      /\b(?:tooltip|hovercard|popover|interestfor|popovertarget|getBoundingClientRect|floating-ui|popper)\b/i,
    query: 'position aware tooltip popover anchor',
    fallbackGuides: ['position-aware-tooltips', 'interest-triggered-tooltips', 'hovercard'],
    reason: 'Tooltip, hovercard, or anchored popover positioning',
    weight: 4,
  },
  {
    pattern: /\b(?:dropdown|contextmenu|menubar|menuitem|aria-haspopup|command-menu)\b/i,
    query: 'viewport aware dropdown menu',
    fallbackGuides: ['menu', 'app-menus', 'viewport-aware-dropdowns'],
    reason: 'Dropdown or application menu component',
    weight: 3.5,
  },
  {
    pattern: /\b(?:tablist|tabpanel|activeTab|selectedTab|role=["']tab["'])\b/i,
    query: 'accessible tabs navigation indicator',
    fallbackGuides: ['tabs', 'anchor-positioning-tab-underline'],
    reason: 'Tabbed interface navigation',
    weight: 3.5,
  },
  {
    pattern: /\b(?:accordion|collapsible|<details\b|<summary\b)\b/i,
    query: 'accordion collapsible details summary',
    fallbackGuides: ['accordion', 'interactive-content-reveal'],
    reason: 'Accordion or progressive disclosure section',
    weight: 3.5,
  },
  {
    pattern: /\b(?:carousel|swiper|embla|scroll-snap|slideIndex|nextSlide|prevSlide)\b/i,
    query: 'scroll snap carousel gallery',
    fallbackGuides: ['carousel', 'carousel-snap-highlights'],
    reason: 'Carousel or scroll-snap gallery',
    weight: 3.5,
  },
  {
    pattern:
      /<(?:table|thead|tbody|th)\b|\b(?:datagrid|data-table|sortBy|sortDirection|aria-sort|useReactTable)\b/i,
    query: 'responsive sortable data table',
    fallbackGuides: ['sortable-table', 'responsive-table'],
    reason: 'Data table layout or column sorting',
    weight: 3.5,
  },
  {
    pattern:
      /\b(?:cc-number|cardnumber|card-number|cvv|cvc|expiry|payment|billingAddress|shippingAddress)\b/i,
    query: 'autofill payment address checkout form',
    fallbackGuides: ['autofill-payment-form', 'autofill-address-form', 'forms'],
    reason: 'Payment or shipping address checkout form',
    weight: 4,
  },
  {
    pattern: /\b(?:passkey|webauthn|navigator\.credentials|PublicKeyCredential)\b/i,
    query: 'passkey authentication registration',
    fallbackGuides: ['passkeys', 'passkey-authentication', 'passkey-registration'],
    reason: 'Passkey / WebAuthn authentication',
    weight: 4,
  },
  {
    pattern:
      /<(?:form|input|select|textarea)\b|\b(?:onInvalid|setCustomValidity|aria-invalid|user-invalid|field-sizing)\b/i,
    query: 'validate form input after interaction',
    fallbackGuides: [
      'forms',
      'validate-input-after-interaction',
      'accessible-error-announcement',
    ],
    reason: 'Form controls, sizing, and validation feedback',
    weight: 2.5,
  },
  {
    pattern:
      /\b(?:dark-mode|darkMode|prefers-color-scheme|color-scheme|light-dark\(|themeToggle)\b/i,
    query: 'dark mode theme toggle color scheme',
    fallbackGuides: ['dark-mode', 'dark-mode-toggle', 'browser-ui-theming'],
    reason: 'Light/dark theming and color contrast',
    weight: 3,
  },
  {
    pattern:
      /\b(?:startViewTransition|view-transition-name|@view-transition|animate\(|@keyframes|@starting-style)\b/i,
    query: 'animate element entry exit view transition',
    fallbackGuides: [
      'same-document-transitions',
      'animate-element-entry-exit',
      'animate-to-from-top-layer',
    ],
    reason: 'View transitions or entry/exit motion',
    weight: 3,
  },
  {
    pattern:
      /<(?:img|picture|video|source)\b|\b(?:fetchpriority|srcset|sizes|content-visibility)\b/i,
    query: 'optimize image fetch priority lazy load',
    fallbackGuides: [
      'optimize-image-priority',
      'lazy-load-video-and-audio',
      'defer-rendering-heavy-content',
    ],
    reason: 'Media loading priority and offscreen rendering',
    weight: 2.8,
  },
  {
    pattern:
      /\b(?:innerHTML|dangerouslySetInnerHTML|v-html|DOMPurify|TrustedTypes|setHTML|postMessage)\b/i,
    query: 'sanitize untrusted html trusted types',
    fallbackGuides: ['sanitize-untrusted-html', 'trusted-types', 'validate-origins'],
    reason: 'HTML sanitization, Trusted Types, or cross-origin messaging',
    weight: 4,
  },
  {
    pattern:
      /\b(?:addEventListener|AbortController|requestIdleCallback|scheduler\.yield|setInterval)\b/i,
    query: 'coordinate global event listeners break up long tasks',
    fallbackGuides: [
      'coordinate-global-events',
      'break-up-long-tasks',
      'schedule-tasks-by-priority',
    ],
    reason: 'Global event listener lifecycle and main-thread task scheduling',
    weight: 2.5,
  },
  {
    pattern: /\b(?:navigator\.modelContext|webmcp|registerTool)\b/i,
    query: 'webmcp agentic forms javascript tools',
    fallbackGuides: ['webmcp', 'agentic-forms', 'agentic-javascript-tools'],
    reason: 'WebMCP agentic browser integration',
    weight: 4,
  },
];

const PACK_PRIORITY_GUIDES: Record<ActivePackName, string[]> = {
  commerce: [
    'autofill-payment-form',
    'autofill-address-form',
    'validate-input-after-interaction',
    'dialog',
    'light-dismiss-a-dialog',
  ],
  media: [
    'optimize-image-priority',
    'lazy-load-video-and-audio',
    'defer-rendering-heavy-content',
    'persistent-top-layer-ui',
    'css-layout',
  ],
  saas: [
    'sortable-table',
    'responsive-table',
    'declarative-dialog-popover-control',
    'coordinate-global-events',
    'defer-rendering-heavy-content',
  ],
};

const BESPOKE_GLUE_DETECTORS: Array<{
  id: string;
  pattern: RegExp;
  guides: string[];
  reason: string;
}> = [
  {
    id: 'bespoke-focus-trap',
    pattern: /querySelectorAll\s*\(\s*['"][^'"]*button[^'"]*\[tabindex/i,
    guides: ['dialog', 'light-dismiss-a-dialog'],
    reason: 'Manual JS Tab/focus-trap selector query replaceable by native `<dialog>.showModal()`.',
  },
  {
    id: 'bespoke-outside-click-escape',
    pattern:
      /addEventListener\s*\(\s*['"](?:mousedown|pointerdown|click)['"][\s\S]{0,600}?addEventListener\s*\(\s*['"]keydown['"]/i,
    guides: [
      'light-dismiss-a-dialog',
      'declarative-dialog-popover-control',
      'position-aware-tooltips',
    ],
    reason:
      'Bespoke outside-click + keydown dismissal state machine replaceable by `<dialog closedby="any">` or `[popover="auto"]`.',
  },
  {
    id: 'bespoke-floating-geometry',
    pattern:
      /getBoundingClientRect\s*\(\s*\)[\s\S]{0,600}?(?:ResizeObserver|MutationObserver|innerWidth|innerHeight)/i,
    guides: ['position-aware-tooltips', 'viewport-aware-dropdowns'],
    reason:
      'Manual JS geometry/observer positioning glue replaceable by CSS Anchor Positioning (`anchor-name`, `position-area`, `position-try-fallbacks`).',
  },
  {
    id: 'bespoke-scroll-observer-header',
    pattern:
      /addEventListener\s*\(\s*['"]scroll['"][\s\S]{0,350}?(?:scrollY|scrollTop)\s*[<>]=?\s*\d+/i,
    guides: [
      'state-aware-sticky-headers',
      'shrinking-header-on-scroll',
      'scroll-entry-exit-effects',
    ],
    reason:
      'Main-thread `scroll` threshold listener replaceable by CSS `@container scroll-state(stuck: top)` or `animation-timeline: scroll()`.',
  },
];

function extractGitAddedLines(workspaceDir: string, touchedFiles: readonly string[]): string {
  if (touchedFiles.length === 0) return '';
  try {
    let diffOut = execFileSync('git', ['diff', '-U0', 'HEAD', '--', ...touchedFiles], {
      cwd: workspaceDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    });
    if (!diffOut.trim()) {
      diffOut = execFileSync('git', ['diff', '-U0', 'HEAD~1', 'HEAD', '--', ...touchedFiles], {
        cwd: workspaceDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 2000,
      });
    }
    const added: string[] = [];
    for (const line of diffOut.split(/\r?\n/)) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        added.push(line.slice(1));
      }
    }
    return added.join('\n');
  } catch {
    return '';
  }
}

async function resolveGuideMarkdown(
  guideId: string,
  customGuidesDir?: string,
): Promise<string | null> {
  if (customGuidesDir && existsSync(customGuidesDir)) {
    const direct = path.join(customGuidesDir, `${guideId}.md`);
    if (existsSync(direct)) {
      return readFileSync(direct, 'utf8');
    }
    try {
      for (const entry of readdirSync(customGuidesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const nested = path.join(customGuidesDir, entry.name, `${guideId}.md`);
        if (existsSync(nested)) return readFileSync(nested, 'utf8');
      }
    } catch {
      // Fall back to built-in corpus
    }
  }
  return getGuide(guideId);
}

export async function resolveContextGuides(
  options: ContextGuidesOptions = {},
): Promise<ContextGuidesResult> {
  const startedAt = performance.now();
  const workspaceDir = path.resolve(options.workspaceDir || process.cwd());
  const limit = Math.max(1, Math.min(25, Number(options.limit) || 8));
  const includeContent = Boolean(options.includeContent);

  const project = detectProjectConfig(workspaceDir, { pack: options.pack });
  const discovery =
    Array.isArray(options.files) && options.files.length > 0
      ? { touchedFiles: options.files, routes: ['/'], discoverySource: 'explicit' as const }
      : discoverTouchedFilesAndRoutes(workspaceDir, { allFiles: Boolean(options.allFiles) });

  const guideSet = getVerifiedMwgGuideSet();
  const scoreByGuide = new Map<string, number>();
  const reasonsByGuide = new Map<string, Set<string>>();

  const bumpGuide = (id: string, points: number, reason?: string): void => {
    if (!id || !guideSet.has(id)) return;
    scoreByGuide.set(id, (scoreByGuide.get(id) || 0) + points);
    if (reason) {
      let set = reasonsByGuide.get(id);
      if (!set) {
        set = new Set<string>();
        reasonsByGuide.set(id, set);
      }
      if (set.size < 3) set.add(reason);
    }
  };

  const fileTexts: string[] = [];
  const maintainabilityHints: MaintainabilityHint[] = [];

  for (const relPath of discovery.touchedFiles) {
    const absPath = path.join(workspaceDir, relPath);
    if (!existsSync(absPath)) continue;
    let raw: string;
    try {
      raw = readFileSync(absPath, 'utf8').slice(0, 100_000);
    } catch {
      continue;
    }
    const ext = path.extname(relPath).toLowerCase();
    const stripped = stripCommentsPreservingLines(raw, ext);
    fileTexts.push(stripped);

    const lineCount = raw.split('\n').length;
    for (const detector of BESPOKE_GLUE_DETECTORS) {
      if (detector.pattern.test(stripped)) {
        const validGuides = filterVerifiedGuides(detector.guides, guideSet);
        for (const g of validGuides) {
          bumpGuide(g, 5, `${relPath}: ${detector.reason}`);
        }
        maintainabilityHints.push({
          file: relPath,
          lineCount,
          ruleId: detector.id,
          reason: detector.reason,
          guides: validGuides,
        });
      }
    }

    if (lineCount >= 160 && /\.(?:jsx|tsx|vue|svelte|js|ts)$/i.test(relPath)) {
      const effectMatches =
        stripped.match(/\b(?:useEffect|useLayoutEffect|addEventListener)\s*\(/g) ?? [];
      if (effectMatches.length >= 4) {
        maintainabilityHints.push({
          file: relPath,
          lineCount,
          ruleId: 'bespoke-effect-heavy-component',
          reason:
            `${lineCount}-line component coordinates ${effectMatches.length} effect/event-listener hooks; check if native HTML/CSS (` +
            '`<dialog>`, `[popover]`, CSS Anchor Positioning, `:has()`, `@container`) can replace imperative state glue.',
          guides: filterVerifiedGuides(['html', 'css', 'coordinate-global-events'], guideSet),
        });
      }
    }
  }

  // 1. Run `legacy-scan` in-process on touched files.
  const legacyScan = await scanTouchedFilesWithLegacyScan(workspaceDir, discovery.touchedFiles);
  for (const f of legacyScan.findings) {
    for (const gid of f.guides) {
      bumpGuide(gid, 6.0, `legacy-scan (${f.file}:${f.line}): ${f.message}`);
    }
  }

  // 2. Extract focused capability queries from git diff + touched files and query `searchUseCases` in-process.
  const diffAddedText = extractGitAddedLines(workspaceDir, discovery.touchedFiles);
  const fullTouchedText = fileTexts.join('\n');

  const matchedTriggers: Array<{ trigger: CapabilityQueryTrigger; boost: number }> = [];
  for (const trigger of CAPABILITY_QUERY_TRIGGERS) {
    const inDiff = Boolean(diffAddedText) && trigger.pattern.test(diffAddedText);
    const inFull = !inDiff && Boolean(fullTouchedText) && trigger.pattern.test(fullTouchedText);
    if (!inDiff && !inFull) continue;
    matchedTriggers.push({ trigger, boost: inDiff ? 1.5 : 1.0 });
  }

  let anySearchHit = false;
  for (const { trigger, boost } of matchedTriggers) {
    try {
      const results = await searchUseCases(trigger.query, 4);
      if (results.length > 0) {
        anySearchHit = true;
        for (const r of results) {
          const pts = trigger.weight * boost * Math.max(0.5, r.similarity || 0.75);
          bumpGuide(r.id, pts, trigger.reason);
        }
      } else {
        for (const gid of trigger.fallbackGuides) {
          bumpGuide(gid, trigger.weight * boost, trigger.reason);
        }
      }
    } catch {
      for (const gid of trigger.fallbackGuides) {
        bumpGuide(gid, trigger.weight * boost, trigger.reason);
      }
    }
  }

  if (!anySearchHit && matchedTriggers.length > 0) {
    for (const { trigger, boost } of matchedTriggers) {
      for (const gid of trigger.fallbackGuides) {
        bumpGuide(gid, trigger.weight * boost, trigger.reason);
      }
    }
  }

  // 3. Apply active vertical pack boost when relevant files are touched.
  if (project.pack && discovery.touchedFiles.length > 0) {
    for (const gid of PACK_PRIORITY_GUIDES[project.pack]) {
      bumpGuide(gid, 2.0, `Active vertical pack (${project.pack})`);
    }
  }

  const ranked = [...scoreByGuide.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);

  const guides: ContextGuideItem[] = await Promise.all(
    ranked.map(async ([id, score]): Promise<ContextGuideItem> => {
      const item: ContextGuideItem = {
        id,
        score: Math.round(score * 100) / 100,
        reasons: [...(reasonsByGuide.get(id) ?? [])],
      };
      if (includeContent) {
        const content = await resolveGuideMarkdown(id, options.mwgGuidesDir);
        if (content) {
          item.content = content;
          item.source = 'local-corpus';
        }
      }
      return item;
    }),
  );

  const guideIds = guides.map((g) => g.id);
  const retrieveCommand =
    guideIds.length > 0
      ? `npx -y modern-web-guidance@latest retrieve "${guideIds.join(',')}"`
      : null;

  return {
    durationMs: Math.round(performance.now() - startedAt),
    workspaceDir,
    framework: project.framework,
    frameworkName: project.frameworkName,
    pack: project.pack,
    touchedFiles: discovery.touchedFiles,
    routes: discovery.routes,
    guideIds,
    retrieveCommand,
    guides,
    maintainabilityHints,
  };
}

export function formatContextGuidesReport(result: ContextGuidesResult): string {
  const packLabel = result.pack ? ` | pack: ${result.pack}` : '';
  const lines = [
    `🧭 modern-web-guidance context-guides (${result.durationMs}ms | ${result.frameworkName}${packLabel} | touched: ${result.touchedFiles.length} file(s))`,
  ];

  if (result.guides.length === 0) {
    lines.push('No specific Modern Web Guidance topics matched the current diff.');
    return lines.join('\n');
  }

  lines.push('');
  lines.push('Top Relevant MWG Guides:');
  for (const g of result.guides) {
    lines.push(`  • ${g.id} (score ${g.score}) — ${g.reasons.join('; ')}`);
  }

  if (result.retrieveCommand) {
    lines.push('');
    lines.push(`Retrieve verbatim specs: ${result.retrieveCommand}`);
  }

  if (result.maintainabilityHints.length > 0) {
    lines.push('');
    lines.push('Maintainability / Bespoke Glue Candidates:');
    for (const h of result.maintainabilityHints) {
      const gStr = h.guides.length ? ` [guides: ${h.guides.join(', ')}]` : '';
      lines.push(`  ⚠️ ${h.file} (${h.lineCount} lines): ${h.reason}${gStr}`);
    }
  }

  for (const g of result.guides) {
    if (g.content) {
      lines.push('');
      lines.push(`--- BEGIN MWG GUIDE: ${g.id} ---`);
      lines.push(g.content.trim());
      lines.push(`--- END MWG GUIDE: ${g.id} ---`);
    }
  }

  return lines.join('\n');
}
