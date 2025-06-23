import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './base';
import { ReviewConfig, ReviewComment } from '../types';

export class AnthropicProvider extends BaseAIProvider {
  name = 'Anthropic';
  private client: Anthropic;

  constructor(apiKey: string) {
    super(apiKey);
    this.client = new Anthropic({ apiKey });
  }

  async review(code: string, prompt: string, config: ReviewConfig): Promise<ReviewComment[]> {
    try {
      const response = await this.client.messages.create({
        model: config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: config.maxTokens || 2000,
        temperature: config.temperature || 0.3,
        messages: [
          {
            role: 'user',
            content: this.buildReviewPrompt(code, prompt)
          }
        ]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      return this.parseReviewResponse(content.text);
    } catch (error) {
      console.error('Anthropic API Error:', error);
      throw new Error(`Anthropic review failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}