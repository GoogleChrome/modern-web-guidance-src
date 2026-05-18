/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Protobuf message interfaces for Chrome Modern Web Guidance
export interface SearchItem {
  guide_id?: string;
  similarity?: number;
}

export interface SearchResult {
  search_items?: SearchItem[];
}

export interface RetrieveResult {
  guide_id?: string;
}

export const CommandType = {
  UNSPECIFIED: 0,
  INSTALL: 1,
  INSTALL_CHOOSE: 2,
  UPDATE: 3,
  UNINSTALL: 4,
} as const;

export type CommandType = typeof CommandType[keyof typeof CommandType];

export interface ToolCommand {
  command_type?: CommandType;
}

export const OsType = {
  UNSPECIFIED: 0,
  WINDOWS: 1,
  MACOS: 2,
  LINUX: 3,
} as const;

export type OsType = typeof OsType[keyof typeof OsType];

export interface ChromeModernWebGuidance {
  search_result?: SearchResult;
  retrieve_result?: RetrieveResult;
  tool_command?: ToolCommand;
  os?: OsType;
  version?: string;
  skill_version?: string;
  latency_ms?: number;
  success?: boolean;
}

// Clearcut API interfaces
export interface LogRequest {
  log_source: number;
  request_time_ms: string;
  client_info: {
    client_type?: number;
  };
  log_event: Array<{
    event_time_ms: string;
    source_extension_json: string;
  }>;
}

// IPC types for messages between the main process and the
// telemetry watchdog process.
// We use a const object and type alias instead of an enum to comply with 'erasableSyntaxOnly'.
export const WatchdogMessageType = {
  LOG_EVENT: 'log-event',
} as const;

export type WatchdogMessageType = typeof WatchdogMessageType[keyof typeof WatchdogMessageType];

export interface WatchdogMessage {
  type: typeof WatchdogMessageType.LOG_EVENT;
  payload: ChromeModernWebGuidance;
}
