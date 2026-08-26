// TypeScript Type Definitions for OpenAI Codex CLI Session / Rollout Logs,
// Protocol Events, Response Items, Built-in Tools, and Storage Schemas.
// Grounded in the official OpenAI Codex codebase (openai/codex):
// - codex-rs/history/src/lib.rs & src/rollout_payload.rs (RolloutItem, RolloutItemWire, CompactedItemWire)
// - codex-rs/protocol/src/protocol.rs (SessionMeta, EventMsg, TurnContextItem, WorldStateItem, Approvals)
// - codex-rs/protocol/src/models.rs (ResponseItem, ContentItem, FunctionCall, CustomToolCall, WebSearchAction)
// - codex-rs/protocol/src/items.rs (TurnItem, CommandExecutionItem, McpToolCallItem, CollabAgentToolCallItem)
// - codex-rs/protocol/src/error.rs (CodexErrorInfo, CodexErrKind, ErrorEvent, SandboxErr)
// - codex-rs/protocol/src/config_types.rs (ApprovalsReviewer, Personality, MultiAgentMode)
// - codex-rs/core/src/tools/handlers/ (shell_spec, apply_patch_spec, multi_agents_spec, request_user_input_spec)
// - codex-rs/exec/src/exec_events.rs (ThreadEvent, ThreadItem, Usage, CollabToolCallItem)
// - codex-rs/message-history/src/lib.rs (HistoryEntry in ~/.codex/history.jsonl)
// - codex-rs/state/logs_migrations/ (logs table schema in ~/.codex/logs_2.sqlite)

// ============================================================================
// 1. Top-Level Rollout JSONL Log Line (~/.codex/sessions/*.jsonl)
// ============================================================================

/**
 * Each line in ~/.codex/sessions/ is a serialized RolloutLine.
 */
export interface CodexRolloutLine<T extends CodexRolloutItemType = CodexRolloutItemType> {
  /** ISO 8601 timestamp string (e.g. "2026-04-14T19:23:41.123Z") */
  timestamp: string;
  /** Optional monotonic ordinal index within the rollout */
  ordinal?: number;
  /** Discriminated union of rollout items */
  type: T;
  /** Item payload corresponding to the type */
  payload: CodexRolloutPayloadMap[T];
  /** Optional harness metadata persisted with response items */
  metadata?: CodexHarnessMetadata;
}

export type CodexRolloutItemType =
  | 'session_meta'
  | 'response_item'
  | 'event_msg'
  | 'turn_context'
  | 'world_state'
  | 'compacted'
  | 'inter_agent_communication'
  | 'inter_agent_communication_metadata'
  | 'security_risk_score'
  | 'realtime_item';

export interface CodexRolloutPayloadMap {
  session_meta: CodexSessionMetaLine;
  response_item: CodexResponseItem;
  event_msg: CodexEventMsg;
  turn_context: CodexTurnContextItem;
  world_state: CodexWorldStateItem;
  compacted: CodexCompactedItem;
  inter_agent_communication: CodexInterAgentCommunication;
  inter_agent_communication_metadata: CodexInterAgentCommunicationMetadataPayload;
  security_risk_score: CodexSecurityRiskScore;
  realtime_item: CodexRealtimeItem;
}

export type CodexRolloutPayload = CodexRolloutPayloadMap[CodexRolloutItemType];

// ============================================================================
// 2. Session Metadata (type: "session_meta")
// ============================================================================

export interface CodexSessionMetaLine {
  session_id?: string;
  id: string; // ThreadId / UUIDv7
  forked_from_id?: string | null;
  parent_thread_id?: string | null;
  timestamp: string;
  cwd: string;
  originator: string;
  cli_version: string;
  source: CodexSessionSource;
  thread_source?: CodexThreadSource | string | null;
  agent_nickname?: string | null;
  agent_role?: string | null;
  agent_path?: string | null;
  model_provider?: string | null;
  base_instructions?: CodexBaseInstructions | null;
  dynamic_tools?: CodexDynamicToolSpec[] | null;
  selected_capability_roots?: CodexSelectedCapabilityRoot[];
  memory_mode?: string | null;
  history_mode?: 'legacy' | 'paginated';
  history_base?: CodexHistoryPosition | null;
  subagent_history_start_ordinal?: number | null;
  multi_agent_version?: CodexMultiAgentVersion | null;
  context_window?: CodexSessionContextWindow | null;
  git?: CodexGitInfo | null;
}

export type CodexSessionSource =
  | 'cli'
  | 'vscode'
  | 'exec'
  | 'mcp'
  | 'unknown'
  | { custom: string }
  | { internal: 'memory_consolidation' | 'guardian' }
  | {
      sub_agent:
        | 'review'
        | 'compact'
        | 'memory_consolidation'
        | {
            thread_spawn: {
              parent_thread_id: string;
              depth: number;
              agent_path?: string | null;
              agent_nickname?: string | null;
              agent_role?: string | null;
            };
          }
        | { other: string };
    }
  | string;

export type CodexThreadSource =
  | 'user'
  | 'subagent'
  | 'guardian_review'
  | 'memory_consolidation'
  | string;

export type CodexMultiAgentVersion = 'disabled' | 'v1' | 'v2';

export interface CodexHistoryPosition {
  thread_id: string;
  end_ordinal_exclusive: number;
  end_byte_offset: number;
}

export interface CodexSessionContextWindow {
  window_id: string;
}

export interface CodexSelectedCapabilityRoot {
  root: string;
  read_only?: boolean;
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
  | CodexResponseAdditionalToolsItem
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
  | CodexResponseContextCompactionItem
  | CodexResponseCompactionTriggerItem
  | CodexResponseOtherItem;

export interface CodexHarnessMetadata {
  /** Whether a developer message was supplied by an app-server client */
  client_authored?: boolean;
}

export interface CodexInternalChatMessageMetadataPassthrough {
  turn_id?: string;
  create_time?: number;
  content_item_kinds?: string[];
  executed_tool_calls?: unknown[];
  [key: string]: unknown;
}

export type CodexMessagePhase = 'commentary' | 'final_answer';

export interface CodexResponseAdditionalToolsItem {
  type: 'additional_tools';
  id?: string;
  role: string;
  tools: unknown[];
}

export interface CodexResponseMessageItem {
  type: 'message';
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'developer' | string;
  content: CodexContentItem[];
  phase?: CodexMessagePhase;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseAgentMessageItem {
  type: 'agent_message';
  id?: string;
  author: string;
  recipient: string;
  content: CodexAgentMessageInputContent[];
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseReasoningItem {
  type: 'reasoning';
  id?: string;
  summary: CodexReasoningSummary[];
  content?: CodexReasoningContent[];
  encrypted_content?: string | null;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseLocalShellCallItem {
  type: 'local_shell_call';
  id?: string;
  call_id?: string | null;
  status: 'completed' | 'in_progress' | 'incomplete';
  action: {
    type: 'exec';
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
  type: 'function_call';
  id?: string;
  call_id: string;
  name: string; // e.g. "exec_command", "write_stdin", "view_image"
  namespace?: string;
  arguments: string; // JSON string payload
  encrypted_function_args?: string[];
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseFunctionCallOutputItem {
  type: 'function_call_output';
  id?: string;
  call_id?: string;
  name?: string;
  namespace?: string;
  output: string | CodexFunctionCallOutputContentItem[];
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

/**
 * Custom / Freeform Tool Call item (e.g. `exec` code-mode or `apply_patch`).
 * input is raw text (JavaScript source or Lark patch syntax), NOT JSON.
 */
export interface CodexResponseCustomToolCallItem {
  type: 'custom_tool_call';
  id?: string;
  call_id: string;
  name: string; // e.g. "exec" (code mode), "apply_patch"
  namespace?: string;
  status?: string;
  input: string;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseCustomToolCallOutputItem {
  type: 'custom_tool_call_output';
  id?: string;
  call_id: string;
  name?: string;
  output: string | CodexFunctionCallOutputContentItem[];
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseToolSearchCallItem {
  type: 'tool_search_call';
  id?: string;
  call_id?: string | null;
  status?: string;
  execution: string;
  arguments: unknown;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseToolSearchOutputItem {
  type: 'tool_search_output';
  id?: string;
  call_id?: string | null;
  status: string;
  execution: string;
  tools: unknown[];
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseWebSearchCallItem {
  type: 'web_search_call';
  id?: string;
  status?: string;
  action?: CodexWebSearchAction;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export type CodexWebSearchAction =
  | { type: 'search'; query?: string; queries?: string[] }
  | { type: 'open_page'; url?: string }
  | { type: 'find_in_page'; url?: string; pattern?: string }
  | { type: 'other'; [key: string]: unknown };

export interface CodexResponseImageGenerationCallItem {
  type: 'image_generation_call';
  id?: string;
  status: string;
  revised_prompt?: string;
  result: string;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseCompactionItem {
  type: 'compaction';
  id?: string;
  encrypted_content: string;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseContextCompactionItem {
  type: 'context_compaction';
  id?: string;
  encrypted_content?: string;
  internal_chat_message_metadata_passthrough?: CodexInternalChatMessageMetadataPassthrough;
}

export interface CodexResponseCompactionTriggerItem {
  type: 'compaction_trigger';
}

export interface CodexResponseOtherItem {
  type: 'other';
  [key: string]: unknown;
}

// Content Items
export type CodexImageDetail = 'auto' | 'low' | 'high' | 'original';

export type CodexContentItem =
  | { type: 'input_text'; text: string }
  | { type: 'output_text'; text: string }
  | { type: 'input_image'; image_url: string; detail?: CodexImageDetail }
  | { type: 'input_audio'; audio_url: string };

export type CodexAgentMessageInputContent =
  | { type: 'input_text'; text: string }
  | { type: 'encrypted_content'; encrypted_content: string };

export interface CodexReasoningSummary {
  type: 'summary_text';
  text: string;
}

export type CodexReasoningContent =
  | { type: 'reasoning_text'; text: string }
  | { type: 'text'; text: string };

export type CodexFunctionCallOutputContentItem =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail?: CodexImageDetail }
  | { type: 'input_audio'; audio_url: string }
  | { type: 'encrypted_content'; encrypted_content: string };

// ============================================================================
// 4. Built-in Tool Call Argument Schemas
// ============================================================================

/**
 * Arguments for the built-in `exec_command` function call.
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
  /** Sandbox permission override */
  sandbox_permissions?: 'use_default' | 'with_additional_permissions' | 'require_escalated';
  /** User-facing justification for require_escalated */
  justification?: string;
  /** Reusable prefix rule approval command */
  prefix_rule?: string[];
  /** Additional permissions requested for sandboxed execution */
  additional_permissions?: CodexPermissionProfile;
}

/**
 * Arguments for `write_stdin`.
 */
export interface CodexWriteStdinArgs {
  session_id: number;
  chars?: string;
  yield_time_ms?: number;
  max_output_tokens?: number;
}

/**
 * Output schema for unified exec sessions.
 */
export interface CodexUnifiedExecOutput {
  chunk_id?: string;
  wall_time_seconds: number;
  exit_code?: number;
  session_id?: number;
  original_token_count?: number;
  output: string;
}

/**
 * Arguments for `view_image`.
 */
export interface CodexViewImageArgs {
  path: string;
  detail?: 'high' | 'original';
  environment_id?: string;
}

/**
 * Arguments for `update_plan`.
 */
export interface CodexUpdatePlanArgs {
  explanation?: string;
  plan: CodexPlanStep[];
}

export interface CodexPlanStep {
  step: string;
  status: 'pending' | 'in_progress' | 'completed';
}

/**
 * Arguments for `request_user_input`.
 */
export interface CodexRequestUserInputArgs {
  questions: CodexRequestUserInputQuestion[];
}

export interface CodexRequestUserInputQuestion {
  id: string;
  header: string;
  question: string;
  isOther?: boolean;
  isSecret?: boolean;
  options?: CodexRequestUserInputQuestionOption[];
}

export interface CodexRequestUserInputQuestionOption {
  label: string;
  description: string;
}

/**
 * Arguments for `request_permissions`.
 */
export interface CodexRequestPermissionsArgs {
  reason?: string;
  environment_id?: string;
  permissions: CodexPermissionProfile;
}

export interface CodexPermissionProfile {
  network?: {
    enabled?: boolean;
  };
  file_system?: {
    read?: string[];
    write?: string[];
  };
}

/**
 * Multi-Agent v1/v2 Tool Arguments
 */
export interface CodexSpawnAgentArgsV1 {
  message?: string;
  items?: CodexContentItem[];
  agent_type?: string;
  fork_context?: boolean;
  model?: string;
  reasoning_effort?: string;
  service_tier?: string;
}

export interface CodexSpawnAgentArgsV2 {
  task_name: string;
  message: string;
  agent_type?: string;
  fork_turns?: 'none' | 'all' | string | number;
  model?: string;
  reasoning_effort?: string;
  service_tier?: string;
}

export interface CodexSendInputArgs {
  target: string;
  message?: string;
  items?: CodexContentItem[];
  interrupt?: boolean;
}

export interface CodexSendMessageArgs {
  target: string;
  message: string;
}

export interface CodexFollowupTaskArgs {
  target: string;
  message: string;
}

export interface CodexResumeAgentArgs {
  id: string;
}

export interface CodexWaitAgentArgs {
  timeout_ms?: number;
  targets?: string[];
}

export interface CodexCloseAgentArgs {
  target: string;
}

export interface CodexInterruptAgentArgs {
  target: string;
}

export interface CodexListAgentsArgs {
  path_prefix?: string;
}

/**
 * Code-mode `exec` tool format:
 * JavaScript code executed in V8 isolate with access to global `tools` object.
 *
 * Example: `await tools.exec_command({ cmd: "pnpm test" });`
 */
export interface CodexCodeModePragma {
  yield_time_ms?: number;
  max_output_tokens?: number;
}

// ============================================================================
// 5. Protocol Event Messages (type: "event_msg")
// ============================================================================

export type CodexEventMsg =
  | CodexErrorEventMsg
  | CodexWarningEventMsg
  | CodexGuardianWarningEventMsg
  | CodexRealtimeConversationStartedEventMsg
  | CodexRealtimeConversationRealtimeEventMsg
  | CodexRealtimeConversationClosedEventMsg
  | CodexRealtimeConversationSdpEventMsg
  | CodexModelRerouteEventMsg
  | CodexModelVerificationEventMsg
  | CodexTurnModerationMetadataEventMsg
  | CodexSafetyBufferingEventMsg
  | CodexContextCompactedEventMsg
  | CodexThreadRolledBackEventMsg
  | CodexTurnStartedEventMsg
  | CodexThreadSettingsAppliedEventMsg
  | CodexTurnCompleteEventMsg
  | CodexTokenCountEventMsg
  | CodexAgentMessageEventMsg
  | CodexUserMessageEventMsg
  | CodexAgentReasoningEventMsg
  | CodexAgentReasoningRawContentEventMsg
  | CodexAgentReasoningSectionBreakEventMsg
  | CodexSessionConfiguredEventMsg
  | CodexEnvironmentConnectedEventMsg
  | CodexEnvironmentDisconnectedEventMsg
  | CodexThreadGoalUpdatedEventMsg
  | CodexThreadQueueChangedEventMsg
  | CodexMcpStartupUpdateEventMsg
  | CodexMcpStartupCompleteEventMsg
  | CodexMcpToolCallBeginEventMsg
  | CodexMcpToolCallEndEventMsg
  | CodexWebSearchBeginEventMsg
  | CodexWebSearchEndEventMsg
  | CodexImageGenerationBeginEventMsg
  | CodexImageGenerationEndEventMsg
  | CodexExecCommandBeginEventMsg
  | CodexExecCommandOutputDeltaEventMsg
  | CodexTerminalInteractionEventMsg
  | CodexExecCommandEndEventMsg
  | CodexViewImageToolCallEventMsg
  | CodexExecApprovalRequestEventMsg
  | CodexRequestPermissionsEventMsg
  | CodexRequestUserInputEventMsg
  | CodexDynamicToolCallRequestEventMsg
  | CodexDynamicToolCallResponseEventMsg
  | CodexElicitationRequestEventMsg
  | CodexApplyPatchApprovalRequestEventMsg
  | CodexGuardianAssessmentEventMsg
  | CodexDeprecationNoticeEventMsg
  | CodexStreamErrorEventMsg
  | CodexPatchApplyBeginEventMsg
  | CodexPatchApplyUpdatedEventMsg
  | CodexPatchApplyEndEventMsg
  | CodexTurnDiffEventMsg
  | CodexRealtimeConversationListVoicesResponseEventMsg
  | CodexPlanUpdateEventMsg
  | CodexTurnAbortedEventMsg
  | CodexShutdownCompleteEventMsg
  | CodexEnteredReviewModeEventMsg
  | CodexExitedReviewModeEventMsg
  | CodexRawResponseItemEventMsg
  | CodexRawResponseCompletedEventMsg
  | CodexItemStartedEventMsg
  | CodexItemCompletedEventMsg
  | CodexHookStartedEventMsg
  | CodexHookCompletedEventMsg
  | CodexAgentMessageContentDeltaEventMsg
  | CodexPlanDeltaEventMsg
  | CodexReasoningContentDeltaEventMsg
  | CodexReasoningRawContentDeltaEventMsg
  | CodexCollabAgentSpawnBeginEventMsg
  | CodexCollabAgentSpawnEndEventMsg
  | CodexCollabAgentInteractionBeginEventMsg
  | CodexCollabAgentInteractionEndEventMsg
  | CodexCollabWaitingBeginEventMsg
  | CodexCollabWaitingEndEventMsg
  | CodexCollabCloseBeginEventMsg
  | CodexCollabCloseEndEventMsg
  | CodexCollabResumeBeginEventMsg
  | CodexCollabResumeEndEventMsg
  | CodexSubAgentActivityEventMsg
  | { type: string; [key: string]: unknown };

// Event Payload Definitions
export interface CodexErrorEventMsg {
  type: 'error';
  message: string;
  codex_error_info?: CodexErrorInfo;
  misalignment?: CodexMisalignmentErrorDetails;
}

export interface CodexWarningEventMsg {
  type: 'warning';
  message: string;
}

export interface CodexGuardianWarningEventMsg {
  type: 'guardian_warning';
  message: string;
}

export interface CodexRealtimeConversationStartedEventMsg {
  type: 'realtime_conversation_started';
  realtime_session_id?: string;
  version: 'v1' | 'v2' | 'v3';
}

export interface CodexRealtimeConversationRealtimeEventMsg {
  type: 'realtime_conversation_realtime';
  payload: unknown;
}

export interface CodexRealtimeConversationClosedEventMsg {
  type: 'realtime_conversation_closed';
  reason?: string;
}

export interface CodexRealtimeConversationSdpEventMsg {
  type: 'realtime_conversation_sdp';
  sdp: string;
}

export interface CodexModelRerouteEventMsg {
  type: 'model_reroute';
  from_model: string;
  to_model: string;
  reason: 'high_risk_cyber_activity';
}

export interface CodexModelVerificationEventMsg {
  type: 'model_verification';
  verifications: Array<'trusted_access_for_cyber'>;
}

export interface CodexTurnModerationMetadataEventMsg {
  type: 'turn_moderation_metadata';
  metadata: unknown;
}

export interface CodexSafetyBufferingEventMsg {
  type: 'safety_buffering';
  model: string;
  use_cases: string[];
  reasons: string[];
  show_buffering_ui: boolean;
  faster_model?: string;
}

export interface CodexContextCompactedEventMsg {
  type: 'context_compacted';
}

export interface CodexThreadRolledBackEventMsg {
  type: 'thread_rolled_back';
  num_turns: number;
}

export interface CodexTurnStartedEventMsg {
  type: 'task_started' | 'turn_started';
  turn_id: string;
  trace_id?: string;
  started_at?: number | null;
  model_context_window?: number | null;
  collaboration_mode_kind?: string;
}

export interface CodexThreadSettingsAppliedEventMsg {
  type: 'thread_settings_applied';
  thread_settings: CodexThreadSettingsSnapshot;
}

export interface CodexThreadSettingsSnapshot {
  model: string;
  model_provider_id: string;
  service_tier?: string;
  approval_policy: CodexAskForApproval;
  approvals_reviewer: CodexApprovalsReviewer;
  permission_profile: CodexPermissionProfile;
  active_permission_profile?: CodexActivePermissionProfile;
  cwd: string;
  reasoning_effort?: string;
  reasoning_summary?: string;
  personality?: CodexPersonality;
  collaboration_mode?: CodexCollaborationMode;
}

export interface CodexTurnCompleteEventMsg {
  type: 'task_complete' | 'turn_complete';
  turn_id: string;
  last_agent_message?: string;
  error?: CodexErrorEvent;
  started_at?: number | null;
  completed_at?: number | null;
  duration_ms?: number | null;
  time_to_first_token_ms?: number | null;
}

export interface CodexTokenCountEventMsg {
  type: 'token_count';
  info?: CodexTokenUsageInfo;
  rate_limits?: CodexRateLimitSnapshot;
}

export interface CodexAgentMessageEventMsg {
  type: 'agent_message';
  message: string;
  phase?: CodexMessagePhase;
  memory_citation?: unknown;
  delivery?: 'async';
}

export interface CodexUserMessageEventMsg {
  type: 'user_message';
  client_id?: string;
  message: string;
  images?: string[];
  image_details?: Array<CodexImageDetail | null>;
  local_images?: string[];
  local_image_details?: Array<CodexImageDetail | null>;
  audio?: string[];
  local_audio?: string[];
  text_elements?: CodexTextElement[];
}

export interface CodexTextElement {
  byte_range?: { start: number; end: number };
  [key: string]: unknown;
}

export interface CodexAgentReasoningEventMsg {
  type: 'agent_reasoning';
  text: string;
}

export interface CodexAgentReasoningRawContentEventMsg {
  type: 'agent_reasoning_raw_content';
  text: string;
}

export interface CodexAgentReasoningSectionBreakEventMsg {
  type: 'agent_reasoning_section_break';
  item_id: string;
  summary_index: number;
}

export interface CodexSessionConfiguredEventMsg {
  type: 'session_configured';
  session_id: string;
  [key: string]: unknown;
}

export interface CodexEnvironmentConnectedEventMsg {
  type: 'environment_connected';
  environment_id: string;
  [key: string]: unknown;
}

export interface CodexEnvironmentDisconnectedEventMsg {
  type: 'environment_disconnected';
  environment_id: string;
  [key: string]: unknown;
}

export interface CodexThreadGoalUpdatedEventMsg {
  type: 'thread_goal_updated';
  goal?: unknown;
  [key: string]: unknown;
}

export interface CodexThreadQueueChangedEventMsg {
  type: 'thread_queue_changed';
  [key: string]: unknown;
}

export interface CodexMcpStartupUpdateEventMsg {
  type: 'mcp_startup_update';
  server: string;
  status: CodexMcpStartupStatus;
}

export type CodexMcpStartupStatus =
  | { state: 'starting' }
  | { state: 'ready' }
  | { state: 'failed'; error: string; reason?: 'reauthentication_required' | null }
  | { state: 'cancelled' };

export interface CodexMcpStartupCompleteEventMsg {
  type: 'mcp_startup_complete';
  ready: string[];
  failed: Array<{ server: string; error: string }>;
  cancelled: string[];
}

export interface CodexMcpInvocation {
  server: string;
  tool: string;
  arguments?: unknown;
}

export interface CodexMcpToolCallBeginEventMsg {
  type: 'mcp_tool_call_begin';
  call_id: string;
  invocation: CodexMcpInvocation;
  connector_id?: string;
  mcp_app_resource_uri?: string;
  link_id?: string;
  app_name?: string;
  action_name?: string;
  plugin_id?: string;
  read_only_hint?: boolean;
}

export interface CodexMcpCallToolResult {
  content: unknown[];
  structured_content?: unknown;
  is_error?: boolean;
  _meta?: unknown;
}

export interface CodexMcpToolCallEndEventMsg {
  type: 'mcp_tool_call_end';
  call_id: string;
  invocation: CodexMcpInvocation;
  connector_id?: string;
  mcp_app_resource_uri?: string;
  link_id?: string;
  app_name?: string;
  action_name?: string;
  plugin_id?: string;
  read_only_hint?: boolean;
  duration?: string;
  result?: { Ok: CodexMcpCallToolResult } | { Err: string } | CodexMcpCallToolResult | unknown;
  error?: { message: string } | unknown;
}

export interface CodexWebSearchBeginEventMsg {
  type: 'web_search_begin';
  call_id: string;
}

export interface CodexWebSearchEndEventMsg {
  type: 'web_search_end';
  call_id: string;
  query: string;
  action: CodexWebSearchAction;
  results?: unknown[];
}

export interface CodexImageGenerationBeginEventMsg {
  type: 'image_generation_begin';
  call_id: string;
}

export interface CodexImageGenerationEndEventMsg {
  type: 'image_generation_end';
  call_id: string;
  status: string;
  revised_prompt?: string;
  result: string;
  transparent_background?: boolean;
  failure?: unknown;
  saved_path?: string;
}

export interface CodexExecCommandBeginEventMsg {
  type: 'exec_command_begin';
  call_id: string;
  turn_id: string;
  started_at_ms?: number;
  command: string[];
  cwd: string;
  parsed_cmd: CodexParsedCommand[];
  source?: CodexExecCommandSource;
  interaction_input?: string;
  plugin_id?: string;
  script_path?: string;
  process_id?: string;
}

export interface CodexExecCommandOutputDeltaEventMsg {
  type: 'exec_command_output_delta';
  call_id: string;
  stream?: 'stdout' | 'stderr';
  chunk: string;
}

export interface CodexTerminalInteractionEventMsg {
  type: 'terminal_interaction';
  call_id: string;
  process_id: string;
  stdin: string;
}

export interface CodexExecCommandEndEventMsg {
  type: 'exec_command_end';
  call_id: string;
  turn_id: string;
  completed_at_ms: number;
  command: string[];
  cwd: string;
  parsed_cmd: CodexParsedCommand[];
  source?: CodexExecCommandSource;
  interaction_input?: string;
  plugin_id?: string;
  script_path?: string;
  process_id?: string;
  stdout: string;
  stderr: string;
  aggregated_output?: string;
  exit_code?: number;
  duration?: string;
  formatted_output?: string;
  status?: 'completed' | 'failed' | 'declined';
}

export interface CodexViewImageToolCallEventMsg {
  type: 'view_image_tool_call';
  call_id: string;
  path: string;
}

export interface CodexExecApprovalRequestEventMsg {
  type: 'exec_approval_request';
  call_id: string;
  turn_id: string;
  command: string[];
  cwd: string;
  [key: string]: unknown;
}

export interface CodexRequestPermissionsEventMsg {
  type: 'request_permissions';
  call_id: string;
  turn_id: string;
  reason?: string;
  permissions: CodexPermissionProfile;
}

export interface CodexRequestUserInputEventMsg {
  type: 'request_user_input';
  call_id: string;
  turn_id: string;
  questions: CodexRequestUserInputQuestion[];
  isBlocking?: boolean;
  autoResolutionMs?: number;
}

export interface CodexDynamicToolCallRequestEventMsg {
  type: 'dynamic_tool_call_request';
  call_id: string;
  turn_id: string;
  tool: string;
  arguments: unknown;
  namespace?: string;
}

export interface CodexDynamicToolCallResponseEventMsg {
  type: 'dynamic_tool_call_response';
  call_id: string;
  turn_id: string;
  completed_at_ms: number;
  tool: string;
  arguments: unknown;
  namespace?: string;
  content_items: unknown[];
  success: boolean;
  error?: string;
  duration: string;
}

export interface CodexElicitationRequestEventMsg {
  type: 'elicitation_request';
  [key: string]: unknown;
}

export interface CodexApplyPatchApprovalRequestEventMsg {
  type: 'apply_patch_approval_request';
  call_id: string;
  turn_id: string;
  changes: Record<string, CodexFileChange>;
  [key: string]: unknown;
}

export interface CodexGuardianAssessmentEventMsg {
  type: 'guardian_assessment';
  status: string;
  action: unknown;
  [key: string]: unknown;
}

export interface CodexDeprecationNoticeEventMsg {
  type: 'deprecation_notice';
  summary: string;
  details?: string;
}

export interface CodexStreamErrorEventMsg {
  type: 'stream_error';
  message: string;
  codex_error_info?: CodexErrorInfo;
  additional_details?: string;
}

export interface CodexPatchApplyBeginEventMsg {
  type: 'patch_apply_begin';
  call_id: string;
  turn_id: string;
  auto_approved: boolean;
  changes: Record<string, CodexFileChange>;
}

export interface CodexPatchApplyUpdatedEventMsg {
  type: 'patch_apply_updated';
  call_id: string;
  changes: Record<string, CodexFileChange>;
}

export interface CodexPatchApplyEndEventMsg {
  type: 'patch_apply_end';
  call_id: string;
  turn_id: string;
  stdout: string;
  stderr: string;
  success: boolean;
  changes?: Record<string, CodexFileChange>;
  status?: 'completed' | 'failed' | 'declined';
}

export interface CodexTurnDiffEventMsg {
  type: 'turn_diff';
  unified_diff: string;
  /** Backwards-compatibility alias for diff string */
  diff?: string;
}

export interface CodexRealtimeConversationListVoicesResponseEventMsg {
  type: 'realtime_conversation_list_voices_response';
  voices: unknown[];
}

export interface CodexPlanUpdateEventMsg {
  type: 'plan_update';
  plan: CodexPlanStep[];
  explanation?: string;
}

export interface CodexTurnAbortedEventMsg {
  type: 'turn_aborted';
  reason?: string;
}

export interface CodexShutdownCompleteEventMsg {
  type: 'shutdown_complete';
}

export interface CodexEnteredReviewModeEventMsg {
  type: 'entered_review_mode';
  target: CodexReviewTarget;
  user_facing_hint?: string;
  turn_id?: string;
  item_id?: string;
}

export interface CodexExitedReviewModeEventMsg {
  type: 'exited_review_mode';
  turn_id?: string;
  item_id?: string;
  review_output?: CodexReviewOutputEvent;
}

export interface CodexRawResponseItemEventMsg {
  type: 'raw_response_item';
  item: CodexResponseItem;
}

export interface CodexRawResponseCompletedEventMsg {
  type: 'raw_response_completed';
  response_id: string;
  token_usage?: CodexTokenUsage;
}

export interface CodexItemStartedEventMsg {
  type: 'item_started';
  thread_id: string;
  turn_id: string;
  item: CodexTurnItem;
  started_at_ms: number;
}

export interface CodexItemCompletedEventMsg {
  type: 'item_completed';
  thread_id: string;
  turn_id: string;
  item: CodexTurnItem;
  started_at_ms?: number;
  completed_at_ms: number;
}

export interface CodexHookStartedEventMsg {
  type: 'hook_started';
  turn_id?: string;
  run: unknown;
}

export interface CodexHookCompletedEventMsg {
  type: 'hook_completed';
  turn_id?: string;
  run: unknown;
}

export interface CodexAgentMessageContentDeltaEventMsg {
  type: 'agent_message_content_delta';
  thread_id: string;
  turn_id: string;
  item_id: string;
  delta: string;
}

export interface CodexPlanDeltaEventMsg {
  type: 'plan_delta';
  thread_id: string;
  turn_id: string;
  item_id: string;
  delta: string;
}

export interface CodexReasoningContentDeltaEventMsg {
  type: 'reasoning_content_delta';
  thread_id: string;
  turn_id: string;
  item_id: string;
  delta: string;
  summary_index?: number;
}

export interface CodexReasoningRawContentDeltaEventMsg {
  type: 'reasoning_raw_content_delta';
  thread_id: string;
  turn_id: string;
  item_id: string;
  delta: string;
  content_index?: number;
}

export interface CodexCollabAgentSpawnBeginEventMsg {
  type: 'collab_agent_spawn_begin';
  call_id: string;
  started_at_ms?: number;
  sender_thread_id: string;
  prompt: string;
  model: string;
  reasoning_effort: string;
}

export interface CodexCollabAgentSpawnEndEventMsg {
  type: 'collab_agent_spawn_end';
  call_id: string;
  completed_at_ms?: number;
  sender_thread_id: string;
  new_thread_id?: string;
  new_agent_nickname?: string;
  new_agent_role?: string;
  prompt: string;
  model: string;
  reasoning_effort: string;
  status: CodexAgentStatus;
}

export interface CodexCollabAgentInteractionBeginEventMsg {
  type: 'collab_agent_interaction_begin';
  call_id: string;
  started_at_ms?: number;
  sender_thread_id: string;
  receiver_thread_id: string;
  prompt: string;
}

export interface CodexCollabAgentInteractionEndEventMsg {
  type: 'collab_agent_interaction_end';
  call_id: string;
  completed_at_ms?: number;
  sender_thread_id: string;
  receiver_thread_id: string;
  receiver_agent_nickname?: string;
  receiver_agent_role?: string;
  prompt: string;
  status: CodexAgentStatus;
}

export interface CodexCollabWaitingBeginEventMsg {
  type: 'collab_waiting_begin';
  started_at_ms?: number;
  sender_thread_id: string;
  receiver_thread_ids: string[];
  receiver_agents?: CodexCollabAgentRef[];
  call_id: string;
}

export interface CodexCollabWaitingEndEventMsg {
  type: 'collab_waiting_end';
  sender_thread_id: string;
  call_id: string;
  completed_at_ms?: number;
  agent_statuses?: CodexCollabAgentStatusEntry[];
  statuses: Record<string, CodexAgentStatus>;
}

export interface CodexCollabCloseBeginEventMsg {
  type: 'collab_close_begin';
  call_id: string;
  started_at_ms?: number;
  sender_thread_id: string;
  receiver_thread_id: string;
}

export interface CodexCollabCloseEndEventMsg {
  type: 'collab_close_end';
  call_id: string;
  completed_at_ms?: number;
  sender_thread_id: string;
  receiver_thread_id: string;
  receiver_agent_nickname?: string;
  receiver_agent_role?: string;
  status: CodexAgentStatus;
}

export interface CodexCollabResumeBeginEventMsg {
  type: 'collab_resume_begin';
  call_id: string;
  started_at_ms?: number;
  sender_thread_id: string;
  receiver_thread_id: string;
  receiver_agent_nickname?: string;
  receiver_agent_role?: string;
}

export interface CodexCollabResumeEndEventMsg {
  type: 'collab_resume_end';
  call_id: string;
  completed_at_ms?: number;
  sender_thread_id: string;
  receiver_thread_id: string;
  receiver_agent_nickname?: string;
  receiver_agent_role?: string;
  status: CodexAgentStatus;
}

export interface CodexSubAgentActivityEventMsg {
  type: 'sub_agent_activity';
  event_id: string;
  occurred_at_ms?: number;
  agent_thread_id: string;
  agent_path: string;
  kind: 'started' | 'interacted' | 'interrupted' | 'completed';
}

// ============================================================================
// 6. Turn Items (protocol/items.rs)
// ============================================================================

export type CodexTurnItem =
  | { type: 'user_message'; id: string; client_id?: string; content: unknown[] }
  | { type: 'hook_prompt'; id: string; fragments: Array<{ text: string; hookRunId: string }> }
  | { type: 'agent_message'; id: string; content: Array<{ type: 'text'; text: string }>; phase?: CodexMessagePhase; memory_citation?: unknown; delivery?: 'async' }
  | { type: 'plan'; id: string; text: string }
  | { type: 'reasoning'; id: string; summary_text: string[]; raw_content?: string[] }
  | {
      type: 'command_execution';
      id: string;
      plugin_id?: string;
      script_path?: string;
      process_id?: string;
      command: string[];
      cwd: string;
      parsed_cmd: CodexParsedCommand[];
      source: CodexExecCommandSource;
      interaction_input?: string;
      status: 'in_progress' | 'completed' | 'failed' | 'declined';
      stdout?: string;
      stderr?: string;
      aggregated_output?: string;
      exit_code?: number;
      duration?: string;
      formatted_output?: string;
    }
  | {
      type: 'dynamic_tool_call';
      id: string;
      namespace?: string;
      tool: string;
      arguments: unknown;
      status: 'in_progress' | 'completed' | 'failed';
      content_items?: unknown[];
      success?: boolean;
      error?: string;
      duration?: string;
    }
  | {
      type: 'collab_agent_tool_call';
      id: string;
      tool: 'spawn_agent' | 'send_input' | 'resume_agent' | 'wait' | 'close_agent' | 'send_message' | 'followup_task' | 'interrupt_agent' | 'list_agents';
      status: 'in_progress' | 'completed' | 'failed' | 'interrupted';
      sender_thread_id: string;
      receiver_thread_ids?: string[];
      receiver_agents?: CodexCollabAgentRef[];
      prompt?: string;
      model?: string;
      reasoning_effort?: string;
      agents_states?: Record<string, CodexAgentStatus>;
    }
  | {
      type: 'sub_agent_activity';
      id: string;
      kind: 'started' | 'interacted' | 'interrupted' | 'completed';
      agent_thread_id: string;
      agent_path: string;
    }
  | { type: 'web_search'; id: string; query: string; action: CodexWebSearchAction; results?: unknown[] }
  | { type: 'image_view'; id: string; path: string }
  | { type: 'image_generation'; id: string; status: string; revised_prompt?: string; result: string; saved_path?: string }
  | { type: 'entered_review_mode'; id: string; target: CodexReviewTarget; user_facing_hint: string }
  | { type: 'exited_review_mode'; id: string; review_output?: CodexReviewOutputEvent }
  | { type: 'file_change'; id: string; changes: Record<string, CodexFileChange>; status?: 'completed' | 'failed' | 'declined'; auto_approved?: boolean; stdout?: string; stderr?: string }
  | {
      type: 'mcp_tool_call';
      id: string;
      server: string;
      tool: string;
      arguments: unknown;
      connectorId?: string;
      mcpAppResourceUri?: string;
      linkId?: string;
      appName?: string;
      actionName?: string;
      pluginId?: string;
      readOnlyHint?: boolean;
      status: 'inProgress' | 'completed' | 'failed';
      result?: CodexMcpCallToolResult;
      error?: { message: string };
      duration?: string;
    }
  | { type: 'context_compaction'; id: string }
  | { type: 'extension'; [key: string]: unknown };

// Supporting Structures for Events & Items
export type CodexExecCommandSource =
  | 'agent'
  | 'user'
  | 'extension'
  | { custom: string }
  | string;

export interface CodexParsedCommand {
  program: string;
  arguments: string[];
}

export type CodexAgentStatus =
  | 'pending_init'
  | 'running'
  | 'interrupted'
  | 'shutdown'
  | 'not_found'
  | { completed: string | null }
  | { errored: string };

export interface CodexCollabAgentRef {
  thread_id: string;
  agent_nickname?: string | null;
  agent_role?: string | null;
}

export interface CodexCollabAgentStatusEntry {
  thread_id: string;
  agent_nickname?: string | null;
  agent_role?: string | null;
  status: CodexAgentStatus;
}

export type CodexReviewTarget =
  | 'uncommitted_changes'
  | 'base_branch'
  | { commit: string }
  | { custom: string };

export interface CodexReviewOutputEvent {
  review_summary?: string;
  [key: string]: unknown;
}

export interface CodexFileChange {
  path?: string;
  kind?: 'add' | 'delete' | 'update';
  unified_diff?: string;
  [key: string]: unknown;
}

// Token Usage & Rate Limits
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
  limit_id?: string;
  limit_name?: string;
  primary?: CodexRateLimitWindow;
  secondary?: CodexRateLimitWindow;
  credits?: CodexCreditsSnapshot;
  individual_limit?: CodexSpendControlLimitSnapshot;
  spend_control_reached?: boolean;
  plan_type?: string;
  rate_limit_reached_type?: CodexRateLimitReachedType;
  [key: string]: unknown;
}

export interface CodexRateLimitWindow {
  used_percent: number;
  window_minutes?: number | null;
  resets_at?: number | null;
}

export interface CodexCreditsSnapshot {
  has_credits: boolean;
  unlimited: boolean;
  balance?: string | null;
}

export interface CodexSpendControlLimitSnapshot {
  limit: string;
  used: string;
  remaining_percent: number;
  resets_at: number;
}

export type CodexRateLimitReachedType =
  | 'rate_limit_reached'
  | 'workspace_owner_credits_depleted'
  | 'workspace_member_credits_depleted'
  | 'workspace_owner_usage_limit_reached'
  | 'workspace_member_usage_limit_reached';

// Error Information
export type CodexErrorInfo =
  | 'context_window_exceeded'
  | 'session_budget_exceeded'
  | 'usage_limit_exceeded'
  | 'rate_limit_exceeded'
  | 'server_overloaded'
  | 'cyber_policy'
  | 'misalignment_policy_violation'
  | 'internal_server_error'
  | 'unauthorized'
  | 'bad_request'
  | 'sandbox_error'
  | 'thread_rollback_failed'
  | 'other'
  | { http_connection_failed: { http_status_code?: number } }
  | { response_stream_connection_failed: { http_status_code?: number } }
  | { response_stream_disconnected: { http_status_code?: number } }
  | { response_too_many_failed_attempts: { http_status_code?: number } }
  | { active_turn_not_steerable: { turn_kind: 'review' | 'compact' } };

export interface CodexErrorEvent {
  message: string;
  codex_error_info?: CodexErrorInfo;
}

export interface CodexMisalignmentErrorDetails {
  error_type?: string;
  detailed_explanation?: string;
  steer?: { message: string };
}

// ============================================================================
// 7. Turn Context & World State
// ============================================================================

export interface CodexTurnContextItem {
  turn_id?: string;
  cwd: string;
  workspace_roots?: string[];
  current_date?: string;
  timezone?: string;
  approval_policy: CodexAskForApproval;
  approvals_reviewer?: CodexApprovalsReviewer;
  sandbox_policy: CodexSandboxPolicy;
  permission_profile?: CodexPermissionProfile;
  active_permission_profile?: CodexActivePermissionProfile;
  network?: CodexTurnContextNetworkItem;
  file_system_sandbox_policy?: CodexRawFileSystemSandboxPolicy;
  model: string;
  comp_hash?: string;
  personality?: CodexPersonality;
  collaboration_mode?: CodexCollaborationMode;
  multi_agent_version?: CodexMultiAgentVersion;
  multi_agent_mode?: CodexMultiAgentMode;
  realtime_active?: boolean;
  cyber_access_program?: string;
  effort?: string;
  summary?: string;
  [key: string]: unknown;
}

export type CodexAskForApproval =
  | 'untrusted'
  | 'on-request'
  | 'never'
  | { granular: CodexGranularApprovalConfig }
  | string;

export interface CodexGranularApprovalConfig {
  sandbox_approval: boolean;
  rules: boolean;
  skill_approval?: boolean;
  request_permissions?: boolean;
  mcp_elicitations: boolean;
}

export type CodexApprovalsReviewer = 'user' | 'auto_review' | 'guardian_subagent';

export type CodexPersonality = 'none' | 'friendly' | 'pragmatic';

export type CodexMultiAgentMode =
  | 'explicitRequestOnly'
  | 'proactive'
  | { custom: string }
  | string;

export type CodexCollaborationMode =
  | 'default'
  | 'plan'
  | 'pair'
  | 'review'
  | { custom: string }
  | string;

export type CodexSandboxPolicy =
  | 'danger-full-access'
  | { 'read-only': { network_access?: boolean } }
  | { 'external-sandbox': { network_access?: 'restricted' | 'enabled' } }
  | {
      'workspace-write': {
        writable_roots?: string[];
        network_access?: boolean;
        exclude_tmpdir_env_var?: boolean;
        exclude_slash_tmp?: boolean;
      };
    }
  | string;

export interface CodexActivePermissionProfile {
  name: string;
  [key: string]: unknown;
}

export interface CodexTurnContextNetworkItem {
  allowed_hosts?: string[];
  [key: string]: unknown;
}

export interface CodexRawFileSystemSandboxPolicy {
  read_roots?: string[];
  write_roots?: string[];
}

export interface CodexWorldStateItem {
  full: boolean;
  state: Record<string, unknown>;
}

export interface CodexCompactedItem {
  message: string;
  replacement_history?: CodexResponseItem[];
  replacement_history_metadata?: CodexHarnessMetadata[];
  mcp_resource_origins?: CodexMcpResourceOriginCheckpoint;
  window_number?: number;
  first_window_id?: string;
  previous_window_id?: string;
  window_id?: string | number;
}

export interface CodexMcpResourceOriginCheckpoint {
  origins: CodexMcpResourceOrigin[];
  turns: string[];
  current_turn_id?: string;
}

export interface CodexMcpResourceOrigin {
  call_id: string;
  turn_id?: string;
  tool: string;
  connector_id: string;
  link_id?: string;
  uri: string;
  ambiguous_account?: boolean;
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
// 8. Global History & Database Schemas (~/.codex/history.jsonl & sqlite)
// ============================================================================

/**
 * Line schema for ~/.codex/history.jsonl
 */
export interface CodexHistoryEntry {
  /** Thread / Session UUID */
  session_id: string;
  /** Unix timestamp in seconds */
  ts: number;
  /** User message text */
  text: string;
}

/**
 * Row schema for `logs` table in ~/.codex/logs_2.sqlite
 */
export interface CodexSqliteLogEntry {
  id: number;
  ts: number;
  ts_nanos: number;
  level: string; // e.g. "INFO", "WARN", "ERROR", "DEBUG"
  target: string;
  feedback_log_body?: string | null;
  module_path?: string | null;
  file?: string | null;
  line?: number | null;
  thread_id?: string | null;
  process_uuid?: string | null;
  estimated_bytes: number;
}

/**
 * Top-level JSONL events emitted by `codex exec --json`
 * Grounded in codex-rs/exec/src/exec_events.rs and sdk/typescript/src/events.ts
 */
export type CodexExecThreadEvent =
  | { type: 'thread.started'; thread_id: string }
  | { type: 'turn.started' }
  | { type: 'turn.completed'; usage: CodexTokenUsage }
  | { type: 'turn.failed'; error: { message: string } }
  | { type: 'item.started'; item: CodexExecThreadItem }
  | { type: 'item.updated'; item: CodexExecThreadItem }
  | { type: 'item.completed'; item: CodexExecThreadItem }
  | { type: 'error'; message: string };

export type CodexExecThreadItem =
  | { id: string; type: 'agent_message'; text: string }
  | { id: string; type: 'reasoning'; text: string }
  | {
      id: string;
      type: 'command_execution';
      command: string;
      aggregated_output: string;
      exit_code?: number;
      status: 'in_progress' | 'completed' | 'failed' | 'declined';
    }
  | {
      id: string;
      type: 'file_change';
      changes: Array<{ path: string; kind: 'add' | 'delete' | 'update' }>;
      status: 'completed' | 'failed' | 'in_progress';
    }
  | {
      id: string;
      type: 'mcp_tool_call';
      server: string;
      tool: string;
      arguments: unknown;
      result?: { content: unknown[]; _meta?: unknown; structured_content?: unknown };
      error?: { message: string };
      status: 'in_progress' | 'completed' | 'failed';
    }
  | {
      id: string;
      type: 'collab_tool_call';
      tool: 'spawn_agent' | 'send_input' | 'wait' | 'close_agent';
      sender_thread_id: string;
      receiver_thread_ids: string[];
      prompt?: string;
      agents_states: Record<string, { status: string; message?: string | null }>;
      status: 'in_progress' | 'completed' | 'failed';
    }
  | { id: string; type: 'web_search'; query: string; action?: CodexWebSearchAction }
  | { id: string; type: 'todo_list'; items: Array<{ text: string; completed: boolean }> }
  | { id: string; type: 'error'; message: string };

