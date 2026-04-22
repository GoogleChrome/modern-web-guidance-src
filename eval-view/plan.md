# Plan to Finalize Static Mode as Default

This plan outlines the tasks required to make static mode the default behavior for the evaluation dashboard, while preserving only the dynamic `/api/eval-launch` endpoint for local control.

## Goal
Transition the dashboard to rely exclusively on static generated manifests for all data listing operations, enabling seamless deployment on GitHub Pages while retaining the ability to launch runs locally.

## Tasks

### 1. Update Client Data Fetching (`eval-view/api.js`)
- [ ] **Default to Static Mode**: Change `ApiClient` constructor to default to `source = 'static'` even on `localhost` (or auto-detect when served by `statikk`).
- [ ] **Use Grouped Tasks Manifest**: Update `getGroupedTasks()` to fetch from `./grouped-tasks.gen.json` instead of the `/api/grouped-tasks` endpoint.
- [ ] **Remove Capabilities Over-branching**: Simplify the capability flags now that manifests and embedded file lists are the standard.

### 2. Clean Up Server APIs (`eval-view/server.js`)
- [ ] **Remove Data Listing APIs**: Delete the handlers for:
  - `/api/suites`
  - `/api/run-files`
  - `/api/exists`
  - `/api/grouped-tasks`
- [ ] **Isolate Execution Endpoint**: Retain ONLY the `/api/eval-launch` endpoint to support `eval-ui.html`.
- [ ] **Refactor Routing**: Convert the remaining `if-else` chain for routing into a simple map-based dispatch (as suggested by the code reviewer).

### 3. Build & Deployment Automation
- [ ] **Verify Manifest Generation**: Ensure `generate-manifests.js` handles large datasets efficiently (consider throttling as suggested by the reviewer).
- [ ] **Update `deploy.ts`**: Ensure it runs all manifest generations before copying files and deploying.

### 4. Integration & Conflict Resolution
- [ ] **Merge into `dashboard-hot`**: Use the detailed prompt created earlier to merge these finalized static infrastructure changes into the UI redesign branch.
