/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process';
import { WatchdogClient } from './WatchdogClient.ts';
import {
  type ChromeModernWebGuidance,
  type SearchItem,
  CommandType,
  WatchdogMessageType,
  OsType,
} from './types.ts';
import { getVersion } from '../../lib/version.ts';

function isTelemetryEnabled(): boolean {
  const optOutSetting = process.env.DISABLE_TELEMETRY?.toLowerCase();
  if (optOutSetting === '1' || optOutSetting === 'true') {
    return false;
  }
  return true; // Enabled by default!
}

export function detectOS(): OsType {
  const platform = process.platform;
  if (platform === 'darwin') return OsType.MACOS;
  if (platform === 'win32') return OsType.WINDOWS;
  if (platform === 'linux') return OsType.LINUX;
  return OsType.UNSPECIFIED;
}

const LATENCY_BUCKETS = [5, 15, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

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
  #skillVersion?: string;

  constructor(options: {
    clearcutEndpoint?: string;
    clearcutIncludePidHeader?: boolean;
    skillVersion?: string | null;
  } = {}) {
    if (!isTelemetryEnabled()) {
      return;
    }
    this.#skillVersion = options.skillVersion ?? undefined;
    this.#watchdog = new WatchdogClient({
      clearcutEndpoint: options.clearcutEndpoint,
      clearcutIncludePidHeader: options.clearcutIncludePidHeader,
    });
  }

  async logSearchResult(latencyMs: number, success: boolean, searchItems: SearchItem[]): Promise<void> {
    if (!this.#watchdog) {
      return;
    }

    const payload: ChromeModernWebGuidance = {
      search_result: {
        search_items: searchItems,
      },
      os: detectOS(),
      version: getVersion(import.meta.dirname),
      skill_version: this.#skillVersion,
      latency_ms: bucketizeLatency(latencyMs),
      success,
    };

    this.#watchdog.send({
      type: WatchdogMessageType.LOG_EVENT,
      payload: payload,
    });
  }

  async logRetrieveResult(latencyMs: number, success: boolean, guideId: string): Promise<void> {
    if (!this.#watchdog) {
      return;
    }

    const payload: ChromeModernWebGuidance = {
      retrieve_result: {
        guide_id: guideId,
      },
      os: detectOS(),
      version: getVersion(import.meta.dirname),
      skill_version: this.#skillVersion,
      latency_ms: bucketizeLatency(latencyMs),
      success,
    };

    this.#watchdog.send({
      type: WatchdogMessageType.LOG_EVENT,
      payload: payload,
    });
  }

  async logToolCommand(latencyMs: number, success: boolean, commandType: CommandType): Promise<void> {
    if (!this.#watchdog) {
      return;
    }

    if (commandType == CommandType.INSTALL || commandType == CommandType.INSTALL_CHOOSE) {
      console.warn(
        "Google collects anonymous usage statistics to improve the reliability, relevance, and performance of the Modern Web Guidance tool. " +
        "You can opt-out completely at any time by setting the DISABLE_TELEMETRY=1 environment variable in your shell profile. " +
        "See https://github.com/GoogleChrome/modern-web-guidance#-telemetry--privacy for more details."
      );
    }

    const payload: ChromeModernWebGuidance = {
      tool_command: {
        command_type: commandType,
      },
      os: detectOS(),
      version: getVersion(import.meta.dirname),
      skill_version: this.#skillVersion,
      latency_ms: bucketizeLatency(latencyMs),
      success,
    };

    this.#watchdog.send({
      type: WatchdogMessageType.LOG_EVENT,
      payload: payload,
    });
  }
}
