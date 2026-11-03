/// <reference path="./evals.d.ts" />
import { classifyScenarioCheck } from './a11y-classifier.js';
/** @type {Record<string, string>} */
export const SERVING_DISPLAY_NAMES = { skills: 'Skills', skills_cli: 'Skills (CLI)', mcp: 'MCP', };
export { AGENT_DISPLAY_NAMES, getAgentBadge } from './agents.js';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ZONELESS_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;
const TEST_ID_DATETIME_RE = /(\d{4}-\d{2}-\d{2})[_T](\d{2})-(\d{2})-(\d{2})/;
const TEST_ID_DATE_RE = /(\d{4}-\d{2}-\d{2})/;

/** @typedef {{ date: Date, dateOnly: boolean }} SuiteDateInfo */

/**
 * Suite timestamps without an explicit offset (`YYYY-MM-DD`, `YYYY-MM-DDTHH:MM[:SS[.fff]]`)
 * are written by the harness in UTC. Distinguish bare calendar dates (`dateOnly: true`,
 * formatted in UTC so `"2026-10-09"` doesn't shift to `"Oct 8, 2026"` in US timezones)
 * from timestamps with a time-of-day (`dateOnly: false`).
 * @param {string | undefined | null} timestamp
 * @param {string} [testId='']
 * @returns {SuiteDateInfo | null}
 */
export function parseSuiteDateInfo(timestamp, testId = '') {
    const rawTs = typeof timestamp === 'string' ? timestamp.trim() : '';
    const isDateOnly = DATE_ONLY_RE.test(rawTs);
    const isMidnight = /T00:00:00(?:\.0+)?Z?$/i.test(rawTs);
    if ((!rawTs || isDateOnly || isMidnight) && testId) {
        const m = testId.match(TEST_ID_DATETIME_RE);
        if (m && (m[2] !== '00' || m[3] !== '00' || m[4] !== '00' || !rawTs || isDateOnly)) {
            const d = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
            if (!Number.isNaN(d.getTime())) return { date: d, dateOnly: false };
        }
    }
    if (rawTs) {
        const iso = ZONELESS_RE.test(rawTs)
            ? `${rawTs.replace(' ', 'T')}${isDateOnly ? 'T00:00:00Z' : 'Z'}`
            : rawTs;
        const d = new Date(iso);
        if (!Number.isNaN(d.getTime())) return { date: d, dateOnly: isDateOnly };
    }
    if (testId) {
        const dt = testId.match(TEST_ID_DATETIME_RE);
        if (dt) {
            const d = new Date(`${dt[1]}T${dt[2]}:${dt[3]}:${dt[4]}Z`);
            if (!Number.isNaN(d.getTime())) return { date: d, dateOnly: false };
        }
        const dm = testId.match(TEST_ID_DATE_RE);
        if (dm) {
            const d = new Date(`${dm[1]}T00:00:00Z`);
            if (!Number.isNaN(d.getTime())) return { date: d, dateOnly: true };
        }
    }
    return null;
}

/** @param {string | undefined | null} timestamp
 * @param {string} [testId='']
 * @returns {Date | null} */
export function parseSuiteDate(timestamp, testId = '') {
    return parseSuiteDateInfo(timestamp, testId)?.date ?? null;
}

/** @param {SuiteDateInfo | Date | string | null | undefined} dateLike
 * @param {string} [testId='']
 * @returns {SuiteDateInfo | null} */
function resolveSuiteDateInfo(dateLike, testId = '') {
    if (dateLike instanceof Date) {
        return Number.isNaN(dateLike.getTime()) ? null : { date: dateLike, dateOnly: false };
    }
    if (typeof dateLike === 'object' && dateLike !== null && dateLike.date instanceof Date) {
        return Number.isNaN(dateLike.date.getTime()) ? null : dateLike;
    }
    return parseSuiteDateInfo(typeof dateLike === 'string' ? dateLike : null, testId);
}

const DEFAULT_SUITE_DATE_OPTIONS = /** @type {Intl.DateTimeFormatOptions} */ ({ dateStyle: 'medium', timeStyle: 'short' });
/** @param {SuiteDateInfo | Date | string | null | undefined} dateLike
 * @param {string | Intl.DateTimeFormatOptions} [testIdOrOptions]
 * @param {string} [locale='en-US']
 * @returns {string} */
export function formatSuiteDate(dateLike, testIdOrOptions, locale = 'en-US') {
    const testId = typeof testIdOrOptions === 'string' ? testIdOrOptions : '';
    const options = typeof testIdOrOptions === 'object' && testIdOrOptions !== null ? testIdOrOptions : DEFAULT_SUITE_DATE_OPTIONS;
    const info = resolveSuiteDateInfo(dateLike, testId);
    if (!info) return '-';
    if (info.dateOnly) {
        const { hour: _h, minute: _m, second: _s, hour12: _h12, timeStyle: _ts, ...dateOnly } = options;
        return new Intl.DateTimeFormat(locale, { ...dateOnly, timeZone: 'UTC' }).format(info.date);
    }
    return new Intl.DateTimeFormat(locale, options).format(info.date);
}
/** @param {SuiteDateInfo | Date | string | null | undefined} dateLike
 * @param {string} [testId=''] */
export function getSuiteDayKey(dateLike, testId = '') {
    const info = resolveSuiteDateInfo(dateLike, testId);
    if (!info) return '';
    const { date, dateOnly } = info;
    const y = dateOnly ? date.getUTCFullYear() : date.getFullYear();
    const m = (dateOnly ? date.getUTCMonth() : date.getMonth()) + 1;
    const d = dateOnly ? date.getUTCDate() : date.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export const SUPPORTS_ANCHOR_POSITIONING = typeof CSS !== 'undefined' && CSS.supports('top', 'anchor(bottom)');

/**
 * Positions a fixed-positioned popover/tooltip next to an anchor element or rect when native
 * CSS Anchor Positioning is unavailable (or for SVG triggers not handled by the CSS polyfill).
 * @param {HTMLElement} popover
 * @param {Element | { left: number, top: number, right: number, bottom: number, width?: number, height?: number }} anchor
 * @param {{ align?: 'start' | 'center' | 'end', placement?: 'block' | 'inline', gap?: number, edge?: number, fallbackWidth?: number, fallbackHeight?: number }} [options]
 */
export function placePopoverFallback(popover, anchor, options = {}) {
    const {
        align = 'start',
        placement = 'block',
        gap = 6,
        edge = 8,
        fallbackWidth = 290,
        fallbackHeight = 140
    } = options;
    const raw = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;
    const width = raw.width ?? (raw.right - raw.left);
    const height = raw.height ?? (raw.bottom - raw.top);
    const w = popover.offsetWidth || fallbackWidth;
    const h = popover.offsetHeight || fallbackHeight;
    let left;
    let top;
    if (placement === 'inline') {
        left = raw.right + gap;
        top = raw.top + (height / 2) - (h / 2);
        if (left + w > window.innerWidth - edge) {
            left = raw.left - w - gap;
            if (left < edge) {
                left = raw.left + (width / 2) - (w / 2);
                top = raw.bottom + gap + h <= window.innerHeight - edge ? raw.bottom + gap : raw.top - h - gap;
            }
        }
    } else {
        left = align === 'center'
            ? raw.left + (width / 2) - (w / 2)
            : (align === 'end' ? raw.right - w : raw.left);
        if (align === 'start' && left + w > window.innerWidth - edge) {
            left = raw.right - w;
        }
        top = raw.bottom + gap;
        if (top + h > window.innerHeight - edge && raw.top - h - gap >= edge) {
            top = raw.top - h - gap;
        }
    }
    popover.style.inset = 'auto';
    popover.style.left = `${Math.max(edge, Math.min(left, window.innerWidth - w - edge))}px`;
    popover.style.top = `${Math.max(edge, Math.min(top, window.innerHeight - h - edge))}px`;
}
/** @param {HTMLElement} el */
export function isPopoverOpen(el) {
    try { return el.matches(':popover-open'); } catch { return el.classList.contains(':popover-open'); }
}
/** @param {HTMLElement} el
 * @param {boolean} open */
export function setPopoverOpen(el, open) { if (isPopoverOpen(el) === open || typeof el.showPopover !== 'function') return; if (open) el.showPopover(); else el.hidePopover(); }
/** @returns {ScrollBehavior} */
export function getScrollBehavior() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return 'auto'; }
    return 'smooth';
}
/** @param {Element} el
 * @param {number} [tolerance] px of slack for subpixel layout */
export function isElementFullyVisible(el, tolerance = 1) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    let top = 0;
    let left = 0;
    let bottom = window.innerHeight;
    let right = window.innerWidth;
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const c = p.getBoundingClientRect();
        if (cs.overflowY !== 'visible') { top = Math.max(top, c.top + p.clientTop); bottom = Math.min(bottom, c.top + p.clientTop + p.clientHeight); }
        if (cs.overflowX !== 'visible') { left = Math.max(left, c.left + p.clientLeft); right = Math.min(right, c.left + p.clientLeft + p.clientWidth); }
    }
    const fits = (/** @type {number} */ a0, /** @type {number} */ a1, /** @type {number} */ b0, /** @type {number} */ b1) =>
        (a0 >= b0 - tolerance && a1 <= b1 + tolerance) || (a0 <= b0 + tolerance && a1 >= b1 - tolerance);
    return fits(r.top, r.bottom, top, bottom) && fits(r.left, r.right, left, right);
}
/** @param {Element} link the focusable SVG `<a>`
 * @param {Element} scrollTarget a shape inside it that Firefox will scroll to
 * @param {Element} [visibleTarget] the box that must end up visible (defaults to scrollTarget) */
export function scrollSvgLinkIntoViewOnFocus(link, scrollTarget, visibleTarget = scrollTarget) {
    link.addEventListener('focus', () => {
        window.requestAnimationFrame(() => {
            if (document.activeElement !== link || isElementFullyVisible(visibleTarget)) return;
            scrollTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: getScrollBehavior() });
        });
    });
}
/** @param {Element} el
 * @param {() => void} callback
 * @param {() => boolean} isStillWanted
 * @param {number} [timeoutMs] */
export function whenElementSettlesInView(el, callback, isStillWanted, timeoutMs = 1500) {
    const start = performance.now();
    let last = '';
    let stableFrames = 0;
    const tick = () => {
        if (!el.isConnected || !isStillWanted() || performance.now() - start > timeoutMs) return;
        const r = el.getBoundingClientRect();
        const key = `${Math.round(r.top)},${Math.round(r.left)}`;
        stableFrames = key === last ? stableFrames + 1 : 0;
        last = key;
        if (stableFrames >= 2 && isElementFullyVisible(el)) { callback(); return; }
        window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
}
/** @param {number[]} values */
export function median(values) {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
/** @param {number | undefined | null} ms */
export function formatDuration(ms) {
    if (!ms || ms <= 0) return '0s';
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}
/** @param {{ total?: number, cached?: number } | undefined | null} tokenUsage */
export function getTokenBreakdown(tokenUsage) {
    const total = Math.max(0, tokenUsage?.total || 0);
    const cached = Math.max(0, Math.min(total, tokenUsage?.cached || 0));
    const uncached = Math.max(0, total - cached);
    const cachedPct = total > 0 ? Math.round((cached / total) * 100) : 0;
    return { total, cached, uncached, cachedPct };
}
/** Extracts agent-only task duration in milliseconds (excluding fixed grader overhead).
 * @param {(Partial<import('../harness/lib/metrics.ts').RunResult> & { runtimeMs?: number, runtime?: { agentRuntime?: number, graderRuntime?: number } | null }) | undefined | null} run */
export function getAgentRuntimeMs(run) {
    if (!run) return 0;
    if (run.runtime && typeof run.runtime === 'object' && typeof run.runtime.agentRuntime === 'number' && run.runtime.agentRuntime > 0) { return run.runtime.agentRuntime; }
    return (typeof run.runtimeMs === 'number' && run.runtimeMs > 0) ? run.runtimeMs : 0;
}
/** @param {import('../harness/lib/metrics.ts').ScenarioCheck[] | undefined | null} checks */
export function isEarlyFailureRun(checks) {
    return !!(checks && checks.some(c => c.isEarlyFailure));
}

/**
 * @param {import('../harness/lib/metrics.ts').RunResult & { guideUsed?: { guidesUsed?: string[] } | null } | undefined | null} run
 * @param {string} [fallbackGuide]
 */
export function isUnguidedLeakRun(run, fallbackGuide = '') {
    if (!run) return false;
    const expected = run.guideName || fallbackGuide;
    const guides = run.guidesUsed || (run.guideUsed && run.guideUsed.guidesUsed) || [];
    return !!(expected && guides.includes(expected));
}

/** @param {import('../harness/lib/metrics.ts').ScenarioCheck[] | undefined | null} checks */
export function getRunStats(checks) {
    if (!checks || !checks.length || isEarlyFailureRun(checks)) return { rate: 0, passed: 0, total: 0 };
    const passed = checks.filter(c => c.passed).length;
    const total = checks.length;
    return { rate: Math.round((passed / total) * 100), passed, total };
}
/** @param {import('../harness/lib/metrics.ts').ScenarioCheck[] | undefined | null} checks
 * @param {string} guideName
 * @param {string} [discipline=''] */
export function getA11yRunStats(checks, guideName, discipline = '') {
    if (!checks || !checks.length) return { rate: 0, passed: 0, total: 0, checks: [] };
    const classified = checks
        .map(c => ({ ...c, a11y: classifyScenarioCheck(c, guideName, discipline) }))
        .filter(c => c.a11y.isAccessibility);
    const passed = classified.filter(c => c.passed).length;
    const total = classified.length;
    return { rate: total > 0 ? Math.round((passed / total) * 100) : 0, passed, total, checks: classified };
}

/**
 * @param {number} percentage
 * @returns {string}
 */
export function getColor(percentage) {
    if (!Number.isFinite(percentage)) { return 'var(--color-on-surface-variant)'; }
    const p = Math.max(0, Math.min(100, percentage));
    const RED = 'light-dark(oklch(45% 0.18 26), oklch(75% 0.16 26))';
    const YELLOW = 'light-dark(oklch(45% 0.13 74), oklch(82% 0.14 82))';
    const GREEN = 'light-dark(oklch(44% 0.13 145), oklch(78% 0.15 145))';

    if (p <= 30) return RED;
    if (p >= 90) return GREEN;
    if (p < 60) {
        const mix = Math.round(((p - 30) / 30) * 100);
        return `color-mix(in oklch, ${RED}, ${YELLOW} ${mix}%)`;
    }
    const mix = Math.round(((p - 60) / 30) * 100);
    return `color-mix(in oklch, ${YELLOW}, ${GREEN} ${mix}%)`;
}

/**
 * @param {string | number | undefined | null} text
 * @returns {string}
 */
export function escapeHtml(text) {
    if (text === undefined || text === null) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * @param {string} s
 * @returns {string}
 */
export function capitalize(s) {
    if (typeof s !== 'string' || s.length === 0) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * @param {number | undefined | null} tokens
 * @returns {string}
 */
export function formatTokens(tokens) {
    if (!tokens) return '0 tok';
    // undefined so it uses the user's locale.
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
        .format(tokens)
        .toLowerCase() + ' tok';
}

/**
 * @param {string | Date | number} date
 * @returns {string}
 */
export function timeAgo(date) {
    const diff = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const units = [
        { name: 'year', s: 31536000 }, { name: 'month', s: 2592000 },
        { name: 'day', s: 86400 }, { name: 'hour', s: 3600 },
        { name: 'minute', s: 60 }, { name: 'second', s: 1 }
    ];
    const u = units.find(u => Math.abs(diff) >= u.s) || units[units.length - 1];
    return rtf.format(-Math.floor(diff / u.s), /** @type {Intl.RelativeTimeFormatUnit} */ (u.name));
}

/**
 * @param {string} key
 * @returns {{ task: string, guide: string, runType: string } | null}
 */
export function parseResultKey(key) {
    const parts = key.split(' - ');
    if (parts.length < 2 || parts.length > 3) return null;
    let [task, guide, runType] = parts;

    const featuresMap = typeof window !== 'undefined' ? window.__featuresMapping : undefined;
    let isFlipped = false;

    if (featuresMap) {
        const isGuideValid = featuresMap[guide] !== undefined;
        const isTaskValidGuide = featuresMap[task] !== undefined;
        if (isTaskValidGuide && !isGuideValid) {
            isFlipped = true;
        } else if (!isGuideValid && !isTaskValidGuide) {
            isFlipped = guide === 'task' || !!(guide && guide.endsWith('-task'));
        }
    } else {
        isFlipped = guide === 'task' || !!(guide && guide.endsWith('-task'));
    }

    if (isFlipped) {
        const temp = task;
        task = guide;
        guide = temp;
    }

    return { task, guide, runType };
}

/**
 * Returns the set of `${task} - ${guide}` scenario IDs that have valid runs.
 * When both `guided` and `unguided` keys exist for a scenario, both must have at least one valid run.
 *
 * @param {Record<string, import('../harness/lib/metrics.ts').RunResult[]>} results
 * @returns {Set<string>}
 */
export function getEligibleScenarioIds(results) {
    const eligible = new Set();
    for (const [key, runs] of Object.entries(results)) {
        const parsed = parseResultKey(key);
        if (!parsed || (parsed.runType !== 'guided' && parsed.runType !== 'unguided')) continue;
        const otherKey = key.endsWith(' - guided') ? key.replace(/ - guided$/, ' - unguided') : key.replace(/ - unguided$/, ' - guided');
        if (runs.some(r => getRunStats(r.results).total > 0) &&
            (!results[otherKey] || results[otherKey].some(r => getRunStats(r.results).total > 0))) {
            eligible.add(`${parsed.task} - ${parsed.guide}`);
        }
    }
    return eligible;
}

/** @typedef {{ guided: number[], unguided: number[], guided_tokens: number[], unguided_tokens: number[], guided_uncached_tokens: number[], unguided_uncached_tokens: number[], guided_cached_pct: number[], unguided_cached_pct: number[], guided_runtime_ms: number[], unguided_runtime_ms: number[], guided_failed: boolean, unguided_failed: boolean, guided_err_rate: number, unguided_err_rate: number, a11y_total: number }} ChartAppData */

/**
 * @param {Record<string, Array<import('../harness/lib/metrics.ts').RunResult & { discipline?: string }>>} results
 * @param {{ onlyA11y?: boolean, eligibleScenarios?: Set<string> } | Set<string>} [optionsOrEligible={}]
 */
export function calculateChartData(results, optionsOrEligible = {}) {
    const isSet = optionsOrEligible instanceof Set;
    const onlyA11y = !isSet && Boolean(optionsOrEligible?.onlyA11y);
    const eligibleScenarios = isSet
        ? optionsOrEligible
        : (optionsOrEligible?.eligibleScenarios || getEligibleScenarioIds(results));
    /** @type {Record<string, ChartAppData>} */
    const apps = {};
    /** @type {Record<string, string>} */
    const taskNames = {};
    
    Object.keys(results).forEach(key => {
        const parsedKey = parseResultKey(key);
        if (!parsedKey) return;
        const { task: taskName, guide, runType } = parsedKey;

        if (runType !== 'guided' && runType !== 'unguided') return;
        if (!eligibleScenarios.has(`${taskName} - ${guide}`)) return;
        /** @type {'guided' | 'unguided'} */
        const rType = runType;
        const failedKey = rType === 'guided' ? 'guided_failed' : 'unguided_failed';
        const errRateKey = rType === 'guided' ? 'guided_err_rate' : 'unguided_err_rate';
        const tokensKey = rType === 'guided' ? 'guided_tokens' : 'unguided_tokens';
        const uncachedKey = rType === 'guided' ? 'guided_uncached_tokens' : 'unguided_uncached_tokens';
        const cachedPctKey = rType === 'guided' ? 'guided_cached_pct' : 'unguided_cached_pct';
        const runtimeKey = rType === 'guided' ? 'guided_runtime_ms' : 'unguided_runtime_ms';

        const scenario = `${taskName} (${guide})`;
        if (!apps[scenario]) {
            apps[scenario] = { 
                guided: [], 
                unguided: [], 
                guided_tokens: [], 
                unguided_tokens: [], 
                guided_uncached_tokens: [],
                unguided_uncached_tokens: [],
                guided_cached_pct: [],
                unguided_cached_pct: [],
                guided_runtime_ms: [],
                unguided_runtime_ms: [],
                guided_failed: false, 
                unguided_failed: false,
                guided_err_rate: 0,
                unguided_err_rate: 0,
                a11y_total: 0
            };
        }
        
        const runs = results[key];
        if (runs.length > 0 && runs[0].taskName) {
            taskNames[scenario] = runs[0].taskName;
        }
        
        let earlyFailureCount = 0;
        let passed = 0;
        let total = 0;
        for (const r of runs) {
            if (isEarlyFailureRun(r.results)) {
                earlyFailureCount++;
            } else if (onlyA11y) {
                const a11yStats = getA11yRunStats(r.results, guide, r.discipline);
                passed += a11yStats.passed;
                total += a11yStats.total;
            } else {
                const s = getRunStats(r.results);
                passed += s.passed;
                total += s.total;
            }
        }
        if (onlyA11y) {
            apps[scenario].a11y_total += total;
        }

        if (earlyFailureCount > 0) {
            apps[scenario][failedKey] = true;
            apps[scenario][errRateKey] = Math.round((earlyFailureCount / runs.length) * 100);
        }
        if (!onlyA11y || total > 0) { apps[scenario][rType].push(total > 0 ? (passed / total) * 100 : 0); }
        const validRuns = runs.filter(r => !isEarlyFailureRun(r.results));
        const totalTokens = validRuns.reduce((acc, r) => acc + getTokenBreakdown(r.tokenUsage).total, 0);
        const uncachedTokens = validRuns.reduce((acc, r) => acc + getTokenBreakdown(r.tokenUsage).uncached, 0);
        const cachedTokens = validRuns.reduce((acc, r) => acc + getTokenBreakdown(r.tokenUsage).cached, 0);
        const avgTokens = validRuns.length > 0 ? Math.round(totalTokens / validRuns.length) : 0;
        const avgUncached = validRuns.length > 0 ? Math.round(uncachedTokens / validRuns.length) : 0;
        const cachedPct = totalTokens > 0 ? Math.round((cachedTokens / totalTokens) * 100) : 0;
        const totalRuntime = validRuns.reduce((acc, r) => acc + getAgentRuntimeMs(r), 0);
        const avgRuntime = validRuns.length > 0 ? Math.round(totalRuntime / validRuns.length) : 0;
        if (validRuns.length > 0) {
            apps[scenario][tokensKey].push(avgTokens);
            apps[scenario][uncachedKey].push(avgUncached);
            apps[scenario][cachedPctKey].push(cachedPct);
            apps[scenario][runtimeKey].push(avgRuntime);
        }
    });
    
    const labels = Object.keys(apps)
        .filter(scenario => !onlyA11y || apps[scenario].a11y_total > 0)
        .sort((a, b) => { const taskA = taskNames[a] || a; const taskB = taskNames[b] || b; return taskA.localeCompare(taskB); });

    /**
     * @param {string} l
     * @param {'guided' | 'unguided' | 'guided_tokens' | 'unguided_tokens' | 'guided_uncached_tokens' | 'unguided_uncached_tokens' | 'guided_cached_pct' | 'unguided_cached_pct' | 'guided_runtime_ms' | 'unguided_runtime_ms'} key
     * @returns {number}
     */
    const getAvgField = (l, key) => {
        const s = apps[l][key];
        return s && s.length > 0 ? Math.round(s.reduce((/** @type {number} */ acc, /** @type {number} */ b) => acc + b, 0) / s.length) : 0;
    };

    return { 
        labels, 
        guided: labels.map(l => getAvgField(l, 'guided')), 
        unguided: labels.map(l => getAvgField(l, 'unguided')),
        guided_tokens: labels.map(l => getAvgField(l, 'guided_tokens')),
        unguided_tokens: labels.map(l => getAvgField(l, 'unguided_tokens')),
        guided_uncached_tokens: labels.map(l => getAvgField(l, 'guided_uncached_tokens')),
        unguided_uncached_tokens: labels.map(l => getAvgField(l, 'unguided_uncached_tokens')),
        guided_cached_pct: labels.map(l => getAvgField(l, 'guided_cached_pct')),
        unguided_cached_pct: labels.map(l => getAvgField(l, 'unguided_cached_pct')),
        guided_runtime_ms: labels.map(l => getAvgField(l, 'guided_runtime_ms')),
        unguided_runtime_ms: labels.map(l => getAvgField(l, 'unguided_runtime_ms')),
        guided_failed: labels.map(l => apps[l].guided_failed),
        unguided_failed: labels.map(l => apps[l].unguided_failed),
        guided_err_rate: labels.map(l => apps[l].guided_err_rate),
        unguided_err_rate: labels.map(l => apps[l].unguided_err_rate)
    };
}


/**
 * @param {string} name
 * @returns {string}
 */
export function formatTestName(name) {
    if (!name) return name;
    const parsedKey = parseResultKey(name);
    if (parsedKey) {
        const { task: taskName, guide: guideName } = parsedKey;
        
        const featuresMap = (typeof window !== 'undefined' && window.__featuresMapping) || {};
        const featureId = (featuresMap[guideName] && featuresMap[guideName][0]) || 'uncategorized';
        const displayName = `${guideName} (${taskName})`;

        return `${featureId}: ${displayName}`;
    }
    return name.split(' - ').join(' / ');
}

// Google Identity Services (OAuth) Integration
const GOOGLE_CLIENT_ID = '169412140096-fk4rtf6iqk982d43385s1ilucrda91g2.apps.googleusercontent.com';
/** @type {string | null} */
let accessToken = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function' ? localStorage.getItem('gcs_access_token') : null;

/**
 * @returns {string | null}
 */
export function getAccessToken() {
    return accessToken;
}

/**
 * @param {(() => void) | undefined} [onAuthSuccess]
 */
export function initGoogleAuth(onAuthSuccess) {
    const init = () => {
        if (!window.google || !window.google.accounts) {
            // Wait for script to load
            setTimeout(init, 50);
            return;
        }

        const authBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('auth-btn'));
        if (authBtn) {
            authBtn.style.display = 'block';
            if (accessToken) {
                authBtn.style.display = 'none';
            }
        }

        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/devstorage.read_only',
            callback: (/** @type {any} */ response) => {
                if (response.error !== undefined) {
                    console.error('OAuth Error:', response);
                    return;
                }
                accessToken = response.access_token;
                localStorage.setItem('gcs_access_token', accessToken || '');
                console.log('Successfully authenticated with Google.');
                if (authBtn) {
                    authBtn.style.display = 'none';
                }
                if (onAuthSuccess) onAuthSuccess();
            },
        });

        if (authBtn) {
            authBtn.addEventListener('click', () => tokenClient.requestAccessToken());
        }
    };
    init();
}

/**
 * @param {string | URL} url
 * @param {RequestInit} [options={}]
 * @returns {Promise<Response>}
 */
export async function authenticatedFetch(url, options = {}) {
    if (accessToken) {
        /** @type {Record<string, string>} */
        const headers = /** @type {any} */ (options.headers || {});
        headers['Authorization'] = `Bearer ${accessToken}`;
        options.headers = headers;
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
        console.warn('Google Access Token expired or invalid. Clearing token.');
        localStorage.removeItem('gcs_access_token');
        accessToken = null;
        
        // Reset button UI if available
        const authBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('auth-btn'));
        if (authBtn) {
            authBtn.style.display = 'block';
            authBtn.textContent = 'Sign in with Google';
            authBtn.disabled = false;
            authBtn.style.backgroundColor = '';
            authBtn.style.color = '';
            authBtn.style.borderColor = '';
        }
    }
    return res;
}

/**
 * @template {string} T
 * @typedef {T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T]
 *   : T extends `${infer TagName}#${string}` ? (TagName extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[TagName] : HTMLElement)
 *   : T extends `${infer TagName}.${string}` ? (TagName extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[TagName] : HTMLElement)
 *   : HTMLElement} ParseSelector
 */

/**
 * Guaranteed querySelector. Always returns an element or throws if nothing matches.
 * @template {string} [T=string]
 * @template {Element} [E=ParseSelector<T>]
 * @param {T} query
 * @param {ParentNode} [context]
 * @returns {E}
 */
export function $(query, context) {
  const result = (context || document).querySelector(query);
  if (result === null) {
    throw new Error(`querySelector('${query}') not found`);
  }
  return /** @type {E} */ (result);
}
