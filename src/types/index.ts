export interface ReviewConfig {
  aiProvider: 'openai' | 'anthropic';
  model?: string;
  maxTokens?: number;
  temperature?: number;
  codingStandardsPath?: string;
  reviewPromptPath?: string;
  ignorePatterns?: string[];
  severityThreshold?: 'low' | 'medium' | 'high';
  autoApprove?: boolean;
  requireApprovalFor?: string[];
}

export interface CodeChange {
  file: string;
  additions: string[];
  deletions: string[];
  context: string[];
  hunks: GitHunk[];
}

export interface GitHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface ReviewComment {
  file: string;
  line: number;
  message: string;
  severity: 'info' | 'warning' | 'error';
  suggestion?: string;
  category: ReviewCategory;
}

export type ReviewCategory = 
  | 'code-quality'
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'style'
  | 'testing'
  | 'documentation';

export interface ReviewResult {
  comments: ReviewComment[];
  summary: string;
  approved: boolean;
  score: number;
  categories: Record<ReviewCategory, number>;
}

export interface AIProvider {
  name: string;
  review(code: string, prompt: string, config: ReviewConfig): Promise<ReviewComment[]>;
}

export interface GitHubPRInfo {
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  baseSha: string;
}