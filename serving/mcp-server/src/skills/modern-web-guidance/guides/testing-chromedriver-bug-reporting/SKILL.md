---
description: Provides guidance on how to report and track bugs or request features for ChromeDriver, including understanding priority and status levels, and support policies.
filename: chromedriver-bug-reporting
category: testing
---

# ChromeDriver Bug Reporting and Support

This document outlines the process for reporting bugs, requesting features, and understanding the support policy for ChromeDriver.

## Getting Help

If you have a general question or need help using ChromeDriver, you can email the [chromedriver-users group](https://groups.google.com/g/chromedriver-users).

Before filing a bug, it is recommended to check the [existing issues](http://code.google.com/p/chromedriver/issues/) to see if a similar problem has already been reported.

ChromeDriver is an open-source project maintained by contributors who regularly monitor the issue list. Issues are assigned a priority and a status to manage their lifecycle.

## Priority Levels

*   **P0**: Will resolve before the next release.
*   **P1**: Consider resolving for the next release.
*   **P2**: Consider resolving for the next quarter.
*   **P3**: Low priority.

## Statuses

### Open Statuses:

*   **Unconfirmed**: New issue, has not been verified or reproduced.
*   **Untriaged**: Confirmed, but not yet reviewed for priority and assignment.
*   **Available**: Triaged, but no owner has been assigned.
*   **Assigned**: An owner has been assigned, but work has not yet started.
*   **Started**: Work is currently in progress.
*   **ExternalDependency**: Requires action from a third party before progress can be made.

### Closed Statuses:

*   **Fixed**: Work has been completed and requires verification.
*   **Verified**: A test or the reporter has confirmed that the fix works.
*   **Duplicate**: The issue has the same root cause as another reported issue.
*   **WontFix**: Cannot reproduce, works as intended, is invalid, or is obsolete.
*   **Archived**: An old issue with no recent activity.

## Support Policy

ChromeDriver only supports the current stable and beta versions. Bugs filed against older versions of ChromeDriver may be closed without resolution.