#!/usr/bin/env bash
exec "$(dirname "$0")/../src/harness/nightly/run-agent.sh" "$@"
