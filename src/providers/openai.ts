import OpenAI from 'openai';
import { BaseAIProvider } from './base';
import { ReviewConfig, ReviewComment } from '../types';

export class OpenAIProvider extends BaseAIProvider {
  name = 'OpenAI';
  private client: OpenAI;

  constructor(apiKey: string) {
    super(apiKey);
    this.client = new OpenAI({ apiKey });
  }

  async review(code: string, prompt: string, config: ReviewConfig): Promise<ReviewComment[]> {
    try {
      const response = await this.client.chat.completions.create({
        model: config.model || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert code reviewer. Provide detailed, constructive feedback.'
          },
          {
            role: 'user',
            content: this.buildReviewPrompt(code, prompt)
          }
        ],
        max_tokens: config.maxTokens || 2000,
        temperature: config.temperature || 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return this.parseReviewResponse(content);
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error(`OpenAI review failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}