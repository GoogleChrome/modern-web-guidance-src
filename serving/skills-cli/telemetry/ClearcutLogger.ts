/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WatchdogClient } from './WatchdogClient.js';
import {
  type ChromeModernWebGuidance,
  WatchdogMessageType,
} from './types.js';

function isTelemetryEnabled(): boolean {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const telemetryFilePath = path.join(currentDir, '.telemetry');
  
  if (!fs.existsSync(telemetryFilePath)) {
    return false; // Off by default
  }
  try {
    const content = fs.readFileSync(telemetryFilePath, 'utf-8').trim();
    return content === 'true';
  } catch {
    return false;
  }
}

export class ClearcutLogger {
  #watchdog: WatchdogClient | null = null;
  #enabled: boolean;

  constructor(options: {
    logFile?: string;
    clearcutEndpoint?: string;
    clearcutIncludePidHeader?: boolean;
  } = {}) {
    this.#enabled = isTelemetryEnabled();
    if (this.#enabled) {
      this.#watchdog = new WatchdogClient({
        parentPid: process.pid,
        logFile: options.logFile,
        clearcutEndpoint: options.clearcutEndpoint,
        clearcutIncludePidHeader: options.clearcutIncludePidHeader,
      });
    }
  }

  async logSearchResult(guideIds: string[]): Promise<void> {
    if (!this.#enabled || !this.#watchdog) {
      return;
    }

    const payload: ChromeModernWebGuidance = {
      search_result: {
        search_items: guideIds.map(id => ({ guide_id: id })),
      },
    };

    this.#watchdog.send({
      type: WatchdogMessageType.LOG_EVENT,
      payload: payload,
    });
  }

  async logRetrieveResult(guideIds: string[]): Promise<void> {
    if (!this.#enabled || !this.#watchdog) {
      return;
    }

    const payload: ChromeModernWebGuidance = {
      retrieve_result: {
        guide_id: guideIds,
      },
    };

    this.#watchdog.send({
      type: WatchdogMessageType.LOG_EVENT,
      payload: payload,
    });
  }
}
