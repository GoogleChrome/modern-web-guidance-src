---
description: Automate performance testing with Lighthouse Bot to maintain app speed and prevent regressions.
filename: automate-performance-testing
category: testing
---

# Automating Performance Testing with Lighthouse Bot

This guide explains how to integrate Lighthouse Bot with Travis CI to automate performance testing and ensure your web application maintains its speed over time.

## Best Practices

To effectively use Lighthouse Bot for automated performance testing, follow these best practices:

*   **Integrate with CI/CD:** Set up Lighthouse Bot within your Continuous Integration and Continuous Deployment (CI/CD) pipeline (e.g., Travis CI) to run tests automatically on every code push or pull request.
*   **Set Performance Budgets:** Define specific performance score thresholds in your Lighthouse Bot configuration. This prevents merging pull requests that would degrade performance. For example, `--perf=95` sets a minimum performance score of 95.
*   **Test on Live Servers:** Deploy your application to a staging environment before running performance tests. This provides a more accurate reflection of real-world performance compared to localhost testing.
*   **Utilize Travis CI Environment Variables:** Securely store sensitive information like Firebase tokens (`FIREBASE_TOKEN`) and Lighthouse Bot API keys (`LIGHTHOUSE_API_KEY`) as environment variables within your Travis CI settings, rather than hardcoding them in your configuration files.
*   **Configure Status Checks:** Set up your GitHub repository to require status checks to pass before merging pull requests. This ensures that any failed Lighthouse Bot tests will block merging.
*   **Test Multiple Categories:** Beyond performance, leverage Lighthouse Bot to test other critical categories such as accessibility (`--a11y`), SEO (`--seo`), and best practices (`--bp`) to maintain a well-rounded application.
*   **Understand Lighthouse Bot's Role:** Recognize that Lighthouse Bot primarily tests performance on pull requests. Pushing directly to the main branch may not trigger the intended performance audits.
*   **Monitor Lighthouse Bot Feedback:** Pay attention to Lighthouse Bot's comments on pull requests. These comments provide detailed insights into performance scores and highlight any regressions.
*   **Keep Lighthouse Bot Updated:** Regularly update the Lighthouse Bot package (`npm i --save-dev https://github.com/ebidel/lighthousebot`) to benefit from the latest features and bug fixes.

## Setup Steps

1.  **Clone and Deploy:**
    *   Clone the example repository: `git clone https://github.com/GoogleChromeLabs/lighthouse-bot-starter`.
    *   Add the cloned repository to your GitHub account.
    *   Deploy your application to a staging server, such as Firebase Hosting, following the steps outlined in the original guide. This involves installing the Firebase CLI, logging in, initializing the project, and deploying.

2.  **Set up Travis CI:**
    *   Register an account on Travis CI and connect it to your GitHub repository.
    *   Ensure your project repository is synced and visible in your Travis CI dashboard.
    *   Verify that a `.travis.yml` file exists in the root of your project directory.

3.  **Automate Firebase Deployment with Travis:**
    *   Generate a Firebase token by running `firebase login:ci`.
    *   Add the generated token as an environment variable named `FIREBASE_TOKEN` in your Travis CI project settings.
    *   Append the following to your `.travis.yml` file to enable automated deployments after successful builds:
        ```yaml
        after_success:
          - firebase deploy --token $FIREBASE_TOKEN --non-interactive
        ```

4.  **Set up Lighthouse Bot:**
    *   Add `lighthousebot` as a collaborator to your GitHub repository under Settings > Collaborators.
    *   Obtain a Lighthouse Bot API key by filling out the provided Google Form and receiving it via email.
    *   Add this key as an environment variable named `LIGHTHOUSE_API_KEY` in your Travis CI project settings.
    *   Install Lighthouse Bot as a dev dependency: `npm i --save-dev https://github.com/ebidel/lighthousebot`.
    *   Add the following script to your `package.json`:
        ```json
        "scripts": {
          "lh": "lighthousebot"
        }
        ```
    *   Update your `.travis.yml` file to include Lighthouse Bot checks in the `after_success` section. Replace `YOUR_STAGING_URL` with the URL of your deployed application:
        ```yaml
        after_success:
          - firebase deploy --token $FIREBASE_TOKEN --non-interactive
          - npm run lh -- --perf=95 YOUR_STAGING_URL
        ```
        (Adjust `--perf=95` as needed for your performance budget).

5.  **Trigger Lighthouse Bot Tests:**
    *   Create a new branch: `git checkout -b feature/new-test`.
    *   Push the branch to GitHub: `git push origin feature/new-test`.
    *   Create a pull request from this branch on GitHub. Lighthouse Bot will automatically run its audits on the pull request.

## Advanced Lighthouse Options

Lighthouse Bot supports setting performance budgets for various categories:

*   `--perf`: Performance score
*   `--pwa`: Progressive Web App score
*   `--a11y`: Accessibility score
*   `--bp`: Best practices score
*   `--seo`: SEO score

You can combine these flags to enforce multiple standards simultaneously:

```bash
npm run lh -- --perf=93 --seo=100 YOUR_STAGING_URL
```

To disable comments from Lighthouse Bot, use the `--no-comment` option.