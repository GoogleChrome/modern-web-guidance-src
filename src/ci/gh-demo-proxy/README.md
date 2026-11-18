# gh-demo-proxy

Serves `guides/**/demo.html` (and relative CSS/JS/assets) from `raw.githubusercontent.com` with proper `Content-Type` headers so demos can be viewed directly in the browser.

Hosted at `https://mwg-demos.web.app`. Swap `github.com` in any guide URL:

```
https://mwg-demos.web.app/GoogleChrome/modern-web-guidance-src/blob/main/guides/css/animate-to-intrinsic-sizes/demo.html
```

(If you swap `github.com` on a `guide.md` or `/tree/.../guides/<cat>/<guide>` URL, it redirects to `demo.html`.)

## Local dev & deploy

```bash
node src/ci/gh-demo-proxy/index.js
node --test src/ci/gh-demo-proxy/index.test.js
```

Deployed to Cloud Run behind a Firebase Hosting rewrite (`mwg-demos.web.app` -> `github-preview-proxy`):

```bash
gcloud run deploy github-preview-proxy \
  --source src/ci/gh-demo-proxy \
  --function proxy \
  --region us-central1 \
  --allow-unauthenticated \
  --clear-secrets \
  --clear-env-vars
```
