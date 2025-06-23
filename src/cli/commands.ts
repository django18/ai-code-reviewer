import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ReviewEngine } from '../review';
import { GitHubClient } from '../github';
import { ConfigLoader } from '../config';
import { GitAnalyzer } from '../analysis';

const program = new Command();

program
  .name('ai-review')
  .description('AI-powered code review tool')
  .version('1.0.0');

program
  .command('review')
  .description('Review code changes')
  .option('-b, --base <sha>', 'Base commit SHA')
  .option('-h, --head <sha>', 'Head commit SHA')
  .option('-c, --config <path>', 'Path to config file')
  .option('--no-github', 'Skip GitHub integration')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🤖 Starting AI code review...'));

      const config = await ConfigLoader.load(options.config);
      const gitAnalyzer = new GitAnalyzer();

      const baseSha = options.base || await gitAnalyzer.getCurrentBranch();
      const headSha = options.head || 'HEAD';

      console.log(chalk.gray(`Reviewing changes from ${baseSha} to ${headSha}`));

      const reviewEngine = new ReviewEngine(config);
      const result = await reviewEngine.reviewChanges(baseSha, headSha);

      console.log('\n' + chalk.bold('📝 Review Results:'));
      console.log(result.summary);

      if (result.comments.length > 0) {
        console.log('\n' + chalk.bold('💬 Comments:'));
        for (const comment of result.comments) {
          const severityColor = comment.severity === 'error' ? 'red' : 
                               comment.severity === 'warning' ? 'yellow' : 'blue';
          
          console.log(`\n${chalk[severityColor]('●')} ${chalk.bold(comment.file)}:${comment.line}`);
          console.log(`  ${comment.message}`);
          
          if (comment.suggestion) {
            console.log(`  ${chalk.green('💡 Suggestion:')} ${comment.suggestion}`);
          }
        }
      }

      if (!options.github && process.env.GITHUB_TOKEN) {
        const prInfo = await getGitHubPRInfo();
        if (prInfo) {
          await postToGitHub(result, prInfo, config);
        }
      }

      process.exit(result.approved ? 0 : 1);
    } catch (error) {
      console.error(chalk.red('❌ Review failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize AI review configuration')
  .option('--config-only', 'Only create config file')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Initializing AI code review...'));

      await fs.writeFile('.ai-review.json', ConfigLoader.createDefaultConfig());
      console.log(chalk.green('✅ Created .ai-review.json'));

      if (!options.configOnly) {
        await fs.writeFile('coding-standards.md', ConfigLoader.createDefaultCodingStandards());
        console.log(chalk.green('✅ Created coding-standards.md'));

        await fs.writeFile('review-prompt.md', ConfigLoader.createDefaultReviewPrompt());
        console.log(chalk.green('✅ Created review-prompt.md'));
      }

      console.log('\n' + chalk.yellow('📋 Next steps:'));
      console.log('1. Set your AI provider API key (OPENAI_API_KEY or ANTHROPIC_API_KEY)');
      console.log('2. Customize coding-standards.md for your project');
      console.log('3. Adjust review-prompt.md if needed');
      console.log('4. Run: ai-review review');
    } catch (error) {
      console.error(chalk.red('❌ Initialization failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('github-action')
  .description('Run in GitHub Actions mode')
  .requiredOption('--owner <owner>', 'Repository owner')
  .requiredOption('--repo <repo>', 'Repository name')
  .requiredOption('--pr <number>', 'Pull request number')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔄 Running in GitHub Actions mode...'));

      const config = await ConfigLoader.load(options.config);
      const prNumber = parseInt(options.pr);

      if (!process.env.GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN environment variable is required');
      }

      const github = new GitHubClient(process.env.GITHUB_TOKEN);
      const prInfo = await github.getPRInfo(options.owner, options.repo, prNumber);

      console.log(chalk.gray(`Reviewing PR #${prNumber}: ${prInfo.baseSha}...${prInfo.headSha}`));

      const reviewEngine = new ReviewEngine(config);
      const result = await reviewEngine.reviewChanges(prInfo.baseSha, prInfo.headSha);

      await github.addStatusCheck(
        options.owner,
        options.repo,
        prInfo.headSha,
        'ai-code-review',
        result.approved ? 'success' : 'failure',
        `AI Review Score: ${result.score}/100`
      );

      if (result.comments.length > 0) {
        await github.addReviewComments(
          options.owner,
          options.repo,
          prNumber,
          prInfo.headSha,
          result.comments
        );
      }

      await github.approveOrRequestChanges(
        options.owner,
        options.repo,
        prNumber,
        prInfo.headSha,
        result.approved,
        result.summary
      );

      console.log(chalk.green('✅ GitHub review completed'));
      console.log(`Score: ${result.score}/100, Comments: ${result.comments.length}, Approved: ${result.approved}`);

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ GitHub Action failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

async function getGitHubPRInfo() {
  try {
    const prUrl = process.env.GITHUB_PR_URL || process.env.CI_PULL_REQUEST;
    if (!prUrl) return null;

    const parsed = GitHubClient.parseGitHubUrl(prUrl);
    if (!parsed || !parsed.pullNumber) return null;

    return {
      owner: parsed.owner,
      repo: parsed.repo,
      pullNumber: parsed.pullNumber,
    };
  } catch {
    return null;
  }
}

async function postToGitHub(result: any, prInfo: any, config: any) {
  try {
    const github = new GitHubClient(process.env.GITHUB_TOKEN!);
    const fullPrInfo = await github.getPRInfo(prInfo.owner, prInfo.repo, prInfo.pullNumber);

    if (result.comments.length > 0) {
      await github.addReviewComments(
        prInfo.owner,
        prInfo.repo,
        prInfo.pullNumber,
        fullPrInfo.headSha,
        result.comments
      );
    }

    await github.approveOrRequestChanges(
      prInfo.owner,
      prInfo.repo,
      prInfo.pullNumber,
      fullPrInfo.headSha,
      result.approved,
      result.summary
    );

    console.log(chalk.green('✅ Posted review to GitHub'));
  } catch (error) {
    console.warn(chalk.yellow('⚠️ Failed to post to GitHub:'), error instanceof Error ? error.message : error);
  }
}

export { program };