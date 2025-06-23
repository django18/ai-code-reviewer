import { Octokit } from "@octokit/rest";
import { ReviewComment, GitHubPRInfo } from "../types";

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    if (!token) {
      throw new Error("GitHub token is required");
    }

    this.octokit = new Octokit({
      auth: token,
    });
  }

  async getPRInfo(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<GitHubPRInfo> {
    try {
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      });

      return {
        owner,
        repo,
        pullNumber,
        headSha: pr.head.sha,
        baseSha: pr.base.sha,
      };
    } catch (error) {
      throw new Error(
        `Failed to get PR info: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async addReviewComments(
    owner: string,
    repo: string,
    pullNumber: number,
    headSha: string,
    comments: ReviewComment[]
  ): Promise<void> {
    try {
      const reviewComments = comments.map((comment) => ({
        path: comment.file,
        line: comment.line,
        body: this.formatComment(comment),
      }));

      if (reviewComments.length === 0) {
        return;
      }

      await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: headSha,
        event: "COMMENT",
        comments: reviewComments,
      });
    } catch (error) {
      throw new Error(
        `Failed to add review comments: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async approveOrRequestChanges(
    owner: string,
    repo: string,
    pullNumber: number,
    headSha: string,
    approved: boolean,
    summary: string
  ): Promise<void> {
    try {
      await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: headSha,
        event: approved ? "APPROVE" : "REQUEST_CHANGES",
        body: summary,
      });
    } catch (error) {
      throw new Error(
        `Failed to ${approved ? "approve" : "request changes for"} PR: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async addStatusCheck(
    owner: string,
    repo: string,
    sha: string,
    context: string,
    state: "success" | "failure" | "pending",
    description: string,
    targetUrl?: string
  ): Promise<void> {
    try {
      await this.octokit.repos.createCommitStatus({
        owner,
        repo,
        sha,
        state,
        context,
        description,
        target_url: targetUrl,
      });
    } catch (error) {
      throw new Error(
        `Failed to add status check: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getExistingReviewComments(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<
    Array<{ id: number; body: string; path: string; line: number | null }>
  > {
    try {
      const { data: comments } = await this.octokit.pulls.listReviewComments({
        owner,
        repo,
        pull_number: pullNumber,
      });

      return comments
        .filter((comment) => comment.body.includes("🤖 AI Review"))
        .map((comment) => ({
          id: comment.id,
          body: comment.body,
          path: comment.path,
          line: comment.line ?? null,
        }));
    } catch (error) {
      throw new Error(
        `Failed to get existing comments: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async deleteComment(
    owner: string,
    repo: string,
    commentId: number
  ): Promise<void> {
    try {
      await this.octokit.pulls.deleteReviewComment({
        owner,
        repo,
        comment_id: commentId,
      });
    } catch (error) {
      console.warn(`Failed to delete comment ${commentId}:`, error);
    }
  }

  private formatComment(comment: ReviewComment): string {
    const severityEmoji = {
      error: "🚨",
      warning: "⚠️",
      info: "ℹ️",
    };

    const categoryEmoji = {
      "code-quality": "🏗️",
      security: "🔒",
      performance: "⚡",
      maintainability: "🧹",
      style: "🎨",
      testing: "🧪",
      documentation: "📚",
    };

    let formattedComment = `🤖 **AI Review** ${
      severityEmoji[comment.severity]
    } ${categoryEmoji[comment.category] || ""}\n\n`;
    formattedComment += `**${comment.severity.toUpperCase()}**: ${
      comment.message
    }\n\n`;

    if (comment.suggestion) {
      formattedComment += `**Suggestion**:\n${comment.suggestion}\n\n`;
    }

    formattedComment += `*Category: ${comment.category}*`;

    return formattedComment;
  }

  static parseGitHubUrl(
    url: string
  ): { owner: string; repo: string; pullNumber?: number } | null {
    const match = url.match(
      /github\.com\/([^\/]+)\/([^\/]+)(?:\/pull\/(\d+))?/
    );

    if (!match) {
      return null;
    }

    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ""),
      pullNumber: match[3] ? parseInt(match[3]) : undefined,
    };
  }
}
