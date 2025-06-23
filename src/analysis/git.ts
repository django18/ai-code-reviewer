import { simpleGit, SimpleGit } from 'simple-git';
import { CodeChange, GitHunk } from '../types';

export class GitAnalyzer {
  private git: SimpleGit;

  constructor(repoPath: string = process.cwd()) {
    this.git = simpleGit(repoPath);
  }

  async getChanges(baseSha: string, headSha: string): Promise<CodeChange[]> {
    try {
      const diff = await this.git.diff([`${baseSha}...${headSha}`, '--no-color']);
      return this.parseDiff(diff);
    } catch (error) {
      throw new Error(`Failed to get git changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getChangedFiles(baseSha: string, headSha: string): Promise<string[]> {
    try {
      const result = await this.git.diff([`${baseSha}...${headSha}`, '--name-only']);
      return result.split('\n').filter(file => file.trim() !== '');
    } catch (error) {
      throw new Error(`Failed to get changed files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFileContent(sha: string, filePath: string): Promise<string> {
    try {
      return await this.git.show([`${sha}:${filePath}`]);
    } catch (error) {
      return '';
    }
  }

  private parseDiff(diff: string): CodeChange[] {
    const changes: CodeChange[] = [];
    const files = diff.split(/^diff --git/m).slice(1);

    for (const file of files) {
      const lines = file.split('\n');
      const headerLine = lines[0];
      
      const fileMatch = headerLine.match(/a\/(.+) b\/(.+)/);
      if (!fileMatch) continue;

      const filePath = fileMatch[2];
      const change: CodeChange = {
        file: filePath,
        additions: [],
        deletions: [],
        context: [],
        hunks: []
      };

      let currentHunk: GitHunk | null = null;
      let inHunk = false;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('@@')) {
          if (currentHunk) {
            change.hunks.push(currentHunk);
          }

          const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
          if (hunkMatch) {
            currentHunk = {
              oldStart: parseInt(hunkMatch[1]),
              oldLines: parseInt(hunkMatch[2] || '1'),
              newStart: parseInt(hunkMatch[3]),
              newLines: parseInt(hunkMatch[4] || '1'),
              lines: []
            };
            inHunk = true;
          }
        } else if (inHunk && currentHunk) {
          currentHunk.lines.push(line);
          
          if (line.startsWith('+') && !line.startsWith('+++')) {
            change.additions.push(line.substring(1));
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            change.deletions.push(line.substring(1));
          } else if (line.startsWith(' ')) {
            change.context.push(line.substring(1));
          }
        }
      }

      if (currentHunk) {
        change.hunks.push(currentHunk);
      }

      if (change.hunks.length > 0) {
        changes.push(change);
      }
    }

    return changes;
  }

  async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || 'main';
  }

  async getCommitInfo(sha: string): Promise<{ message: string; author: string; date: string }> {
    const log = await this.git.log({ from: sha, to: sha, maxCount: 1 });
    const commit = log.latest;
    
    if (!commit) {
      throw new Error(`Commit ${sha} not found`);
    }

    return {
      message: commit.message,
      author: `${commit.author_name} <${commit.author_email}>`,
      date: commit.date
    };
  }
}