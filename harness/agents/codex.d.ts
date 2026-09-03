/**
 * @fileoverview TypeScript definitions for OpenAI Codex CLI rollout sessions,
 * turn items, tool payloads, multi-agent orchestration, and telemetry logs.
 *
 * Source: OpenAI Codex Rust implementation (codex-rs).
 */

// ============================================================================
// 1. Session Rollout Envelopes (~/.codex/sessions/*.jsonl)
// ============================================================================

export type CodexRolloutLine<T = unknown> =
  | CodexSessionMetaLine
  | CodexResponseItemLine
  | CodexCompactedItemLine
  | CodexTurnDiffLine
  | CodexEventMsgLine
  | { type: string; payload: T };

export interface CodexSessionMetaLine {
  type: "session_meta";
  payload: CodexSessionMeta;
}

export interface CodexResponseItemLine {
  type: "response_item";
  payload: CodexResponseItem;
}

export interface CodexCompactedItemLine {
  type: "compacted_item";
  payload: CodexCompactedItem;
}

export interface CodexTurnDiffLine {
  type: "turn_diff";
  payload: { diff: string; [key: string]: unknown };
}

export interface CodexEventMsgLine {
  type: "event_msg";
  payload: CodexEventMsg;
}

export interface CodexSessionMeta {
  session_id: string;
  cwd: string;
  timestamp: string | number;
  model_context_window?: number;
  cli_version?: string;
  source?: CodexSessionSource | string;
  multi_agent_version?: "disabled" | "v1" | "v2" | string;
  parent_thread_id?: string;
  agent_path?: string;
  agent_role?: string;
  selected_capability_roots?: Array<string | { root: string; read_only?: boolean }>;
  [key: string]: unknown;
}

export type CodexSessionSource =
  | "cli"
  | "vscode"
  | "exec"
  | "mcp"
  | { subagent: { parent_thread_id: string; agent_path?: string; agent_role?: string } }
  | Record<string, unknown>;

// ============================================================================
// 2. Turn Response Items & Messages
// ============================================================================

export type CodexResponseItem =
  | CodexResponseMessageItem
  | CodexResponseReasoningItem
  | CodexResponseFunctionCallItem
  | CodexResponseFunctionCallOutputItem
  | CodexResponseCustomToolCallItem
  | CodexResponseCustomToolCallOutputItem
  | CodexResponseWebSearchCallItem
  | CodexResponseImageGenerationCallItem
  | { type: string; [key: string]: unknown };

export type CodexMessagePhase = "commentary" | "final_answer" | string;

export interface CodexResponseMessageItem {
  type: "message";
  id?: string;
  role: "user" | "assistant" | "system" | "developer";
  content: CodexMessageContentItem[];
  phase?: CodexMessagePhase;
  status?: string;
  [key: string]: unknown;
}

export type CodexMessageContentItem =
  | { type: "text"; text: string }
  | { type: "image"; image_url: string }
  | { type: "audio"; audio_url?: string; data?: string }
  | { type: string; [key: string]: unknown };

export interface CodexResponseReasoningItem {
  type: "reasoning";
  id?: string;
  summary?: string;
  content?: string;
  status?: string;
}

export interface CodexResponseFunctionCallItem {
  type: "function_call";
  id?: string;
  call_id?: string;
  name: string;
  arguments: string | Record<string, unknown>;
  input?: string | Record<string, unknown>;
  status?: string;
}

export interface CodexResponseFunctionCallOutputItem {
  type: "function_call_output";
  id?: string;
  call_id: string;
  output: string | Record<string, unknown> | Array<{ type: string; text?: string; [key: string]: unknown }>;
  is_error?: boolean;
}

export interface CodexResponseCustomToolCallItem {
  type: "custom_tool_call";
  id?: string;
  call_id?: string;
  name: string;
  input: string | Record<string, unknown>;
  status?: string;
}

export interface CodexResponseCustomToolCallOutputItem {
  type: "custom_tool_call_output";
  id?: string;
  call_id: string;
  output: string | Record<string, unknown> | Array<{ type: string; text?: string; [key: string]: unknown }>;
  is_error?: boolean;
}

export interface CodexResponseWebSearchCallItem {
  type: "web_search_call";
  id?: string;
  status?: string;
  action?: CodexWebSearchAction;
}

export interface CodexWebSearchAction {
  type: "search" | "open_page" | "find_in_page" | string;
  query?: string;
  queries?: string[];
  url?: string;
  pattern?: string;
  [key: string]: unknown;
}

export interface CodexResponseImageGenerationCallItem {
  type: "image_generation_call";
  id?: string;
  status: string;
  revised_prompt?: string;
  result: string;
}

// ============================================================================
// 3. Built-In Core Tool Signatures
// ============================================================================

/**
 * Shell command execution parameters (exec_command / local_shell_call)
 */
export interface CodexExecCommandParams {
  command?: string[];
  cmd?: string;
  cwd?: string;
  timeout_ms?: number;
  capture_output?: boolean;
  sandbox_permissions?: "none" | "read" | "full" | string;
  justification?: string;
  [key: string]: unknown;
}

/**
 * File patch application parameters (apply_patch / patch_apply)
 */
export interface CodexApplyPatchParams {
  patch?: string;
  unified_diff?: string;
  file_path?: string;
  target_file?: string;
  [key: string]: unknown;
}

/**
 * Multiple-choice or text input prompt from agent (request_user_input)
 */
export interface CodexRequestUserInputParams {
  questions: CodexRequestUserInputQuestion[];
  isBlocking?: boolean;
}

export interface CodexRequestUserInputQuestion {
  id: string;
  header: string;
  question: string;
  isOther?: boolean;
  isSecret?: boolean;
  options?: Array<{ label: string; description: string }>;
}

/**
 * Long-running process input streaming (write_stdin)
 */
export interface CodexWriteStdinParams {
  id: string;
  input: string;
}

/**
 * Step plan tracker (update_plan)
 */
export interface CodexUpdatePlanParams {
  steps: Array<{
    id: string;
    title: string;
    description?: string;
    status: "pending" | "in_progress" | "completed" | "failed" | "skipped" | string;
  }>;
}

// ============================================================================
// 4. Multi-Agent Orchestration (v1 & v2 Subagents)
// ============================================================================

/**
 * Multi-Agent v1: Spawn child worker
 */
export interface CodexMultiAgentV1SpawnParams {
  agent_type?: string;
  fork_context?: boolean;
  message: string;
  model?: string;
  reasoning_effort?: string;
  items?: CodexResponseItem[];
  [key: string]: unknown;
}

/**
 * Multi-Agent v1: Message child worker
 */
export interface CodexMultiAgentV1SendInputParams {
  target: string;
  message: string;
  items?: CodexResponseItem[];
  interrupt?: boolean;
}

/**
 * Multi-Agent v1: Wait for child worker completion
 */
export interface CodexMultiAgentV1WaitParams {
  targets?: string[];
  timeout_ms?: number;
}

/**
 * Multi-Agent v2: Spawn collaborative subagent
 */
export interface CodexMultiAgentV2SpawnParams {
  task_name: string;
  message: string;
  agent_type?: string;
  fork_turns?: "all" | "none" | string | number;
  model?: string;
  reasoning_effort?: string;
  service_tier?: string;
  [key: string]: unknown;
}

/**
 * Multi-Agent v2: Send message to active child subagent
 */
export interface CodexMultiAgentV2SendMessageParams {
  target: string;
  message: string;
}

/**
 * Multi-Agent v2: Queue follow-up task on child agent
 */
export interface CodexMultiAgentV2FollowupTaskParams {
  target: string;
  message: string;
}

/**
 * Multi-Agent v2: Interrupt / pause child agent
 */
export interface CodexMultiAgentV2InterruptParams {
  target: string;
}

// ============================================================================
// 5. Protocol Event Messages (type: "event_msg")
// ============================================================================

export type CodexEventMsg =
  | { type: "task_started" | "turn_started"; turn_id: string; trace_id?: string; started_at?: number; model_context_window?: number; collaboration_mode_kind?: string }
  | { type: "task_complete" | "turn_complete"; turn_id: string; last_agent_message?: string; error?: unknown; started_at?: number; completed_at?: number; duration_ms?: number }
  | { type: "agent_message"; message: string; phase?: CodexMessagePhase; memory_citation?: unknown }
  | { type: "user_message"; message: string; client_id?: string; images?: string[]; local_images?: string[]; text_elements?: unknown[]; audio?: unknown[]; local_audio?: unknown[] }
  | { type: "agent_reasoning"; text: string }
  | { type: "token_count"; info?: CodexTokenUsageInfo | null; rate_limits?: CodexRateLimitSnapshot | null }
  | { type: "exec_command_begin"; call_id: string; turn_id: string; command: string[]; cwd: string; parsed_cmd?: unknown[]; source?: string }
  | { type: "exec_command_output_delta"; call_id: string; chunk: string }
  | { type: "exec_command_end"; call_id: string; turn_id: string; command: string[]; stdout: string; stderr?: string; aggregated_output?: string; formatted_output?: string; exit_code?: number; status?: string; process_id?: string; duration?: { secs: number; nanos: number }; completed_at_ms?: number }
  | { type: "patch_apply_begin"; call_id: string; turn_id: string }
  | { type: "patch_apply_end"; call_id: string; turn_id: string; success: boolean; error?: string; stdout?: string; stderr?: string; changes?: Record<string, CodexPatchFileChange>; status?: string }
  | { type: "web_search_end"; call_id: string; query?: string; action?: CodexWebSearchAction; results?: unknown[] }
  | { type: "collab_agent_spawn_end"; call_id: string; sender_thread_id?: string; new_thread_id: string; new_agent_nickname?: string; new_agent_role?: string; prompt?: string; model?: string; reasoning_effort?: string; status?: string }
  | { type: "thread_settings_applied"; thread_id?: string; turn_id?: string; settings?: CodexThreadSettings; thread_settings?: CodexThreadSettings }
  | { type: "item_completed"; thread_id?: string; turn_id?: string; item?: { type: string; id: string; text?: string; [key: string]: unknown }; started_at_ms?: number; completed_at_ms?: number }
  | { type: "sub_agent_activity"; event_id?: string; occurred_at_ms?: number; agent_thread_id?: string; agent_path?: string; kind?: "started" | "interacted" | "interrupted" | "completed" | string }
  | { type: "mcp_tool_call_begin"; call_id: string; invocation: { server: string; tool: string; arguments?: unknown } }
  | { type: "mcp_tool_call_end"; call_id: string; result?: unknown; error?: unknown }
  | { type: "context_compacted" }
  | { type: "thread_rolled_back" }
  | { type: "turn_diff"; diff: string }
  | { type: "plan_update"; plan: unknown }
  | { type: "turn_aborted"; turn_id?: string; reason?: string; completed_at?: number; duration_ms?: number }
  | { type: "error"; message: string; codex_error_info?: CodexErrorInfo | string }
  | { type: string; [key: string]: unknown };

export interface CodexPatchFileChange {
  type: "update" | "add" | "delete" | string;
  unified_diff?: string;
  move_path?: string | null;
  [key: string]: unknown;
}

export type CodexErrorInfo =
  | "context_window_exceeded"
  | "session_budget_exceeded"
  | "usage_limit_exceeded"
  | "rate_limit_exceeded"
  | "server_overloaded"
  | "cyber_policy"
  | "misalignment_policy_violation"
  | "internal_safety_rejection"
  | "http_connection_failed"
  | "response_stream_connection_failed"
  | "response_stream_disconnected"
  | "response_too_many_failed_attempts"
  | string;

// ============================================================================
// 6. Token Usage & Rate Limits
// ============================================================================

export interface CodexTokenUsage {
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_input_tokens?: number;
  output_tokens: number;
  reasoning_output_tokens?: number;
  total_tokens: number;
}

export interface CodexTokenUsageInfo {
  total_token_usage: CodexTokenUsage;
  last_token_usage: CodexTokenUsage;
  model_context_window?: number | null;
}

export interface CodexRateLimitSnapshot {
  limit_id?: string | null;
  limit_name?: string | null;
  primary?: { used_percent: number; window_minutes?: number; resets_at?: number } | null;
  secondary?: { used_percent: number; window_minutes?: number; resets_at?: number } | null;
  credits?: unknown | null;
  plan_type?: string | null;
  rate_limit_reached_type?: string | null;
  [key: string]: unknown;
}

// ============================================================================
// 7. Turn Context, Sandbox Policies & Settings
// ============================================================================

export interface CodexTurnContextItem {
  turn_id?: string;
  cwd: string;
  workspace_roots?: string[];
  current_date?: string;
  timezone?: string;
  approval_policy: string;
  sandbox_policy: CodexSandboxPolicy | string;
  permission_profile?: CodexPermissionProfile;
  active_permission_profile?: { id: string };
  model: string;
  personality?: string;
  collaboration_mode?: CodexCollaborationMode;
  realtime_active?: boolean;
  summary?: string;
  effort?: string;
  user_instructions?: string;
  multi_agent_version?: string;
  [key: string]: unknown;
}

export interface CodexSandboxPolicy {
  type: "danger-full-access" | "read-only" | "external-sandbox" | "workspace-write" | "read_write" | "read_only" | "disabled" | string;
  writable_roots?: string[];
  network_access?: string | boolean;
  exclude_tmpdir_env_var?: boolean;
  exclude_slash_tmp?: boolean;
  [key: string]: unknown;
}

export interface CodexPermissionProfile {
  id?: string;
  type?: string;
  file_system?: unknown;
  network?: unknown;
  [key: string]: unknown;
}

export interface CodexCollaborationMode {
  mode: "default" | "plan" | string;
  settings?: {
    model?: string;
    reasoning_effort?: string;
    developer_instructions?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CodexThreadSettings {
  approval_policy?: string;
  sandbox_policy?: CodexSandboxPolicy | string;
  permission_profile?: CodexPermissionProfile;
  active_permission_profile?: { id: string };
  cwd?: string;
  reasoning_effort?: string;
  personality?: string;
  collaboration_mode?: CodexCollaborationMode;
  [key: string]: unknown;
}

export interface CodexCompactedItem {
  message: string;
  replacement_history?: CodexResponseItem[];
  window_id?: string | number;
  [key: string]: unknown;
}

// ============================================================================
// 8. Session History & Diagnostic Storage Formats
// ============================================================================

/**
 * Line item in ~/.codex/history.jsonl
 */
export interface CodexHistoryEntry {
  session_id: string;
  ts: number;
  text: string;
}

/**
 * Row record in ~/.codex/logs_2.sqlite (logs table)
 */
export interface CodexSqliteLogEntry {
  id: number;
  ts: number;
  ts_nanos: number;
  level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | string;
  target: string;
  feedback_log_body?: string | null;
  module_path?: string | null;
  file?: string | null;
  line?: number | null;
  thread_id?: string | null;
  process_uuid?: string | null;
  estimated_bytes: number;
}
