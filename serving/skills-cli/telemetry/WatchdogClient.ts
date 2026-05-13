/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { WatchdogMessage } from './types.ts';

export class WatchdogClient {
  #childProcess: ChildProcess;

  constructor(config: {
    clearcutEndpoint?: string;
    clearcutIncludePidHeader?: boolean;
  }) {
    const watchdogPath = fileURLToPath(
      new URL('./watchdog/main.js', import.meta.url)
    );

    const args = [watchdogPath];

    if (config.clearcutEndpoint) {
      args.push(`--clearcut-endpoint=${config.clearcutEndpoint}`);
    }
    if (config.clearcutIncludePidHeader) {
      args.push('--clearcut-include-pid-header');
    }

    this.#childProcess = spawn(process.execPath, args, {
      stdio: ['pipe', 'ignore', 'ignore'],
      detached: true,
    });
    
    this.#childProcess.unref();
    
    this.#childProcess.on('error', err => {
      console.error('Watchdog process error:', err);
    });
    
    this.#childProcess.on('exit', (code, signal) => {
      console.warn(`Watchdog exited with code ${code} and signal ${signal}`);
    });
  }

  send(message: WatchdogMessage): void {
    if (
      this.#childProcess.stdin &&
      !this.#childProcess.stdin.destroyed &&
      this.#childProcess.pid
    ) {
      try {
        const line = JSON.stringify(message) + '\n';
        this.#childProcess.stdin.write(line);
      } catch (err) {
        console.error('Failed to write to watchdog stdin', err);
      }
    } else {
      console.warn('Watchdog stdin not available, dropping message');
    }
  }
}
