// Types for Claude Code session entries, based on observed logs.

export type ClaudeLogEntry = Entry;

export type Entry =
  | TranscriptMessage
  | SummaryMessage
  | CustomTitleMessage
  | AiTitleMessage
  | LastPromptMessage
  | TaskSummaryMessage
  | TagMessage
  | AgentNameMessage
  | AgentColorMessage
  | AgentSettingMessage
  | PRLinkMessage
  | FileHistorySnapshotMessage
  | AttributionSnapshotMessage
  | ModeEntry
  | PermissionModeEntry
  | WorktreeStateEntry
  | ContentReplacementEntry
  | ContextCollapseCommitEntry
  | ContextCollapseSnapshotEntry
  | QueueOperationEntry
  | ProgressEntry
  | SystemEntry;

export interface SerializedMessage {
  cwd: string;
  userType: string;
  entrypoint?: string;
  sessionId: string;
  timestamp: string;
  version: string;
  gitBranch?: string;
  slug?: string;
}

export type TranscriptMessage = SerializedMessage & {
  type?: 'user' | 'assistant' | 'error' | string;
  uuid: string;
  parentUuid: string | null;
  logicalParentUuid?: string | null;
  isSidechain: boolean;
  permissionMode?: string;
  requestId?: string;
  agentId?: string;
  isMeta?: boolean;
  subtype?: string;
  sourceToolAssistantUUID?: string;
  sourceToolUseID?: string;
  error?: string;
  isApiErrorMessage?: boolean;
  teamName?: string;
  agentName?: string;
  agentColor?: string;
  promptId?: string;
  message?: ClaudeMessage;
  toolUseResult?: ToolUseResult;
  snapshot?: ClaudeSnapshot;
  attachment?: any;
  attributionSkill?: string;
  attributionPlugin?: string;
  attributionAgent?: string;
};

export interface ClaudeMessage {
  role: 'user' | 'assistant' | string;
  content: string | ContentBlock[];
  type?: string;
  model?: string;
  id?: string;
  usage?: UsageMetrics;
  stop_reason?: string | null;
  stop_sequence?: string | null;
  stop_details?: any;
  container?: any;
  context_management?: any;
}

export type ContentBlock = ThinkingBlock | TextBlock | ToolUseBlock | ToolResultBlock;

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: string; text?: string; tool_name?: string }>;
  is_error?: boolean;
}

export type ToolUseResult = {
  success?: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  content?: string | Array<{ type: string; text: string }>;
  [key: string]: any;
} | string | Array<{ type: string; text: string }>;

export interface SummaryMessage {
  type: 'summary';
  leafUuid: string;
  summary: string;
}

export interface CustomTitleMessage {
  type: 'custom-title';
  sessionId: string;
  customTitle: string;
}

export interface AiTitleMessage {
  type: 'ai-title';
  sessionId: string;
  aiTitle: string;
}

export interface LastPromptMessage {
  type: 'last-prompt';
  sessionId: string;
  lastPrompt?: string;
  leafUuid?: string;
}

export interface TaskSummaryMessage {
  type: 'task-summary';
  sessionId: string;
  summary: string;
  timestamp: string;
}

export interface TagMessage {
  type: 'tag';
  sessionId: string;
  tag: string;
}

export interface AgentNameMessage {
  type: 'agent-name';
  sessionId: string;
  agentName: string;
}

export interface AgentColorMessage {
  type: 'agent-color';
  sessionId: string;
  agentColor: string;
}

export interface AgentSettingMessage {
  type: 'agent-setting';
  sessionId: string;
  agentSetting: string;
}

export interface PRLinkMessage {
  type: 'pr-link';
  sessionId: string;
  prNumber: number;
  prUrl: string;
  prRepository: string;
  timestamp: string;
}

export interface FileHistorySnapshotMessage {
  type: 'file-history-snapshot';
  messageId: string;
  snapshot: any;
  isSnapshotUpdate: boolean;
}

export interface AttributionSnapshotMessage {
  type: 'attribution-snapshot';
  messageId: string;
  surface: string;
  fileStates: Record<string, any>;
  promptCount?: number;
  permissionPromptCount?: number;
  escapeCount?: number;
}

export interface ModeEntry {
  type: 'mode';
  sessionId: string;
  mode: 'coordinator' | 'normal';
}

export interface PermissionModeEntry {
  type: 'permission-mode';
  permissionMode: string;
  sessionId: string;
}

export interface WorktreeStateEntry {
  type: 'worktree-state';
  sessionId: string;
  worktreeSession: any;
}

export interface ContentReplacementEntry {
  type: 'content-replacement';
  sessionId: string;
  agentId?: string;
  replacements: any[];
}

export interface ContextCollapseCommitEntry {
  type: 'marble-origami-commit';
  sessionId: string;
  collapseId: string;
  summaryUuid: string;
  summaryContent: string;
  summary: string;
  firstArchivedUuid: string;
  lastArchivedUuid: string;
}

export interface ContextCollapseSnapshotEntry {
  type: 'marble-origami-snapshot';
  sessionId: string;
  staged: any[];
  armed: boolean;
  lastSpawnTokens: number;
}

export interface UsageMetrics {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  } | null;
  server_tool_use?: any;
  service_tier?: string | null;
  inference_geo?: string | null;
  iterations?: any[] | null;
  speed?: string | null;
}

export interface ClaudeSnapshot {
  messageId: string;
  trackedFileBackups: Record<string, FileBackup>;
  timestamp: string;
}

export interface FileBackup {
  backupFileName?: string | null;
  version: number;
  backupTime: string;
}

export interface QueueOperationEntry {
  type: 'queue-operation';
  operation: 'enqueue' | 'dequeue';
  timestamp: string;
  sessionId: string;
  content?: string;
}

export type ProgressEntry = SerializedMessage & {
  type: 'progress';
  data: any;
  parentToolUseID?: string;
  toolUseID?: string;
  uuid: string;
  parentUuid?: string | null;
  isSidechain?: boolean;
  agentId?: string;
};

export type SystemEntry = SerializedMessage & {
  type: 'system';
  subtype?: string;
  content: string;
  level?: string;
  uuid: string;
  parentUuid?: string | null;
  isSidechain?: boolean;
  durationMs?: number;
  messageCount?: number;
};
