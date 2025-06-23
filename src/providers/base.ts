import { AIProvider, ReviewConfig, ReviewComment } from "../types";

export abstract class BaseAIProvider implements AIProvider {
  abstract name: string;

  constructor(protected apiKey: string) {
    if (!apiKey) {
      throw new Error(`API key is required for provider`);
    }
  }

  abstract review(
    code: string,
    prompt: string,
    config: ReviewConfig
  ): Promise<ReviewComment[]>;

  protected parseReviewResponse(response: string): ReviewComment[] {
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      const directJson = response.trim();
      if (directJson.startsWith("[") || directJson.startsWith("{")) {
        return JSON.parse(directJson);
      }

      return this.parseTextResponse(response);
    } catch (error) {
      console.warn(
        "Failed to parse AI response as JSON, falling back to text parsing"
      );
      return this.parseTextResponse(response);
    }
  }

  private parseTextResponse(response: string): ReviewComment[] {
    const comments: ReviewComment[] = [];
    const lines = response.split("\n");

    let currentComment: Partial<ReviewComment> = {};

    for (const line of lines) {
      if (line.startsWith("File:")) {
        if (currentComment.file) {
          comments.push(currentComment as ReviewComment);
        }
        currentComment = { file: line.replace("File:", "").trim() };
      } else if (line.startsWith("Line:")) {
        currentComment.line = parseInt(line.replace("Line:", "").trim());
      } else if (line.startsWith("Severity:")) {
        const severity = line.replace("Severity:", "").trim().toLowerCase();
        currentComment.severity = ["info", "warning", "error"].includes(
          severity
        )
          ? (severity as any)
          : "warning";
      } else if (line.startsWith("Category:")) {
        currentComment.category = line.replace("Category:", "").trim() as any;
      } else if (line.startsWith("Message:")) {
        currentComment.message = line.replace("Message:", "").trim();
      } else if (line.startsWith("Suggestion:")) {
        currentComment.suggestion = line.replace("Suggestion:", "").trim();
      }
    }

    if (currentComment.file && currentComment.message) {
      comments.push(currentComment as ReviewComment);
    }

    return comments;
  }

  protected buildReviewPrompt(
    code: string,
    basePrompt: string,
    codingStandards?: string
  ): string {
    let prompt = basePrompt || this.getDefaultPrompt();

    if (codingStandards) {
      prompt += `\n\nCoding Standards:\n${codingStandards}`;
    }

    prompt += `\n\nCode to review:\n\`\`\`\n${code}\n\`\`\``;

    return prompt;
  }

  private getDefaultPrompt(): string {
    return `You are an AI code reviewer. Please review the provided code and return your feedback as a JSON array of review comments.

Each comment should have this structure:
{
  "file": "path/to/file.ts",
  "line": 10,
  "message": "Description of the issue",
  "severity": "info|warning|error",
  "category": "code-quality|security|performance|maintainability|style|testing|documentation",
  "suggestion": "Optional suggestion for improvement"
}

Focus on:
- Code quality and best practices
- Security vulnerabilities
- Performance issues
- Maintainability concerns
- Style consistency
- Testing gaps
- Documentation needs

Provide constructive, actionable feedback.`;
  }
}
