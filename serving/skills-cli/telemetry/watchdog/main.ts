/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process';
import readline from 'node:readline';
import { parseArgs } from 'node:util';

import { WatchdogMessageType } from '../types.js';
import { ClearcutSender } from './ClearcutSender.js';

interface WatchdogArgs {
  parentPid: number;
  logFile?: string;
  clearcutEndpoint?: string;
  clearcutIncludePidHeader?: boolean;
}

function parseWatchdogArgs(): WatchdogArgs {
  const { values } = parseArgs({
    options: {
      'parent-pid': { type: 'string' },
      'log-file': { type: 'string' },
      'clearcut-endpoint': { type: 'string' },
      'clearcut-include-pid-header': { type: 'boolean' },
    },
    strict: true,
  });

  const parentPid = parseInt(values['parent-pid'] ?? '', 10);

  if (isNaN(parentPid)) {
    console.error(
      'Invalid arguments provided for watchdog process: ',
      JSON.stringify({ parentPid })
    );
    process.exit(1);
  }

  const logFile = values['log-file'];
  const clearcutEndpoint = values['clearcut-endpoint'];
  const clearcutIncludePidHeader = values['clearcut-include-pid-header'];

  return {
    parentPid,
    logFile,
    clearcutEndpoint,
    clearcutIncludePidHeader,
  };
}

function main() {
  const {
    parentPid,
    clearcutEndpoint,
    clearcutIncludePidHeader,
  } = parseWatchdogArgs();

  console.log(
    'Watchdog started',
    JSON.stringify(
      {
        pid: process.pid,
        parentPid,
      },
      null,
      2
    )
  );

  const sender = new ClearcutSender({
    clearcutEndpoint,
    includePidHeader: clearcutIncludePidHeader,
  });

  let isShuttingDown = false;
  function onParentDeath(reason: string) {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Parent death detected (${reason}). Sending shutdown event...`);
    sender
      .sendShutdownEvent()
      .then(() => {
        console.log('Shutdown event sent. Exiting.');
        process.exit(0);
      })
      .catch(err => {
        console.error('Failed to send shutdown event', err);
        process.exit(1);
      });
  }

  process.stdin.on('end', () => onParentDeath('stdin end'));
  process.stdin.on('close', () => onParentDeath('stdin close'));
  process.on('disconnect', () => onParentDeath('ipc disconnect'));

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
