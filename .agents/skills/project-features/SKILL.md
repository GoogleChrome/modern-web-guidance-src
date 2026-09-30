---
name: project-features
description: Criteria and best practices for filing and triaging `new-feature` issues. Use this skill any time you file a new-feature issue, triage one, fix its web-feature ID, or decide whether a browser launch needs guidance at all.
---

# Filing and triaging new-feature issues

A `new-feature` issue says "this web platform feature needs guidance". It comes before use cases (see the `project-use-cases` skill), and automation depends on it:

* **ATL routing:** `guides/atl-triage.ts` assigns an ATL based on the issue's labels and its web-feature ID.
* **Use case tracking:** `guides/sync-use-cases.ts` (called "the sync" below, run by the guide-sync workflow) matches use-case issues to the feature issue by ID. It also writes the use case checklist into the issue body, sets the project status and closes the issue when every use case is done.
* **Priority:** the feature issue's priority label and milestone are copied to its use-case issues.
* **Coverage:** guidance coverage is measured by whether a feature's web-feature ID appears in a published guide.

Most triage problems come from one of five mistakes: using the template for a general request, filing a launch that isn't developer-facing, filing an incremental change as a new feature, filing a duplicate, or giving the issue the wrong ID. This skill covers each one.

Always confirm with the user before you post a comment, edit an issue body, change labels, set a status or close an issue.

## Step 1: Decide whether it qualifies

Work through these questions in order. Stop at the first one that settles it.

### Is it about a specific web platform feature?

The new-feature template is for one web platform feature that has shipped, or is about to ship, in a browser. People sometimes use it as a general request for guidance instead. Relabel these rather than closing them:

* **A request for guidance on a topic or problem,** such as "PWA guidance" or submitting a chat message with Enter without breaking IME input: remove `new-feature` and add `content`, and the ATL decides whether it becomes a use case. Don't add `new-use-case`: the sync treats any `new-use-case` issue it didn't create as an orphan and closes it as not planned.
* **A problem with existing guidance,** such as an incorrect code example: remove `new-feature` and add `bug`, which is what the bug report template uses.

### Is it developer-facing?

Guidance only helps if a developer has to write or change code. Close the issue as **not planned** and remove the `new-feature` label when the launch is any of the following:

* **Described by the browser as having no developer-visible change.**
* **A bug fix or spec-alignment fix** that doesn't add an API or change a pattern we recommend. For example, correcting the `dropEffect` values in drag events.
* **Automatic browser behavior,** such as rendering, font shaping, UA stylesheet or initial-value changes, or a new storage backend. Examples: avar2 font rendering and a new IndexedDB storage backend.
* **An existing API arriving on another platform** of the same browser, such as the Web Serial API on Android.
* **Internal security hardening** with nothing for developers to change.
* **A removal of an API.** Browsers only remove an API once its usage is low enough that removing it won't cause significant breakage.
* **An experiment or trial that ended** without shipping.

Close with a one-line reason, for example: "Spec-alignment fix to event timing; no new API or pattern to recommend."

Deprecations are different from removals: guides may need to start discouraging the deprecated API. Don't close them. Remove `new-feature` and handle them like an incremental change (Step 4), so the ATL can decide whether guides need to change.

### Is it a new feature or an incremental change?

The test: **does the launch have, or deserve, its own web-features entry?**

* **New feature:** web-features has an entry for it, or should have one. Examples: `margin-trim`, `url-integrity`, `polygon()` rounding. Keep the `new-feature` label.
* **Incremental change:** a later launch that extends a feature that already has an entry, and wouldn't get its own. Examples: `appearance: base-select` in listbox mode (a change to `customizable-select`) and prerendering cross-origin iframes (a change to `speculation-rules`). These don't get the `new-feature` label. Handle them as described in Step 4.

Web-features sometimes folds a launch into an older feature when it deserves its own entry, for example `polygon()` rounding in `shapes`. In that case, request an entry upstream (see Step 2) and treat it as a new feature.

### Is it already tracked?

Search before you file. Duplicates are common: automation files the same launch twice, or files one that someone already filed by hand. Search open **and** closed issues, with and without the `new-feature` label, for:

* the web-feature ID and any `tmp-` ID for it
* the feature's name and its main API or property name
* the URL of any browser feature-tracker entry linked from the issue

Also check whether a guide already lists the ID: `git grep -n "<id>" -- 'guides/**/guide.md'`, plus open PRs. If a guide covers it, the launch may only be an incremental change to that guide.

## Step 2: Choose exactly one web-feature ID

Each new-feature issue carries **exactly one** ID, and the ID must match what guides will list in their `web-feature-ids`. Coverage is counted by that match, so keep IDs correct even on closed issues.

* **Find it** on [webstatus.dev](https://webstatus.dev/) or in the `web-features` package.
* **Don't trust IDs copied from browser feature trackers.** They are often wrong: `usermedia` for a `getDisplayMedia()` option, `shape-function` for `polygon()` rounding, or `html` for processing instructions.
* **Verify with the feature's BCD keys, not its one-line description.** An entry covers what its `compat_features` list covers. When no entry lists the feature's keys, pick the entry whose keys sit next to it (the same dictionary or interface) and add a one-line note on the issue explaining the choice.
* **If web-features has no entry,** check `features/draft/` in the [web-features repo](https://github.com/web-platform-dx/web-features). A key that appears only in a draft file has no ID yet. Search the web-features issues for an existing request, and open one if there isn't any. Then use a `tmp-<candidate-id>` ID that matches the ID proposed upstream exactly. If upstream hasn't proposed one, use the most likely ID and update it if upstream chooses differently. Register it with its upstream link in [features/pending-web-features.json](../../../features/pending-web-features.json). CI flags the `tmp-` ID once the real one is published.
* **One launch, several features:** file one issue per ID. Cross-reference the issues in a comment, and don't nest them as sub-issues, because they are siblings. For example, one issue for the `url()` modifiers `cross-origin()`, `referrer-policy()` and `integrity()` becomes three issues.

### Parser pitfalls

`extractFeatureIds` in [lib/feature-parser.ts](../../../lib/feature-parser.ts) is strict, and a malformed ID fails silently, so no automation ever sees the issue:

* **Only the first line under `### web-feature-id` is read.** A second ID on the next line is dropped.
* **Commas aren't split.** `url-cross-origin, url-integrity` becomes one ID that matches nothing.
* **A bare URL becomes its last path segment.** A link to a web-features issue reads as `4108`. Use a `tmp-` ID instead.
* **Placeholders become IDs.** `N/A`, `TBD`, `Missing` and `Pending` all parse as IDs that match nothing.
* **Any `webstatus.dev/features/<id>` link anywhere in the body is read as an ID.** Don't link related features' webstatus.dev pages in the description.
* **Any `Feature ID:` line anywhere in the body is read too,** not just the first one.

## Step 3: File or fix the issue

Use the [new-feature template](https://github.com/GoogleChrome/modern-web-guidance-src/issues/new?template=new-feature.yml). When you triage an existing issue, including one filed by automation, correct the same fields:

* **Title:** the feature's name, for example "integrity() for url()". Use the ID only when it is also the name.
* **web-feature-id:** the single ID from Step 2.
* **Feature description:** the web-features description, or a short summary of the browser's announcement. Link the spec or feature-tracker entry.
* **Expected release date:** the browser and version, for example "Firefox 150". Label any version where the feature is only behind a flag or in a trial, and include the stable version too if it's known, for example "Firefox 148 (behind a flag), Firefox 150 (stable)". An unlabeled version is read as the stable release.
* **Coding agent assessment:** optional. Poor output from a coding agent is a useful hint that guidance would help. Good output isn't a reason to skip the feature, though: only evals show that reliably, and evals come after deciding to write guidance.
* **Labels:** `new-feature` plus a category label such as `css`, `forms`, `performance` or `security`. The category label is what routes the issue to an ATL when the feature's web-features group isn't mapped in [guides/atls.json](../../../guides/atls.json). Adding labels needs triage access to the repo. Without it, suggest the label in a comment.

Don't say where the guidance should go. The ATL decides that when they triage the issue.

## Step 4: Handle what doesn't qualify

| Situation | Action |
| --- | --- |
| Not developer-facing | Remove `new-feature` and close as not planned with a one-line reason. |
| Duplicate | Read the comments on every copy first, since an owner may have already chosen one to keep. Otherwise keep the older issue. Remove `new-feature` from the other copy and close it as a duplicate. |
| Incremental change, and a guide covers the feature | Remove `new-feature`. Nest the issue as a sub-issue of the use-case issue ("Create guide and evals for the X use case") of the guide that should change, and comment on that issue describing the change. If that use-case issue is closed or Done, set its project status to **Needs investigation** so it reopens and stays open. This needs triage access; without it, ask for it in the comment. |
| Incremental change, no guide covers the feature, and the feature has a new-feature issue | Remove `new-feature` and nest the issue as a sub-issue of the feature's new-feature issue, so whoever plans its use cases sees the change. |
| Incremental change, no guide covers the feature, and the feature has no issue or was closed as not planned | Remove `new-feature` and leave the decision to the ATL. They may file the feature or close the change with a note. |

**Always remove the `new-feature` label when closing a duplicate or a non-qualifying issue.** The sync reads closed `new-feature` issues too. When two issues share an ID, the sync links whichever it processes last, and it reopens a closed issue that has active use cases.

Don't close a qualifying feature issue by hand. The sync closes it once all of its use cases have guides and evals, and it reopens issues closed too early. Don't edit the use case checklist between the `use-cases-start` and `use-cases-end` markers either, because the sync rewrites it.

## After triage: the feature through the pipeline

The later stages have their own skills. This is how a feature's issue and ID move through them:

1. **Use cases.** The ATL identifies use cases and adds a stub guide for each one that lists the feature's ID in `web-feature-ids` (see the `project-use-cases` skill). Until a guide lists the ID, the sync keeps the feature issue at **Needs use cases**.
2. **Use-case issues.** The sync opens a "Create guide and evals for the X use case" issue for each guide and adds it to the checklist of every feature issue whose ID the guide lists. Each use-case issue moves from **Needs guidance** to **Needs evals**, and closes once the guide has evals (see the `project-guides` and `project-evals` skills).
3. **Coverage.** A feature counts as covered once a published guide, one with non-draft content, lists its ID. The guide doesn't need evals to count.
4. **Closing.** The sync closes the feature issue once all of its use-case issues are closed. Setting either kind of issue to **Needs investigation** keeps it open, for example when a later incremental change or deprecation means a finished guide needs updating.
5. **`tmp-` IDs.** When web-features publishes the real ID, the web-features update workflow fails and lists every file that still uses the `tmp-` ID. Replace it with the real ID everywhere, including the feature issue, and remove its entry from `features/pending-web-features.json`. The switch is only detected when the real ID is the `tmp-` ID without its prefix.
