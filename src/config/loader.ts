import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ReviewConfig } from '../types';

export class ConfigLoader {
  private static readonly CONFIG_FILES = [
    '.ai-review.json',
    '.ai-review.yaml',
    '.ai-review.yml',
    'ai-review.config.js',
  ];

  static async load(configPath?: string): Promise<ReviewConfig> {
    const config = await this.loadConfigFile(configPath);
    return this.mergeWithDefaults(config);
  }

  private static async loadConfigFile(configPath?: string): Promise<Partial<ReviewConfig>> {
    if (configPath) {
      return this.loadFromPath(configPath);
    }

    for (const configFile of this.CONFIG_FILES) {
      const fullPath = path.join(process.cwd(), configFile);
      
      try {
        await fs.access(fullPath);
        return this.loadFromPath(fullPath);
      } catch {
        continue;
      }
    }

    return {};
  }

  private static async loadFromPath(filePath: string): Promise<Partial<ReviewConfig>> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath);

      switch (ext) {
        case '.json':
          return JSON.parse(content);
        case '.yaml':
        case '.yml':
          return yaml.load(content) as Partial<ReviewConfig>;
        case '.js':
          const module = await import(path.resolve(filePath));
          return module.default || module;
        default:
          throw new Error(`Unsupported config file type: ${ext}`);
      }
    } catch (error) {
      throw new Error(`Failed to load config from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static mergeWithDefaults(config: Partial<ReviewConfig>): ReviewConfig {
    return {
      aiProvider: config.aiProvider || 'openai',
      model: config.model,
      maxTokens: config.maxTokens || 2000,
      temperature: config.temperature || 0.3,
      codingStandardsPath: config.codingStandardsPath,
      reviewPromptPath: config.reviewPromptPath,
      ignorePatterns: config.ignorePatterns || [],
      severityThreshold: config.severityThreshold || 'medium',
      autoApprove: config.autoApprove || false,
      requireApprovalFor: config.requireApprovalFor || ['error'],
    };
  }

  static async loadCodingStandards(standardsPath?: string): Promise<string | undefined> {
    if (!standardsPath) {
      const defaultPaths = [
        'coding-standards.md',
        'CODING_STANDARDS.md',
        '.github/CODING_STANDARDS.md',
        'docs/coding-standards.md',
      ];

      for (const defaultPath of defaultPaths) {
        try {
          return await fs.readFile(path.join(process.cwd(), defaultPath), 'utf-8');
        } catch {
          continue;
        }
      }

      return undefined;
    }

    try {
      return await fs.readFile(path.resolve(standardsPath), 'utf-8');
    } catch (error) {
      console.warn(`Failed to load coding standards from ${standardsPath}:`, error);
      return undefined;
    }
  }

  static async loadReviewPrompt(promptPath?: string): Promise<string | undefined> {
    if (!promptPath) {
      const defaultPaths = [
        'review-prompt.md',
        'REVIEW_PROMPT.md',
        '.github/REVIEW_PROMPT.md',
        'prompts/review.md',
      ];

      for (const defaultPath of defaultPaths) {
        try {
          return await fs.readFile(path.join(process.cwd(), defaultPath), 'utf-8');
        } catch {
          continue;
        }
      }

      return undefined;
    }

    try {
      return await fs.readFile(path.resolve(promptPath), 'utf-8');
    } catch (error) {
      console.warn(`Failed to load review prompt from ${promptPath}:`, error);
      return undefined;
    }
  }

  static createDefaultConfig(): string {
    return JSON.stringify({
      aiProvider: 'openai',
      model: 'gpt-4o',
      maxTokens: 2000,
      temperature: 0.3,
      codingStandardsPath: 'coding-standards.md',
      reviewPromptPath: 'review-prompt.md',
      ignorePatterns: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '*.min.js',
        '*.min.css'
      ],
      severityThreshold: 'medium',
      autoApprove: false,
      requireApprovalFor: ['error']
    }, null, 2);
  }

  static createDefaultCodingStandards(): string {
    return `# Coding Standards

## General Guidelines
- Write clean, readable, and maintainable code
- Follow consistent naming conventions
- Add meaningful comments and documentation
- Keep functions small and focused
- Handle errors appropriately

## Code Quality
- Avoid code duplication (DRY principle)
- Use meaningful variable and function names
- Follow SOLID principles
- Write comprehensive tests

## Security
- Validate all inputs
- Use parameterized queries for database operations
- Never commit secrets or sensitive data
- Follow security best practices for your technology stack

## Performance
- Optimize for readability first, performance second
- Profile before optimizing
- Use appropriate data structures and algorithms
- Consider memory usage and avoid memory leaks

## Testing
- Write unit tests for all business logic
- Include integration tests for critical paths
- Maintain good test coverage
- Use descriptive test names and clear assertions
`;
  }

  static createDefaultReviewPrompt(): string {
    return `# AI Code Review Prompt

You are an expert code reviewer. Please analyze the provided code changes and provide constructive feedback.

## Review Focus Areas

### 1. Code Quality
- Code structure and organization
- Readability and maintainability
- Design patterns and best practices
- Code complexity and clarity

### 2. Security
- Input validation and sanitization
- Authentication and authorization
- Data exposure and privacy
- Common security vulnerabilities

### 3. Performance
- Algorithm efficiency
- Resource usage
- Scalability considerations
- Potential bottlenecks

### 4. Maintainability
- Code duplication
- Error handling
- Logging and debugging
- Documentation quality

### 5. Testing
- Test coverage
- Test quality and clarity
- Edge case handling
- Integration testing needs

## Output Format

Provide feedback as a JSON array with this structure:
\`\`\`json
[
  {
    "file": "path/to/file.js",
    "line": 42,
    "message": "Clear description of the issue",
    "severity": "error|warning|info",
    "category": "code-quality|security|performance|maintainability|style|testing|documentation",
    "suggestion": "Optional specific improvement suggestion"
  }
]
\`\`\`

## Guidelines
- Be constructive and specific in your feedback
- Prioritize security and critical issues
- Suggest concrete improvements when possible
- Consider the broader codebase context
- Focus on meaningful issues, not nitpicks
`;
  }
}