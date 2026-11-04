/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChromeModernWebGuidance, LogRequest } from '../types.ts';

export interface ClearcutSenderConfig {
  clearcutEndpoint?: string;
  includePidHeader?: boolean;
}

const MAX_BUFFER_SIZE = 1000;
const DEFAULT_CLEARCUT_ENDPOINT = 'https://play.googleapis.com/log?format=json_proto';

const LOG_SOURCE = 2921;
const CLIENT_TYPE = 50;
const REQUEST_TIMEOUT_MS = 10_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;

interface BufferedEvent {
  event: ChromeModernWebGuidance;
  timestamp: number;
}

function logger(...args: any[]) {
  if (process.env.DEBUG_MWG_TELEMETRY === '1') {
    console.error('[ClearcutSender]', ...args);
  }
}

export class ClearcutSender {
  #clearcutEndpoint: string;
  #includePidHeader: boolean;
  #buffer: BufferedEvent[] = [];

  constructor(config: ClearcutSenderConfig = {}) {
    this.#clearcutEndpoint =
      config.clearcutEndpoint ?? DEFAULT_CLEARCUT_ENDPOINT;
    this.#includePidHeader = config.includePidHeader ?? false;
  }

  enqueueEvent(event: ChromeModernWebGuidance): void {
    logger('Enqueuing telemetry event', JSON.stringify(event, null, 2));
    if (this.#buffer.length >= MAX_BUFFER_SIZE) {
      this.#buffer.shift();
      logger('Telemetry buffer overflow: dropped oldest event');
    }
    this.#buffer.push({
      event,
      timestamp: Date.now(),
    });
  }

  async sendShutdownEvent(): Promise<void> {
    if (this.#buffer.length === 0) {
      return;
    }
    const eventsToSend = [...this.#buffer];
    this.#buffer = [];

    try {
      await Promise.race([
        this.#sendBatch(eventsToSend),
        new Promise(resolve => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)),
      ]);
      logger('Final flush completed');
    } catch (error) {
      logger('Final flush failed:', error);
    }
  }

  async #sendBatch(events: BufferedEvent[]): Promise<void> {
    logger(`Sending batch of ${events.length} events`);
    const requestBody: LogRequest = {
      log_source: LOG_SOURCE,
      request_time_ms: Date.now().toString(),
      client_info: {
        client_type: CLIENT_TYPE,
      },
      log_event: events.map(({event, timestamp}) => ({
        event_time_ms: timestamp.toString(),
        source_extension_json: JSON.stringify(event),
      })),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(this.#clearcutEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.#includePidHeader
            ? {'X-Watchdog-Pid': process.pid.toString()}
            : {}),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok) {
        logger('Telemetry error status:', response.status);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      logger('Fetch failed:', err);
    }
  }
}
