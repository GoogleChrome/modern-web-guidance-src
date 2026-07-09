/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process';
import readline from 'node:readline';
import { parseArgs } from 'node:util';

import { WatchdogMessageType } from '../types.ts';
import { ClearcutSender } from './ClearcutSender.ts';

interface WatchdogArgs {
  clearcutEndpoint?: string;
  clearcutIncludePidHeader?: boolean;
}

function parseWatchdogArgs(): WatchdogArgs {
  const { values } = parseArgs({
    options: {
      'clearcut-endpoint': { type: 'string' },
      'clearcut-include-pid-header': { type: 'boolean' },
    },
    strict: true,
  });

  const clearcutEndpoint = values['clearcut-endpoint'];
  const clearcutIncludePidHeader = values['clearcut-include-pid-header'];

  return {
    clearcutEndpoint,
    clearcutIncludePidHeader,
  };
}

function main() {
  const {
    clearcutEndpoint,
    clearcutIncludePidHeader,
  } = parseWatchdogArgs();

  const sender = new ClearcutSender({
    clearcutEndpoint,
    includePidHeader: clearcutIncludePidHeader,
  });

  let isShuttingDown = false;

  function onParentDeath() {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    sender.sendShutdownEvent()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }

  process.stdin.on('end', () => onParentDeath());
  process.stdin.on('close', () => onParentDeath());
  process.on('disconnect', () => onParentDeath());

  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  rl.on('line', line => {
    try {
      if (!line.trim()) {
        return;
      }

      const msg = JSON.parse(line);
      if (msg.type === WatchdogMessageType.LOG_EVENT && msg.payload) {
        sender.enqueueEvent(msg.payload);
      }
    } catch (err) {
      console.error('Failed to parse IPC message', err);
    }
  });
}

try {
  main();
} catch (err) {
  console.error('Watchdog fatal error:', err);
  process.exit(1);
}
