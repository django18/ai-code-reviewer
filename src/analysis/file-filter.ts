import { minimatch } from 'minimatch';
import * as path from 'path';

export class FileFilter {
  private ignorePatterns: string[];
  private includePatterns: string[];

  constructor(ignorePatterns: string[] = [], includePatterns: string[] = []) {
    this.ignorePatterns = [
      ...this.getDefaultIgnorePatterns(),
      ...ignorePatterns
    ];
    this.includePatterns = includePatterns;
  }

  shouldReview(filePath: string): boolean {
    if (this.isIgnored(filePath)) {
      return false;
    }

    if (this.includePatterns.length > 0) {
      return this.isIncluded(filePath);
    }

    return this.isReviewableFile(filePath);
  }

  private isIgnored(filePath: string): boolean {
    return this.ignorePatterns.some(pattern => 
      minimatch(filePath, pattern, { dot: true })
    );
  }

  private isIncluded(filePath: string): boolean {
    return this.includePatterns.some(pattern => 
      minimatch(filePath, pattern, { dot: true })
    );
  }

  private isReviewableFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const reviewableExtensions = [
      '.js', '.jsx', '.ts', '.tsx',
      '.py', '.java', '.cpp', '.c', '.h',
      '.cs', '.go', '.rs', '.php',
      '.rb', '.swift', '.kt', '.scala',
      '.sql', '.sh', '.bash',
      '.json', '.yaml', '.yml',
      '.md', '.mdx'
    ];

    return reviewableExtensions.includes(ext);
  }

  private getDefaultIgnorePatterns(): string[] {
    return [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.nyc_output/**',
      'vendor/**',
      'tmp/**',
      'temp/**',
      '*.min.js',
      '*.min.css',
      '*.map',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      '.env*',
      '*.log',
      '.DS_Store',
      'Thumbs.db',
      '*.pyc',
      '__pycache__/**',
      '.pytest_cache/**',
      '.tox/**',
      'venv/**',
      'env/**',
      '.venv/**'
    ];
  }

  getReviewableFiles(files: string[]): string[] {
    return files.filter(file => this.shouldReview(file));
  }

  static getLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.sql': 'sql',
      '.sh': 'bash',
      '.bash': 'bash',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.mdx': 'markdown'
    };

    return languageMap[ext] || 'text';
  }
}