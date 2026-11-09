/**
 * Google Analytics 4 and Category 2B Cookie Notification Bar bootstrap for the
 * Modern Web Guidance Eval Dashboard.
 *
 * External scripts (`googletagmanager.com` and `gstatic.com`) are only injected
 * on the production GitHub Pages host (`googlechrome.github.io`) or when
 * explicitly enabled in tests (`window.__MWG_ENABLE_ANALYTICS = true`) so local
 * development and Playwright test suites do not emit synthetic analytics hits or
 * depend on external network reachability.
 */

export const GA_MEASUREMENT_ID = 'G-V48MZB1JQE';
export const COOKIE_BAR_CATEGORY = '2B';
export const COOKIE_BAR_SITE_ID = 'Modern Web Guidance Eval Dashboard';
export const COOKIE_BAR_CSS_URL = 'https://www.gstatic.com/glue/cookienotificationbar/cookienotificationbar.min.css';
export const COOKIE_BAR_JS_URL = 'https://www.gstatic.com/glue/cookienotificationbar/cookienotificationbar.min.js';

/**
 * Route-identifying query parameters safe to retain in `page_location`.
 * All other query parameters and URL hash fragments are stripped so user input,
 * OAuth tokens, or PII can never be transmitted to analytics.
 */
const ALLOWED_QUERY_PARAMS = new Set(['guide', 'testId', 'task', 'mode', 'source']);
const SAFE_PARAM_VALUE_RE = /^[a-zA-Z0-9._-]{1,120}$/;

/**
 * Returns a sanitized URL string with only allowlisted route-slug query
 * parameters and no hash fragment.
 *
 * @param {string} rawHref
 * @returns {string}
 */
export function scrubPageLocation(rawHref) {
  try {
    const url = new URL(rawHref);
    const cleanParams = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      if (ALLOWED_QUERY_PARAMS.has(key) && SAFE_PARAM_VALUE_RE.test(value)) {
        cleanParams.set(key, value);
      }
    }
    const query = cleanParams.toString();
    return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
  } catch {
    return '';
  }
}

/**
 * Returns true when analytics and cookie notification scripts should be loaded.
 *
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function shouldLoadAnalytics(hostname = typeof location !== 'undefined' ? location.hostname : '') {
  const win = /** @type {Window & { __MWG_ENABLE_ANALYTICS?: boolean }} */ (
    typeof window !== 'undefined' ? window : {}
  );
  if (typeof win.__MWG_ENABLE_ANALYTICS === 'boolean') {
    return win.__MWG_ENABLE_ANALYTICS;
  }
  return hostname === 'googlechrome.github.io';
}

/**
 * Returns true when `?previewCookieBar=1` (or `true`) is present in the URL,
 * allowing developers on non-EEA/UK IPs or local dev servers to preview the
 * live Glue Category 2B Cookie Notification Bar without emitting GA4 hits.
 *
 * @param {string} [search]
 * @returns {boolean}
 */
export function isPreviewCookieBar(search = typeof location !== 'undefined' ? location.search : '') {
  try {
    const params = new URLSearchParams(search);
    const val = params.get('previewCookieBar');
    return val === '1' || val === 'true';
  } catch {
    return false;
  }
}

/**
 * Installs a lightweight fetch interceptor for `gstatic.com`'s `2b.json`
 * endpoint when `?previewCookieBar=1` is active so the Glue Cookie Notification
 * Bar renders even when browsing from a non-EEA/UK IP address.
 */
function enableCookieBarPreviewMode() {
  try {
    window.localStorage?.removeItem('glue.CookieNotificationBar');
  } catch {
    // Ignore storage access errors in restricted contexts.
  }
  const origFetch = window.fetch?.bind(window);
  if (typeof origFetch !== 'function') return;
  window.fetch = function previewCookieBarFetch(input, init) {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    if (url.includes('/glue/cookienotificationbar/config/2b.json')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            content: {
              consentText: 'Hide',
              mainText:
                '[This site] uses cookies from Google to deliver and enhance the quality of its services and to analyze traffic.',
              moreAriaLabelText: 'Learn more about how Google uses cookies. Opens in a new tab.',
              moreText: 'Learn more',
              moreUrl: 'https://policies.google.com/technologies/cookies?hl=en',
            },
            eea: true,
            language: 'en',
            required: true,
            rtl: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }
    return origFetch(input, init);
  };
}

/**
 * Initializes `window.dataLayer`, `window.gtag`, and (when on the production
 * host, enabled in tests, or previewing via `?previewCookieBar=1`) injects
 * `gtag.js` and the Glue Cookie Notification Bar.
 */
export function initAnalytics() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const win = /** @type {Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; __mwgAnalyticsInitialized?: boolean }} */ (window);
  if (win.__mwgAnalyticsInitialized) return;
  win.__mwgAnalyticsInitialized = true;

  win.dataLayer = win.dataLayer || [];
  if (typeof win.gtag !== 'function') {
    win.gtag = function gtag() {
      // oxlint-disable-next-line prefer-rest-params
      win.dataLayer?.push(arguments);
    };
  }

  const pageLocation = scrubPageLocation(window.location.href);
  win.gtag('js', new Date());
  win.gtag('config', GA_MEASUREMENT_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: pageLocation,
  });

  const loadFullAnalytics = shouldLoadAnalytics();
  const previewCookieBar = isPreviewCookieBar();
  if (!loadFullAnalytics && !previewCookieBar) return;

  if (previewCookieBar) {
    enableCookieBarPreviewMode();
  }

  // 1. Load Glue Cookie Notification Bar stylesheet (prepended so dashboard.css
  //    theme overrides take precedence without needing !important).
  if (!document.querySelector(`link[href="${COOKIE_BAR_CSS_URL}"]`)) {
    const cnbCss = document.createElement('link');
    cnbCss.rel = 'stylesheet';
    cnbCss.href = COOKIE_BAR_CSS_URL;
    document.head.prepend(cnbCss);
  }

  // 2. Load Google tag (gtag.js) asynchronously with low fetch priority
  //    (MWG optimize-script-priority), only when full analytics is enabled.
  if (loadFullAnalytics) {
    const gtagSrc = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    if (!document.querySelector(`script[src="${gtagSrc}"]`)) {
      const gtagScript = document.createElement('script');
      gtagScript.src = gtagSrc;
      gtagScript.async = true;
      gtagScript.fetchPriority = 'low';
      document.head.appendChild(gtagScript);
    }
  }

  // 3. Load Glue Cookie Notification Bar (Category 2B) asynchronously with low
  //    fetch priority.
  if (!document.querySelector(`script[src="${COOKIE_BAR_JS_URL}"]`)) {
    const cnbScript = document.createElement('script');
    cnbScript.src = COOKIE_BAR_JS_URL;
    cnbScript.async = true;
    cnbScript.fetchPriority = 'low';
    cnbScript.dataset.glueCookieNotificationBarCategory = COOKIE_BAR_CATEGORY;
    cnbScript.dataset.glueCookieNotificationBarSiteId = COOKIE_BAR_SITE_ID;
    cnbScript.dataset.glueCookieNotificationBarAutoMarginClass = 'site-legal-footer';
    document.head.appendChild(cnbScript);
  }
}

initAnalytics();
