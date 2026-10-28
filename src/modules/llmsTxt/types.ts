export type ValidationStatus = 'pass' | 'warning' | 'fail' | 'skipped';
export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationFinding {
  id: string;
  name: string;
  status: ValidationStatus;
  severity: ValidationSeverity;
  message: string;
  line?: number;
  explanation?: string;
  suggestedCorrection?: string;
}

export interface ValidationSummary {
  valid: boolean;
  errors: number;
  warnings: number;
  passed: number;
  skipped: number;
  score: number;
}

export interface ExtractedLink {
  title: string;
  url: string;
  description?: string;
  section?: string;
  line: number;
  isAbsolute: boolean;
  isDuplicate: boolean;
}

export interface LlmsTxtValidationResult {
  summary: ValidationSummary;
  checks: ValidationFinding[];
  links: ExtractedLink[];
  correctedMarkdown?: string;
  markdown: string;
}

export interface LinkCheckItem {
  url: string;
  title: string;
  section?: string;
  line: number;
  status: 'ok' | 'broken' | 'redirect' | 'inconclusive';
  httpStatus?: number;
  finalUrl?: string;
  message?: string;
  isDuplicate?: boolean;
}

export interface LinkCheckSummary {
  total: number;
  ok: number;
  broken: number;
  redirected: number;
  duplicate: number;
  inconclusive: number;
}

export interface LinkCheckReport {
  summary: LinkCheckSummary;
  links: LinkCheckItem[];
}

export interface UrlCheckResult {
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string;
  isMarkdown: boolean;
  validation: LlmsTxtValidationResult;
  linkChecks: LinkCheckReport;
}

export interface GeneratorResult {
  draft: string;
  validation: LlmsTxtValidationResult;
  warnings: string[];
  discoveredPagesCount: number;
}
