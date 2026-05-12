/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WatchdogClient } from './WatchdogClient.js';
import {
  type ChromeModernWebGuidance,
  type SearchItem,
  type Installation,
  WatchdogMessageType,
  OsType,
} from './types.js';

function isTelemetryEnabled(): boolean {
  if (process.env.DISABLE_TELEMETRY === '1' || process.env.DISABLE_TELEMETRY === 'true') {
    return false;
  }
  return true; // Enabled by default!
}

// TODO (micahjo): after the package install is updated to pull from NPM, update this so it finds the version in the right place
function getCliVersion(): string {
  try {
    const pkgPath = fileURLToPath(new URL('./package.json', import.meta.url));
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function detectOS(): OsType {
  const platform = process.platform;
  if (platform === 'darwin') return OsType.MACOS;
  if (platform === 'win32') return OsType.WINDOWS;
  if (platform === 'linux') return OsType.LINUX;
  return OsType.UNSPECIFIED;
}

const LATENCY_BUCKETS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];

export function bucketizeLatency(latencyMs: number): number {
  for (const bucket of LATENCY_BUCKETS) {
    if (latencyMs <= bucket) {
      return bucket;
    }
  }
  return LATENCY_BUCKETS[LATENCY_BUCKETS.length - 1];
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
      console.warn("Sending telemetry event. Opt-out of usage statistics collection by setting the environment variable DISABLE_TELEMETRY=1.");
      this.#watchdog = new WatchdogClient({
        parentPid: process.pid,
        logFile: options.logFile,
        clearcutEndpoint: options.clearcutEndpoint,
        clearcutIncludePidHeader: options.clearcutIncludePidHeader,
      });
    }
  }

  async logSearchResult(
    searchItems: SearchItem[],
    metrics?: { latencyMs: number; success?: boolean }
  ): Promise<void> {
    if (!this.#enabled) {
      return;
    }

    const payload: ChromeModernWebGuidance = {
      search_result: {
        search_items: searchItems,
      },
      os: detectOS(),
      cli_version: getCliVersion(),
      latency_ms: metrics?.latencyMs !== undefined ? bucketizeLatency(metrics.latencyMs) : undefined,
      success: metrics?.success,
    };

    console.warn(JSON.stringify(payload));

    if (!this.#watchdog) {
      return;
    }

    this.#watchdog.send({
      type: WatchdogMessageType.LOG_EVENT,
      payload: payload,
    });
  }

  async logRetrieveResult(
    guideId: string,
    metrics?: { latencyMs: number; success?: boolean }
  ): Promise<void> {
    if (!this.#enabled) {
      return;
    }

    const payload: ChromeModernWebGuidance = {
      retrieve_result: {
        guide_id: guideId,
      },
      os: detectOS(),
      cli_version: getCliVersion(),
      latency_ms: metrics?.latencyMs !== undefined ? bucketizeLatency(metrics.latencyMs) : undefined,
      success: metrics?.success,
    };

    console.warn(JSON.stringify(payload));

    if (!this.#watchdog) {
      return;
    }

    this.#watchdog.send({
      type: WatchdogMessageType.LOG_EVENT,
      payload: payload,
    });
  }

  async logInstallation(
    skills: string[],
    metrics?: { latencyMs?: number; success?: boolean }
  ): Promise<void> {
    if (!this.#enabled) {
      return;
    }

    const payload: ChromeModernWebGuidance = {
      installation: {
        skills: skills,
      },
      os: detectOS(),
      cli_version: getCliVersion(),
      latency_ms: metrics?.latencyMs !== undefined ? bucketizeLatency(metrics.latencyMs) : undefined,
      success: metrics?.success,
    };

    console.warn(JSON.stringify(payload));

    if (!this.#watchdog) {
      return;
    }

    this.#watchdog.send({
      type: WatchdogMessageType.LOG_EVENT,
      payload: payload,
    });
  }
}
