// Fixture: JS file with known performance API issues for eval testing.
// Covers use cases: deprioritize-background-fetches, identify-inp-causes,
// identify-heavy-scripts, full-session-analytics

// ============================================================
// USE CASE: deprioritize-background-fetches
// VIOLATION: Analytics fetch without priority: 'low'.
// Best practice: Use priority: 'low' for analytics, beacons, or
// telemetry data that isn't required for the current view.
// ============================================================
fetch('/api/analytics', {
  method: 'POST',
  body: JSON.stringify({ event: 'page_view', timestamp: Date.now() })
  // VIOLATION: missing priority: 'low'
});

fetch('/api/telemetry', {
  method: 'POST',
  body: JSON.stringify({ metrics: { load_time: performance.now() } })
  // VIOLATION: missing priority: 'low'
});

// ============================================================
// USE CASE: identify-inp-causes
// VIOLATION: Logs INP data to console instead of beaconing it.
// Best practice: Beacon back the required information to an
// analytics service rather than just log it locally.
// ============================================================
import { onINP } from 'web-vitals/attribution';

onINP((metric) => {
  // VIOLATION: should beacon, not console.log
  console.log('INP:', metric.value, {
    invokerType: metric.attribution.longestScript.entry?.invokerType,
    sourceURL: metric.attribution.longestScript.entry?.sourceURL,
    sourceFunctionName: metric.attribution.longestScript.entry?.sourceFunctionName,
  });
});

// ============================================================
// USE CASE: identify-heavy-scripts
// VIOLATION: Logs LoAF data to console instead of sending to analytics.
// Best practice: Send the required information to an analytics
// service in production.
// ============================================================
const observer = new PerformanceObserver((list) => {
  const allScripts = list.getEntries().flatMap((entry) => entry.scripts);

  const scriptSource = [...new Set(allScripts.map((s) => s.sourceURL))];
  const heavyScripts = scriptSource
    .map((url) => ({
      sourceURL: url,
      count: allScripts.filter((s) => s.sourceURL === url).length,
      totalDuration: allScripts
        .filter((s) => s.sourceURL === url)
        .reduce((sum, s) => sum + s.duration, 0),
    }))
    .filter((s) => s.totalDuration > 100)
    .sort((a, b) => b.totalDuration - a.totalDuration);

  // VIOLATION: should send to analytics service, not console.table
  console.table(heavyScripts);
});

observer.observe({ type: 'long-animation-frame', buffered: true });

// ============================================================
// USE CASE: full-session-analytics
// VIOLATION: Uses navigator.sendBeacon directly instead of fetchLater().
// Best practice: Use fetchLater() for reliable session analytics.
// sendBeacon in visibilitychange is less reliable (especially on mobile)
// and can make pages ineligible for bfcache.
// ============================================================
const sessionData = {
  id: crypto.randomUUID(),
  duration: 0,
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    sessionData.duration = performance.now();
    // VIOLATION: should use fetchLater() per modern-web guidance
    navigator.sendBeacon(
      '/api/session-analytics',
      JSON.stringify(sessionData)
    );
  }
});
