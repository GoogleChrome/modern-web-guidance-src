# Nightly Run Setup

This directory contains scripts to automate nightly evaluation runs. 

## 1. Setup a Dedicated Nightly Repository
To avoid interference with active work, clone a dedicated repository on your local gLinux cloudtop.
Please make sure to follow `<repo_root>/README.md` on setting up credentials for Jetski, Calude and Codex.
Related environment variables can be set at `<repo_root>/.env`.

**Safety Note:** The nightly scripts implement a strict fail-fast mechanism. They will immediately abort if the repository has **any uncommitted changes** (including untracked files). This ensures no user progress is accidentally lost. The workflow executes entirely within isolated `nightly-*` branches created directly from `origin/main`. Please avoid using the `nightly-*` prefix for your own active local branches to prevent any potential conflicts.

Evaluation results are uploaded automatically to the dashboard and can be viewed at `go/guidance-evals`.

## 2. Generating the Cron Job Entry
Please run all the following commands from within the `nightly/` directory.

You can set up a cron job to automatically trigger the master run every night. Run the helper script to automatically add the cron entry to your crontab. It will automatically resolve the absolute path to your repository.

```bash
./setup_cron.sh
```

By default, it sets the schedule to 2:00 AM (`0 2 * * *`). You can customize the time by passing a cron schedule string as an argument. For example, to run it at 3:30 AM:

```bash
./setup_cron.sh "30 3 * * *"
```

To modify or remove the cron job later, run `crontab -e`.
Nightly run outputs are logged to the `$HOME/.guidance_logs/` directory by default. You can check these log files if the cron job or manual run fails silently. The master run triggered by the cron job will automatically send an email notification (via `sendgmr`) with a summary of the results upon completion or failure.

## 3. Manual Runs
To kick-start a dedicated run manually for a specific agent, you can use:

```bash
./run_agent.sh <agent>
```
Valid agents are: `jetski_cli`, `claude`, `codex`.

To manually trigger the master sequence:

```bash
./run_guidance_nightly.sh
```
Note: Executing `run_guidance_nightly.sh` (either manually or via cron) will automatically send an email notification to your LDAP with a summary of the results for all agents upon completion or failure.