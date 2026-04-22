# Plan for GCS Redux Cleanup

This plan outlines the tasks required to clean up the evaluation dashboard, make static mode the default, and minimize server-side APIs.

## Goals
- Make static mode the default behavior.
- Remove data listing server APIs, retaining only execution control.
- Refactor server routing for better maintainability.

## Tasks

### 1. Clean Up Server APIs (`eval-view/server.js`)
- [ ] **Remove Data Listing APIs**: Delete the handlers for:
  - `/api/suites`
  - `/api/run-files`
  - `/api/exists`
  - `/api/grouped-tasks`
- [ ] **Isolate Execution Endpoint**: Retain ONLY the `/api/eval-launch` endpoint to support `eval-ui.html`.
- [ ] **Refactor Routing**: Convert the remaining `if-else` chain for routing into a simple map-based dispatch (as suggested by code review).

### 2. Update Client Data Fetching (`eval-view/api.js`)
- [ ] **Use Grouped Tasks Manifest**: Update client code to fetch from `./grouped-tasks.gen.json` instead of the `/api/grouped-tasks` endpoint when in static mode.


