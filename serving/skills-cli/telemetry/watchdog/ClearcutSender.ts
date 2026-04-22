/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChromeModernWebGuidance, LogRequest } from '../types.js';

export interface ClearcutSenderConfig {
  clearcutEndpoint?: string;
  includePidHeader?: boolean;
}

const DEFAULT_CLEARCUT_ENDPOINT = 'https://play.googleapis.com/log?format=json_proto';

const LOG_SOURCE = 2921;
const CLIENT_TYPE = 50;
const REQUEST_TIMEOUT_MS = 10_000;

export class ClearcutSender {
  #clearcutEndpoint: string;
  #includePidHeader: boolean;

  constructor(config: ClearcutSenderConfig = {}) {
    this.#clearcutEndpoint =
      config.clearcutEndpoint ?? DEFAULT_CLEARCUT_ENDPOINT;
    this.#includePidHeader = config.includePidHeader ?? false;
  }

  enqueueEvent(event: ChromeModernWebGuidance): void {
    console.log('Sending telemetry event', JSON.stringify(event, null, 2));
    this.#sendEvent(event).catch(err => {
      console.error('Failed to send telemetry event:', err);
    });
  }

  async sendShutdownEvent(): Promise<void> {
    // No shutdown event needed for this simplified version,
    // and no buffer to flush.
    return Promise.resolve();
  }

  async #sendEvent(event: ChromeModernWebGuidance): Promise<void> {
    const requestBody: LogRequest = {
      log_source: LOG_SOURCE,
      request_time_ms: Date.now().toString(),
      client_info: {
        client_type: CLIENT_TYPE,
      },
      log_event: [{
        event_time_ms: Date.now().toString(),
        source_extension_json: JSON.stringify(event),
      }],
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
        console.error('Telemetry server returned error:', response.status);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Fetch error in telemetry:', err);
    }
  }
}
