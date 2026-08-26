// TypeScript Type Definitions for OpenAI Codex CLI Session / Rollout Logs
// Grounded in the official OpenAI Codex codebase (openai/codex):
// - codex-rs/history/src/lib.rs & src/rollout_payload.rs (RolloutLine, RolloutItem, CompactedItem)
// - codex-rs/protocol/src/protocol.rs (SessionMeta, EventMsg, TurnContextItem, WorldStateItem)
// - codex-rs/protocol/src/models.rs (ResponseItem, ContentItem, FunctionCall, CustomToolCall)
// - codex-rs/protocol/src/items.rs (TurnItem, CommandExecutionItem, McpToolCallItem)
// - codex-rs/code-mode-protocol & codex-rs/core/src/tools (Code mode, exec_command, apply_patch)
// - sdk/typescript/src/ (SDK ThreadItem and ThreadEvent definitions)
// - Validated against ~/.codex/sessions rollout logs, history.jsonl, and logs_2.sqlite telemetry.

// ============================================================================
// 1. Top-Level Rollout JSONL Log Line
// ============================================================================

/**
 * Each line in ~/.codex/sessions/ is a serialized RolloutLine.
 */
export interface CodexRolloutLine {
  /** ISO 8601 timestamp string (e.g. "2026-05-14T17:45:15.100Z") */
  timestamp: string;
  /** Optional monotonic ordinal index within the rollout */
  ordinal?: number;
  /** Discriminated union of rollout items */
  type: CodexRolloutItemType;
  /** Item payload corresponding to the type */
  payload: CodexRolloutPayload;
  /** Optional harness metadata persisted with response items */
  metadata?: CodexHarnessMetadata;
}

export type CodexRolloutItemType =
  | "session_meta"
  | "response_item"
  | "event_msg"
  | "turn_context"
  | "world_state"
  | "compacted"
  | "inter_agent_communication"
  | "inter_agent_communication_metadata"
  | "security_risk_score"
  | "realtime_item";

export type CodexRolloutPayload =
  | CodexSessionMetaLine
  | CodexResponseItem
  | CodexEventMsg
  | CodexTurnContextItem
  | CodexWorldStateItem
  | CodexCompactedItem
  | CodexInterAgentCommunication
  | CodexInterAgentCommunicationMetadataPayload
  | CodexSecurityRiskScore
  | CodexRealtimeItem;

// ============================================================================
// 2. Session Metadata (type: "session_meta")
// ============================================================================

export interface CodexSessionMetaLine {
  session_id?: string;
  id: string; // ThreadId / UUID
  forked_from_id?: string | null;
  parent_thread_id?: string | null;
  timestamp: string;
  cwd: string;
  originator: string;
  cli_version: string;
  source: CodexSessionSource;
  thread_source?: string | null;
  agent_nickname?: string | null;
  agent_role?: string | null;
  agent_path?: string | null;
  model_provider?: string | null;
  base_instructions?: CodexBaseInstructions | null;
  dynamic_tools?: CodexDynamicToolSpec[] | null;
  selected_capability_roots?: string[];
  memory_mode?: string | null;
  history_mode?: "legacy" | "paginated" | string;
  multi_agent_version?: "v1" | "v2" | "disabled" | string | null;
  git?: CodexGitInfo | null;
  context_window?: CodexContextWindowMeta | null;
}

export type CodexSessionSource =
  | "cli"
  | "vscode"
  | "exec"
  | { custom: string }
  | { subagent: Record<string, unknown> }
  | string;

export interface CodexContextWindowMeta {
  window_id?: string;
  [key: string]: unknown;
}

export interface CodexGitInfo {
  commit_hash?: string | null;
  branch?: string | null;
  repository_url?: string | null;
}

export interface CodexBaseInstructions {
  text?: string;
  [key: string]: unknown;
}

export interface CodexDynamicToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  [key: string]: unknown;
}

// ============================================================================
// 3. Response Items (type: "response_item")
// ============================================================================

export type CodexResponseItem =
  | CodexResponseMessageItem
  | CodexResponseAgentMessageItem
  | CodexResponseReasoningItem
  | CodexResponseLocalShellCallItem
  | CodexResponseFunctionCallItem
  | CodexResponseFunctionCallOutputItem
  | CodexResponseCustomToolCallItem
  | CodexResponseCustomToolCallOutputItem
  | CodexResponseToolSearchCallItem
  | CodexResponseToolSearchOutputItem
  | CodexResponseWebSearchCallItem
  | CodexResponseImageGenerationCallItem
  | CodexResponseCompactionItem
  | CodexResponseContextCompactionItem;

export interface CodexHarnessMetadata {
  client_authored?: boolean;
}

export interface CodexInternalChatMessageMetadataPassthrough {
  turn_id?: string;
  create_time?: number;
  [key: string]: unknown;
}

export type CodexMessagePhase = "commentary" | "final_answer";

export interface CodexResponseMessageItem {
  type: "message";
  id?: string;
  role: "user" | "assistant" | "system" | "developer";
  content: CodexContentItem[];
  phase?: CodexMessagePhase;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseAgentMessageItem {
  type: "agent_message";
  id?: string;
  author: string;
  recipient: string;
  content: CodexAgentMessageInputContent[];
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseReasoningItem {
  type: "reasoning";
  id?: string;
  summary: CodexReasoningSummary[];
  content?: CodexReasoningContent[];
  encrypted_content?: string | null;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseLocalShellCallItem {
  type: "local_shell_call";
  id?: string;
  call_id?: string | null;
  status: "completed" | "in_progress" | "incomplete" | string;
  action: {
    type: "exec";
    command: string[];
    timeout_ms?: number;
    working_directory?: string;
    env?: Record<string, string>;
    user?: string;
  };
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

/**
 * Standard OpenAI Function Call item.
 * NOTE: arguments is serialized as a JSON string by the Responses API.
 */
export interface CodexResponseFunctionCallItem {
  type: "function_call";
  id?: string;
  call_id: string;
  name: string; // e.g. "exec_command", "write_stdin", "spawn_agent", "request_user_input", "wait", "wait_agent", "list_agents", "send_message", "interrupt_agent", "followup_task"
  namespace?: string;
  arguments: string; // JSON string payload (or parsed object in legacy/mock)
  encrypted_function_args?: string[];
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseFunctionCallOutputItem {
  type: "function_call_output";
  id?: string;
  call_id?: string;
  name?: string;
  namespace?: string;
  output: string | CodexFunctionCallOutputContentItem[];
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

/**
 * Custom / Freeform Tool Call item (e.g. exec code-mode or apply_patch).
 * input is raw text (JavaScript source or Lark patch syntax), NOT JSON.
 */
export interface CodexResponseCustomToolCallItem {
  type: "custom_tool_call";
  id?: string;
  call_id: string;
  name: string; // e.g. "exec" (code mode), "apply_patch"
  namespace?: string;
  status?: string;
  input: string;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseCustomToolCallOutputItem {
  type: "custom_tool_call_output";
  id?: string;
  call_id: string;
  name?: string;
  output: string | CodexFunctionCallOutputContentItem[];
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseToolSearchCallItem {
  type: "tool_search_call";
  id?: string;
  call_id?: string | null;
  status?: string;
  execution: string;
  arguments: unknown;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseToolSearchOutputItem {
  type: "tool_search_output";
  id?: string;
  call_id?: string | null;
  status: string;
  execution: string;
  tools: unknown[];
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseWebSearchCallItem {
  type: "web_search_call";
  id?: string;
  status?: string;
  action?: CodexWebSearchAction;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
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
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseCompactionItem {
  type: "compaction";
  id?: string;
  encrypted_content: string;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseContextCompactionItem {
  type: "context_compaction";
  id?: string;
  encrypted_content?: string;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

// Content Items
export type CodexContentItem =
  | { type: "input_text"; text: string }
  | { type: "output_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "auto" | "low" | "high" | "original" }
  | { type: "input_audio"; audio_url: string };

export type CodexAgentMessageInputContent =
  | { type: "input_text"; text: string }
  | { type: "encrypted_content"; encrypted_content: string };

export interface CodexReasoningSummary {
  type: "summary_text";
  text: string;
}

export type CodexReasoningContent =
  | { type: "reasoning_text"; text: string }
  | { type: "text"; text: string };

export type CodexFunctionCallOutputContentItem =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "auto" | "low" | "high" | "original" }
  | { type: "input_audio"; audio_url: string }
  | { type: "encrypted_content"; encrypted_content: string };

// ============================================================================
// 4. Built-in Tool Call Argument Schemas
// ============================================================================

/**
 * Arguments for the built-in exec_command function call.
 */
export interface CodexExecCommandArgs {
  /** The shell command to execute */
  cmd: string;
  /** Working directory for the command (defaults to turn cwd) */
  workdir?: string;
  /** Whether to allocate a PTY */
  tty?: boolean;
  /** Wait time before yielding output in ms (default: 10000) */
  yield_time_ms?: number;
  /** Output token budget */
  max_output_tokens?: number;
  /** Shell binary to launch */
  shell?: string;
  /** Whether to run as login shell (defaults to true) */
  login?: boolean;
  /** Target execution environment ID */
  environment_id?: string;
  /** Sandbox permissions profile requested */
  sandbox_permissions?: string;
  /** Justification for elevated tool permissions */
  justification?: string;
  /** Prefix rules applied to the command */
  prefix_rule?: unknown[];
}

/**
 * Arguments for write_stdin.
 */
export interface CodexWriteStdinArgs {
  session_id: number;
  chars?: string;
  yield_time_ms?: number;
  max_output_tokens?: number;
}

/**
 * Arguments for spawning subagents (spawn_agent).
 */
export interface CodexSpawnAgentArgs {
  agent_type: "explorer" | "sidecar" | string;
  fork_context?: boolean;
  message: string;
  task_name?: string;
  fork_turns?: string;
}

/**
 * Arguments for request_user_input.
 */
export interface CodexRequestUserInputArgs {
  questions: CodexUserInputQuestion[];
}

export interface CodexUserInputQuestion {
  id: string;
  header?: string;
  question: string;
  options: CodexUserInputOption[];
}

export interface CodexUserInputOption {
  label: string;
  description?: string;
}

/**
 * Arguments for waiting on background execution cell (wait).
 */
export interface CodexWaitArgs {
  cell_id?: string;
  yield_time_ms?: number;
  max_tokens?: number;
  terminate?: boolean;
}

/**
 * Arguments for waiting on subagent completion (wait_agent).
 */
export interface CodexWaitAgentArgs {
  timeout_ms?: number;
}

/**
 * Arguments for sending inter-agent messages (send_message / followup_task).
 */
export interface CodexSendMessageArgs {
  target: string;
  message: string;
}

/**
 * Arguments for interrupting running subagents (interrupt_agent).
 */
export interface CodexInterruptAgentArgs {
  target: string;
}

/**
 * Arguments for follow-up subagent tasks (followup_task).
 */
export interface CodexFollowupTaskArgs {
  target: string;
  message: string;
}

/**
 * Code-mode exec tool format:
 * JavaScript code executed in V8 isolate with access to global tools object.
 *
 * Example: await tools.exec_command({ cmd: "pnpm test" });
 */
export interface CodexCodeModePragma {
  yield_time_ms?: number;
  max_output_tokens?: number;
}

// ============================================================================
// 5. Protocol Event Messages (type: "event_msg")
// ============================================================================

export type CodexEventMsg =
  | { type: "agent_message"; message: string; phase?: CodexMessagePhase; memory_citation?: unknown }
  | { type: "user_message"; message: string; client_id?: string; images?: string[]; local_images?: string[]; text_elements?: unknown[]; audio?: unknown[]; local_audio?: unknown[] }
  | { type: "agent_reasoning"; text: string }
  | { type: "agent_reasoning_raw_content"; text: string }
  | { type: "agent_reasoning_section_break"; item_id: string; summary_index: number }
  | { type: "token_count"; info?: CodexTokenUsageInfo | null; rate_limits?: CodexRateLimitSnapshot | null }
  | { type: "task_started" | "turn_started"; turn_id: string; trace_id?: string; started_at?: number; model_context_window?: number; collaboration_mode_kind?: string }
  | { type: "task_complete" | "turn_complete"; turn_id: string; last_agent_message?: string; error?: unknown; started_at?: number; completed_at?: number; duration_ms?: number }
  | { type: "exec_command_begin"; call_id: string; turn_id: string; command: string[]; cwd: string; parsed_cmd: unknown[]; source?: string }
  | { type: "exec_command_output_delta"; call_id: string; chunk: string }
  | { type: "exec_command_end"; call_id: string; turn_id: string; command: string[]; stdout: string; stderr?: string; aggregated_output?: string; formatted_output?: string; exit_code?: number; status?: string; process_id?: string; duration?: { secs: number; nanos: number }; parsed_cmd?: unknown[]; cwd?: string; source?: string; completed_at_ms?: number }
  | { type: "patch_apply_begin"; call_id: string; turn_id: string }
  | { type: "patch_apply_end"; call_id: string; turn_id: string; success: boolean; error?: string; stdout?: string; stderr?: string; changes?: Record<string, CodexPatchFileChange>; status?: string }
  | { type: "web_search_end"; call_id: string; query?: string; action?: CodexWebSearchAction; results?: unknown[] }
  | { type: "collab_agent_spawn_end"; call_id: string; sender_thread_id?: string; new_thread_id: string; new_agent_nickname?: string; new_agent_role?: string; prompt?: string; model?: string; reasoning_effort?: string; status?: string }
  | { type: "thread_settings_applied"; thread_id?: string; turn_id?: string; settings?: CodexThreadSettings; thread_settings?: CodexThreadSettings }
  | { type: "item_completed"; thread_id?: string; turn_id?: string; item?: { type: string; id: string; text?: string; [key: string]: unknown }; started_at_ms?: number; completed_at_ms?: number }
  | { type: "sub_agent_activity"; event_id?: string; occurred_at_ms?: number; agent_thread_id?: string; agent_path?: string; kind?: "started" | "interacted" | "interrupted" | "completed" | string }
  | { type: "error"; message: string; codex_error_info?: string }
  | { type: "mcp_tool_call_begin"; call_id: string; invocation: { server: string; tool: string; arguments?: unknown } }
  | { type: "mcp_tool_call_end"; call_id: string; result?: unknown; error?: unknown }
  | { type: "context_compacted" }
  | { type: "thread_rolled_back" }
  | { type: "turn_diff"; diff: string }
  | { type: "plan_update"; plan: unknown }
  | { type: "turn_aborted"; turn_id?: string; reason?: string; completed_at?: number; duration_ms?: number }
  | { type: string; [key: string]: unknown };

export interface CodexPatchFileChange {
  type: "update" | "add" | "delete" | string;
  unified_diff?: string;
  move_path?: string | null;
  [key: string]: unknown;
}

export interface CodexTokenUsage {
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
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
// 6. Turn Context & World State
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
  file_system_sandbox_policy?: { kind?: string; entries?: unknown[]; [key: string]: unknown };
  model: string;
  personality?: string;
  collaboration_mode?: CodexCollaborationMode;
  realtime_active?: boolean;
  summary?: string;
  truncation_policy?: { mode?: string; limit?: number; [key: string]: unknown };
  effort?: string;
  user_instructions?: string;
  approvals_reviewer?: string;
  comp_hash?: string;
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
  settings?: CodexCollaborationModeSettings;
  [key: string]: unknown;
}

export interface CodexCollaborationModeSettings {
  model?: string;
  reasoning_effort?: string;
  developer_instructions?: string;
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

export interface CodexWorldStateItem {
  full: boolean;
  state: Record<string, unknown>;
}

export interface CodexCompactedItem {
  message: string;
  replacement_history?: Array<{ item: CodexResponseItem; metadata?: CodexHarnessMetadata }>;
  window_number?: number;
  first_window_id?: string;
  previous_window_id?: string;
  window_id?: string;
}

export interface CodexInterAgentCommunication {
  id?: string;
  author: string;
  recipient: string;
  other_recipients?: string[];
  content: string;
  trigger_turn: boolean;
}

export interface CodexInterAgentCommunicationMetadataPayload {
  trigger_turn: boolean;
}

export interface CodexSecurityRiskScore {
  scores: Record<string, number>;
  call_id?: string;
  action?: unknown;
  sampled_at?: string;
}

export interface CodexRealtimeItem {
  id: string;
  realtime_session_id: string;
  type: string;
  [key: string]: unknown;
}

// ============================================================================
// 7. Session History & SQLite Diagnostic Telemetry
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
 * Record row in ~/.codex/logs_2.sqlite (logs table)
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
