import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { AIProvider, ReviewConfig } from '../types';

export class ProviderFactory {
  static create(config: ReviewConfig): AIProvider {
    const apiKey = this.getApiKey(config.aiProvider);
    
    switch (config.aiProvider) {
      case 'openai':
        return new OpenAIProvider(apiKey);
      case 'anthropic':
        return new AnthropicProvider(apiKey);
      default:
        throw new Error(`Unsupported AI provider: ${config.aiProvider}`);
    }
  }

  private static getApiKey(provider: string): string {
    const envKey = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
    const apiKey = process.env[envKey];
    
    if (!apiKey) {
      throw new Error(`${envKey} environment variable is required for ${provider} provider`);
    }
    
    return apiKey;
  }
}

export { OpenAIProvider, AnthropicProvider };
export * from './base';