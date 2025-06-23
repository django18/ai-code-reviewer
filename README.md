# AI Code Reviewer

An intelligent, AI-powered code review tool that integrates seamlessly with GitHub and supports multiple AI providers (OpenAI, Anthropic). Perfect for organizations looking to maintain code quality standards across multiple repositories.

## 🚀 Features

- **Multi-AI Provider Support**: Works with OpenAI GPT-4o and Anthropic Claude
- **GitHub Integration**: Automatic PR comments, approvals, and status checks
- **Configurable Standards**: Custom coding standards and review prompts
- **CLI & GitHub Actions**: Local usage and CI/CD integration
- **Smart Filtering**: Ignores irrelevant files and focuses on meaningful changes
- **Severity Levels**: Categorizes issues by severity and type
- **Organization Ready**: Reusable configurations across multiple repositories

## 📦 Installation

```bash
npm install -g @eighteen-dev/ai-code-reviewer
```

## 🎯 Quick Start

### 1. Initialize Configuration

```bash
ai-review init
```

This creates:
- `.ai-review.json` - Main configuration
- `coding-standards.md` - Your coding standards
- `review-prompt.md` - AI review instructions

### 2. Set API Keys

```bash
export OPENAI_API_KEY="your-openai-key"
# OR
export ANTHROPIC_API_KEY="your-anthropic-key"
```

### 3. Review Code Changes

```bash
# Review current changes
ai-review review

# Review specific commits
ai-review review --base main --head feature-branch
```

## 🔧 Configuration

### Basic Configuration (`.ai-review.json`)

```json
{
  "aiProvider": "openai",
  "model": "gpt-4o",
  "maxTokens": 2000,
  "temperature": 0.3,
  "codingStandardsPath": "coding-standards.md",
  "reviewPromptPath": "review-prompt.md",
  "ignorePatterns": [
    "node_modules/**",
    "dist/**",
    "*.min.js"
  ],
  "severityThreshold": "medium",
  "autoApprove": false,
  "requireApprovalFor": ["error"]
}
```

### Advanced Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `aiProvider` | AI provider (`openai` or `anthropic`) | `"openai"` |
| `model` | AI model to use | `"gpt-4o"` |
| `maxTokens` | Maximum tokens per request | `2000` |
| `temperature` | AI creativity (0-1) | `0.3` |
| `codingStandardsPath` | Path to coding standards file | `"coding-standards.md"` |
| `reviewPromptPath` | Path to review prompt file | `"review-prompt.md"` |
| `ignorePatterns` | Files/patterns to ignore | `[]` |
| `severityThreshold` | Minimum severity to report | `"medium"` |
| `autoApprove` | Auto-approve if no issues | `false` |
| `requireApprovalFor` | Severities that block approval | `["error"]` |

## 🔗 GitHub Integration

### GitHub Actions Setup

1. Add the workflow file `.github/workflows/ai-review.yml`:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  ai-code-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      checks: write
      
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install AI Code Reviewer
        run: npm install -g @eighteen-dev/ai-code-reviewer
        
      - name: Run AI Code Review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          ai-review github-action \
            --owner ${{ github.repository_owner }} \
            --repo ${{ github.event.repository.name }} \
            --pr ${{ github.event.pull_request.number }}
```

2. Add your AI provider API key to repository secrets:
   - `OPENAI_API_KEY` for OpenAI
   - `ANTHROPIC_API_KEY` for Anthropic

### Manual GitHub Integration

```bash
export GITHUB_TOKEN="your-github-token"
ai-review github-action --owner myorg --repo myrepo --pr 123
```

## 📋 Coding Standards

Create a `coding-standards.md` file to define your project's standards:

```markdown
# Coding Standards

## General Guidelines
- Write clean, readable, and maintainable code
- Follow consistent naming conventions
- Add meaningful comments and documentation

## Security
- Validate all inputs
- Use parameterized queries
- Never commit secrets

## Performance
- Optimize for readability first
- Profile before optimizing
- Use appropriate data structures
```

## 🎯 Review Categories

The AI reviewer categorizes issues into:

- **🏗️ Code Quality**: Structure, patterns, best practices
- **🔒 Security**: Vulnerabilities, input validation, data exposure
- **⚡ Performance**: Efficiency, scalability, resource usage
- **🧹 Maintainability**: Complexity, error handling, documentation
- **🎨 Style**: Formatting, naming conventions, consistency
- **🧪 Testing**: Coverage, test quality, edge cases
- **📚 Documentation**: Comments, README, API docs

## 💻 CLI Commands

### `ai-review review`
Review code changes locally.

```bash
ai-review review [options]

Options:
  -b, --base <sha>     Base commit SHA
  -h, --head <sha>     Head commit SHA
  -c, --config <path>  Path to config file
  --no-github          Skip GitHub integration
```

### `ai-review init`
Initialize configuration files.

```bash
ai-review init [options]

Options:
  --config-only  Only create config file
```

### `ai-review github-action`
Run in GitHub Actions mode.

```bash
ai-review github-action [options]

Options:
  --owner <owner>      Repository owner (required)
  --repo <repo>        Repository name (required)
  --pr <number>        Pull request number (required)
  -c, --config <path>  Path to config file
```

## 🏢 Organization Setup

### 1. Create Organization Config Repository

```
my-org-standards/
├── .ai-review.json
├── coding-standards.md
├── review-prompt.md
└── README.md
```

### 2. Reference in Projects

```json
{
  "aiProvider": "openai",
  "codingStandardsPath": "../my-org-standards/coding-standards.md",
  "reviewPromptPath": "../my-org-standards/review-prompt.md"
}
```

### 3. Shared GitHub Action

Create a reusable workflow in `.github/workflows/ai-review.yml`:

```yaml
name: Reusable AI Review
on:
  workflow_call:
    secrets:
      OPENAI_API_KEY:
        required: true

jobs:
  review:
    uses: my-org/standards/.github/workflows/ai-review.yml@main
    secrets:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## 🔧 Programmatic Usage

```typescript
import { ReviewEngine, ConfigLoader, GitHubClient } from '@eighteen-dev/ai-code-reviewer';

// Load configuration
const config = await ConfigLoader.load();

// Review changes
const reviewEngine = new ReviewEngine(config);
const result = await reviewEngine.reviewChanges('main', 'feature-branch');

// Post to GitHub
const github = new GitHubClient(process.env.GITHUB_TOKEN);
await github.addReviewComments('owner', 'repo', 123, 'sha', result.comments);
```

## 🎨 Custom AI Providers

Extend the tool with your own AI provider:

```typescript
import { BaseAIProvider } from '@eighteen-dev/ai-code-reviewer';

class CustomProvider extends BaseAIProvider {
  name = 'Custom';
  
  async review(code: string, prompt: string, config: ReviewConfig): Promise<ReviewComment[]> {
    // Your implementation
  }
}
```

## 🐛 Troubleshooting

### Common Issues

**API Key Not Found**
```bash
Error: OPENAI_API_KEY environment variable is required
```
Solution: Set your API key in environment variables.

**Git Repository Not Found**
```bash
Error: Failed to get git changes
```
Solution: Ensure you're in a git repository with proper permissions.

**GitHub Token Permissions**
```bash
Error: Failed to add review comments
```
Solution: Ensure your GitHub token has `pull_requests: write` permission.

### Debug Mode

Enable verbose logging:
```bash
DEBUG=ai-review:* ai-review review
```

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

- [GitHub Issues](https://github.com/eighteen-dev/ai-code-reviewer/issues)
- [Documentation](https://github.com/eighteen-dev/ai-code-reviewer/wiki)