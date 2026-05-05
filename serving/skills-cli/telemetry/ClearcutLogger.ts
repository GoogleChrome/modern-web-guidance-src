/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process';
import { WatchdogClient } from './WatchdogClient.js';
import {
  type ChromeModernWebGuidance,
  WatchdogMessageType,
} from './types.js';

function isTelemetryEnabled(): boolean {
  if (process.env.DISABLE_MWG_TELEMETRY === '1' || process.env.DISABLE_MWG_TELEMETRY === 'true') {
    return false;
  }
  return true; // Enabled by default!
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
      console.log("Sending telemetry event. Opt-out of usage statistics collection by setting the environment variable DISABLE_MWG_TELEMETRY=1.");
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
