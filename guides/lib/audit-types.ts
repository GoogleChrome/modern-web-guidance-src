import type { GraderCoverageResult } from '../../lib/grader-coverage.ts';

export type AuditGrade = 'HIGH' | 'MEDIUM' | 'LOW';

export type GuideFormatLabel =
  | 'legacy - top level guide'
  | `new - low level guide (${string})`
  | 'new - low level guide';

export type ExpectationIssueCategory =
  | 'MISSING_CORE_REQUIREMENT'
  | 'MISSING_A11Y_OR_FALLBACK'
  | 'NON_TESTABLE_PROSE'
  | 'OVER_PRESCRIBED_EXPECTATION'
  | 'TASK_PROMPT_DISCONNECT';

export interface ExpectationIssue {
  id: string;
  category: ExpectationIssueCategory;
  grade: AuditGrade;
  citation: string;
  quoteOrRule: string;
  counterexampleProof: string;
  remedy: string;
}

export type GraderIssueCategory =
  | 'FALSE_NEGATIVE_UNPROMPTED_LOCATOR'
  | 'FALSE_NEGATIVE_STATIC_FILE_REGEX'
  | 'FALSE_NEGATIVE_NARROW_IMPLEMENTATION'
  | 'FALSE_POSITIVE_SUPERFICIAL_CHECK'
  | 'FALSE_POSITIVE_WEAK_ASSERTION'
  | 'UNCOVERED_EXPECTATION';

export interface GraderIssue {
  id: string;
  category: GraderIssueCategory;
  grade: AuditGrade;
  citation: string;
  offendingCode: string;
  counterexampleProof: string;
  remedy: string;
}

export interface CapsuleAuditAssessment {
  overallPriority: AuditGrade;
  expectationCoverageScore: number; // 0 - 100
  graderFidelityScore: number;      // 0 - 100
  expectationIssues: ExpectationIssue[];
  graderIssues: GraderIssue[];
  executiveSummary: string;
}

export type CritiqueFlawType =
  | 'HALLUCINATED_DEFECT'
  | 'MISSED_DEFECT'
  | 'WEAK_COUNTEREXAMPLE_PROOF'
  | 'WRONG_GRADE_OR_CITATION'
  | 'WORDING_TOO_VERBOSE';

export interface AdversarialCritique {
  targetIdOrTopic: string;
  flawType: CritiqueFlawType;
  critique: string;
  requiredCorrection: string;
}

export interface AdversarialReviewResult {
  agreed: boolean;
  summary: string;
  critiques: AdversarialCritique[];
}

export interface AdversarialTurnRecord {
  turnNumber: number;
  assessment: CapsuleAuditAssessment;
  review?: AdversarialReviewResult;
}

export interface UnpromptedLocatorSignal {
  selector: string;
  lineNumber: number;
  lineSnippet: string;
  inTaskMd: boolean;
  inDemoHtml: boolean;
}

export interface StaticFileRegexSignal {
  lineNumber: number;
  lineSnippet: string;
  patternTested?: string;
}

export interface ProseExpectationSignal {
  bulletIndex: number;
  lineNumber: number;
  text: string;
  matchedKeyword: string;
}

export interface StaticAuditSignals {
  embeddingCoverage: GraderCoverageResult;
  fsReadFileSyncLines: number[];
  staticRegexChecks: StaticFileRegexSignal[];
  unpromptedLocators: UnpromptedLocatorSignal[];
  proseExpectationSignals: ProseExpectationSignal[];
}

export interface DiscoveredCapsule {
  capsuleId: string;        // e.g. "css/animate-to-intrinsic-sizes" or "built-in-ai/translator__daily-grind"
  guideId: string;          // e.g. "css/animate-to-intrinsic-sizes"
  category: string;         // e.g. "css"
  guideName: string;        // e.g. "animate-to-intrinsic-sizes"
  guideFormat: GuideFormatLabel;
  targetApp?: string;       // undefined for legacy top-level, or baseApp name for new low-level guides
  guideDirAbs: string;
  guideFilePath: string;
  expectationsFilePath: string;
  graderFilePath: string;
  taskFilePath: string;
  demoFilePath?: string;
}

export interface CapsuleAuditResult {
  capsuleId: string;
  guideId: string;
  category: string;
  guideName: string;
  guideFormat: GuideFormatLabel;
  targetApp?: string;
  timestamp: string;
  durationMs: number;
  turnsTaken: number;
  consensusReached: boolean;
  staticSignals: StaticAuditSignals;
  finalAssessment: CapsuleAuditAssessment;
  adversarialHistory: AdversarialTurnRecord[];
}
