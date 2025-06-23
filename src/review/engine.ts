import { ProviderFactory } from "../providers";
import { GitAnalyzer, FileFilter } from "../analysis";
import { ConfigLoader } from "../config";
import {
  ReviewConfig,
  ReviewComment,
  ReviewResult,
  CodeChange,
} from "../types";

export class ReviewEngine {
  private config: ReviewConfig;
  private gitAnalyzer: GitAnalyzer;
  private fileFilter: FileFilter;

  constructor(config: ReviewConfig, repoPath?: string) {
    this.config = config;
    this.gitAnalyzer = new GitAnalyzer(repoPath);
    this.fileFilter = new FileFilter(config.ignorePatterns);
  }

  async reviewChanges(baseSha: string, headSha: string): Promise<ReviewResult> {
    try {
      const changes = await this.gitAnalyzer.getChanges(baseSha, headSha);
      const reviewableChanges = this.filterReviewableChanges(changes);

      if (reviewableChanges.length === 0) {
        return this.createEmptyResult("No reviewable changes found");
      }

      const [codingStandards, reviewPrompt] = await Promise.all([
        ConfigLoader.loadCodingStandards(this.config.codingStandardsPath),
        ConfigLoader.loadReviewPrompt(this.config.reviewPromptPath),
      ]);

      const allComments: ReviewComment[] = [];
      const provider = ProviderFactory.create(this.config);

      for (const change of reviewableChanges) {
        const code = this.buildCodeContext(change);
        const prompt = this.buildPrompt(reviewPrompt, codingStandards);

        try {
          const comments = await provider.review(code, prompt, this.config);
          const validComments = this.validateAndFilterComments(
            comments,
            change.file
          );
          allComments.push(...validComments);
        } catch (error) {
          console.error(`Failed to review ${change.file}:`, error);
          allComments.push({
            file: change.file,
            line: 1,
            message: `Failed to review file: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            severity: "warning",
            category: "code-quality",
          });
        }
      }

      return this.buildResult(allComments);
    } catch (error) {
      throw new Error(
        `Review failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private filterReviewableChanges(changes: CodeChange[]): CodeChange[] {
    return changes.filter((change) =>
      this.fileFilter.shouldReview(change.file)
    );
  }

  private buildCodeContext(change: CodeChange): string {
    let context = `File: ${change.file}\n`;
    context += `Language: ${FileFilter.getLanguage(change.file)}\n\n`;

    for (const hunk of change.hunks) {
      context += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
      context += hunk.lines.join("\n") + "\n\n";
    }

    return context;
  }

  private buildPrompt(reviewPrompt?: string, codingStandards?: string): string {
    let prompt = reviewPrompt || this.getDefaultPrompt();

    if (codingStandards) {
      prompt += `\n\nCoding Standards to follow:\n${codingStandards}`;
    }

    return prompt;
  }

  private getDefaultPrompt(): string {
    return `You are an expert code reviewer. Review the provided code changes and identify issues.

Focus on:
- Code quality and best practices
- Security vulnerabilities
- Performance issues
- Maintainability concerns
- Style consistency
- Testing needs
- Documentation

Return feedback as JSON array with this structure:
[
  {
    "file": "path/to/file",
    "line": 10,
    "message": "Issue description",
    "severity": "error|warning|info",
    "category": "code-quality|security|performance|maintainability|style|testing|documentation",
    "suggestion": "Optional improvement suggestion"
  }
]`;
  }

  private validateAndFilterComments(
    comments: ReviewComment[],
    filePath: string
  ): ReviewComment[] {
    return comments
      .filter((comment) => this.isValidComment(comment))
      .filter((comment) => this.meetsSeverityThreshold(comment))
      .map((comment) => ({
        ...comment,
        file: comment.file || filePath,
      }));
  }

  private isValidComment(comment: ReviewComment): boolean {
    return !!(
      comment.message &&
      comment.severity &&
      ["info", "warning", "error"].includes(comment.severity) &&
      comment.category &&
      [
        "code-quality",
        "security",
        "performance",
        "maintainability",
        "style",
        "testing",
        "documentation",
      ].includes(comment.category)
    );
  }

  private meetsSeverityThreshold(comment: ReviewComment): boolean {
    const severityOrder = { info: 1, warning: 2, error: 3 };
    const thresholdOrder = { low: 1, medium: 2, high: 3 };

    const threshold = this.config.severityThreshold || "low";
    return severityOrder[comment.severity] >= thresholdOrder[threshold];
  }

  private buildResult(comments: ReviewComment[]): ReviewResult {
    const categories = this.categorizeComments(comments);
    const score = this.calculateScore(comments);
    const approved = this.shouldApprove(comments);
    const summary = this.generateSummary(comments, score);

    return {
      comments,
      summary,
      approved,
      score,
      categories,
    };
  }

  private categorizeComments(
    comments: ReviewComment[]
  ): Record<string, number> {
    const categories: Record<string, number> = {
      "code-quality": 0,
      security: 0,
      performance: 0,
      maintainability: 0,
      style: 0,
      testing: 0,
      documentation: 0,
    };

    for (const comment of comments) {
      categories[comment.category] = (categories[comment.category] || 0) + 1;
    }

    return categories;
  }

  private calculateScore(comments: ReviewComment[]): number {
    if (comments.length === 0) return 100;

    const weights = { error: -10, warning: -5, info: -1 };
    const penalty = comments.reduce(
      (sum, comment) => sum + weights[comment.severity],
      0
    );

    return Math.max(0, Math.min(100, 100 + penalty));
  }

  private shouldApprove(comments: ReviewComment[]): boolean {
    if (this.config.autoApprove && comments.length === 0) {
      return true;
    }

    const blockingIssues = comments.filter((comment) =>
      this.config.requireApprovalFor?.includes(comment.severity)
    );

    return blockingIssues.length === 0;
  }

  private generateSummary(comments: ReviewComment[], score: number): string {
    if (comments.length === 0) {
      return "✅ No issues found. Code looks good!";
    }

    const errorCount = comments.filter((c) => c.severity === "error").length;
    const warningCount = comments.filter(
      (c) => c.severity === "warning"
    ).length;
    const infoCount = comments.filter((c) => c.severity === "info").length;

    let summary = `🤖 AI Code Review Summary (Score: ${score}/100)\n\n`;

    if (errorCount > 0) {
      summary += `🚨 ${errorCount} error(s) found\n`;
    }
    if (warningCount > 0) {
      summary += `⚠️ ${warningCount} warning(s) found\n`;
    }
    if (infoCount > 0) {
      summary += `ℹ️ ${infoCount} info item(s) found\n`;
    }

    const topCategories = Object.entries(this.categorizeComments(comments))
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);

    if (topCategories.length > 0) {
      summary += `\nMain areas of concern: ${topCategories.join(", ")}`;
    }

    return summary;
  }

  private createEmptyResult(message: string): ReviewResult {
    return {
      comments: [],
      summary: message,
      approved: true,
      score: 100,
      categories: {
        "code-quality": 0,
        security: 0,
        performance: 0,
        maintainability: 0,
        style: 0,
        testing: 0,
        documentation: 0,
      },
    };
  }
}
