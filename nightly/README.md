# Nightly Run Setup

This directory contains scripts to automate nightly evaluation runs. 

## 1. Setup a Dedicated Nightly Repository
To avoid interference with active work, clone a dedicated repository on your local gLinux cloudtop.
Please make sure to follow `<repo_root>/README.md` on setting up credentials for Jetski, Claude and Codex.
Related environment variables can be set at `<repo_root>/.env`.

**Safety Note:** The nightly scripts implement a strict fail-fast mechanism. They will immediately abort if the repository has **any uncommitted changes** (including untracked files). This ensures no user progress is accidentally lost. The workflow executes entirely within isolated `nightly-*` branches created directly from `origin/main`. Please avoid using the `nightly-*` prefix for your own active local branches to prevent any potential conflicts.

Evaluation results are uploaded automatically to the dashboard and can be viewed at `go/guidance-evals`.

## 2. Generating the Cron Job Entry
Please run all the following commands from within the `nightly/` directory.

You can set up a cron job to automatically trigger the master run every night. Run the helper script to automatically add the cron entry to your crontab. It will automatically resolve the absolute path to your repository.

```bash
./setup_cron.sh
```

By default, it sets the schedule to 2:00 AM (`0 2 * * *`) and runs all 3 agents (`jetski_cli`, `claude_code`, `codex_cli`).

You can customize the schedule and the agents to run using flags:
*   `--schedule SCHEDULE`: Specify a custom cron schedule (must be quoted).
*   `--prefix PREFIX`: Specify a custom prefix for this periodic run (default: "nightly") (optional).
*   `--agents AGENTS`: Specify a space-separated list of agents to run (must be quoted).
*   `--workers WORKERS`: The number of concurrent workers to use (optional).

For example, to run only `jetski_cli` and `claude_code` at 3:30 AM with 20 workers:

```bash
./setup_cron.sh --schedule "30 3 * * *" --agents "jetski_cli claude_code" --workers 20
```

Or, to setup the cron job to run once a week on **Sunday night at 10:00 PM** (using prefix `"weekly"`):

```bash
./setup_cron.sh --schedule "0 22 * * 0" --prefix "weekly"
```

To modify or remove the cron job later, run `crontab -e`.
Nightly run outputs are logged to the `$HOME/.guidance_logs/` directory by default. You can check these log files if the cron job or manual run fails silently. The master run triggered by the cron job will automatically send an email notification (via `sendgmr`) with a summary of the results upon completion or failure.

## 3. Manual Runs
To kick-start a dedicated run manually for a specific agent, you can use:

```bash
./run_agent.sh --agent <agent>
```
Valid agents are: `jetski_cli`, `claude_code`, `codex_cli`.

To manually trigger the master sequence:

```bash
./run_guidance_nightly.sh
```

You can also specify which agents to run using the `--agents` flag, and the number of concurrent workers using the `--workers` flag:

```bash
./run_guidance_nightly.sh --agents "jetski_cli codex_cli" --workers 20
```

Note: Executing `run_guidance_nightly.sh` (either manually or via cron) will automatically send an email notification to your LDAP with a summary of the results for all agents upon completion or failure.
