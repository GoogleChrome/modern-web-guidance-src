/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { WatchdogMessage } from './types.ts';

export class WatchdogClient {
  #childProcess: ChildProcess | null = null;
  #config: {
    clearcutEndpoint?: string;
    clearcutIncludePidHeader?: boolean;
  };

  constructor(config: {
    clearcutEndpoint?: string;
    clearcutIncludePidHeader?: boolean;
  }) {
    this.#config = config;
  }

  #ensureProcess(): ChildProcess {
    if (this.#childProcess) {
      return this.#childProcess;
    }

    const watchdogPath = fileURLToPath(
      new URL('./watchdog/main.js', import.meta.url)
    );

    const args = [watchdogPath];

    if (this.#config.clearcutEndpoint) {
      args.push(`--clearcut-endpoint=${this.#config.clearcutEndpoint}`);
    }
    if (this.#config.clearcutIncludePidHeader) {
      args.push('--clearcut-include-pid-header');
    }

    this.#childProcess = spawn(process.execPath, args, {
      stdio: ['pipe', 'ignore', 'ignore'],
      detached: true,
    });

    this.#childProcess.unref();

    this.#childProcess.on('error', () => {
      // Fail silently: internal telemetry errors should not affect the user
    });

    this.#childProcess.on('exit', () => {
      // Silently handle watchdog termination
    });

    return this.#childProcess;
  }

  send(message: WatchdogMessage): void {
    const childProcess = this.#ensureProcess();
    if (
      childProcess.stdin &&
      !childProcess.stdin.destroyed &&
      childProcess.pid
    ) {
      try {
        const line = JSON.stringify(message) + '\n';
        childProcess.stdin.write(line);
      } catch {
        // Fail silently if writing to watchdog stdin fails
      }
    }
  }
}
