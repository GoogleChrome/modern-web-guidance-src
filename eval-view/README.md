# Eval-View Dashboard

The Eval-View Dashboard lets you visualize test results from the Modern Web Guidance eval harness.

The dashboard can be view in two different ways:

1. Locally, with `gd dashboard`, via `server.js`.
2. Remotely, with GitHub Pages at **[https://googlechrome.github.io/modern-web-guidance-src/](https://googlechrome.github.io/modern-web-guidance-src/)** (static hosting).

The `eval-view` codebase contains complexity to support both views.

## Viewing the Dashboard

The dashboard is continuously deployed to GitHub Pages and can be accessed at:
**[https://googlechrome.github.io/modern-web-guidance-src/](https://googlechrome.github.io/modern-web-guidance-src/)**

### Authentication & Permissions

When you visit the site, there is a button to sign in with your Google account. Note that simply logging in does not grant you access to the data.

The application fetches evaluation data directly from the private Google Cloud Storage bucket (`guidance-evals`) in the `chrome-kiwi-air-force-dev` GCP project.

> [!IMPORTANT]
> To view the suites and results on the dashboard, **your Google email address must be granted access** in the Google Cloud Console. You will need at minimum the `Storage Object Viewer` role on the `guidance-evals` bucket in the `chrome-kiwi-air-force-dev` project.

## Local Development

To run the dashboard locally and see local results (run from the root `modern-web-guidance-src` directory):

```bash
pnpm dashboard
```

### Parity Testing
To ensure your changes will work on the static deployment host, you can run the dashboard in a "Static" mode that serves files via `statikk` to mimic static deployment structure:

```bash
# From the project root directory
STATIC=true gd dashboard
```

## Deploying Changes

If you make modifications to the `eval-view` code (HTML, CSS, JS), you can deploy your changes directly to the live GitHub Pages site using the built-in deploy script.

From the **project root directory**, run:
```bash
gd deploy
```

This will automatically bundle the current `eval-view` directory and push it to the `gh-pages` branch on GitHub in the `eval-view` folder, which GitHub Pages uses to host the web app. It takes about 2-3 minutes for GitHub Actions to process the deployment and update the live URL.

When deploying, you should also separately merge the changes into `main`.
