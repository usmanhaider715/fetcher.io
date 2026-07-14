import { config } from '../config/index.js';
import { Organization, AiUsageLog } from '../models/index.js';
import { getRedis } from '../lib/redis.js';

export type AiTask =
  | 'title'
  | 'description'
  | 'seo_keywords'
  | 'marketing_copy'
  | 'category_recommendation'
  | 'listing_review';

interface AiRequest {
  task: AiTask;
  product: { title?: string; description?: string; brand?: string; price?: number };
  organizationId: string;
  userId: string;
}

export class AiService {
  async generate(req: AiRequest) {
    await this.checkQuota(req.organizationId);

    const provider = config.ai.anthropicKey ? 'anthropic' : config.ai.openaiKey ? 'openai' : 'groq';
    const prompt = this.buildPrompt(req.task, req.product);
    const result = await this.callProvider(provider, prompt);

    await Organization.findByIdAndUpdate(req.organizationId, { $inc: { aiCallsUsed: 1 } });
    await getRedis().incr(`ai:${req.organizationId}:${new Date().toISOString().slice(0, 7)}`);

    await AiUsageLog.create({
      organizationId: req.organizationId,
      userId: req.userId,
      task: req.task,
      provider,
      promptVersion: 'v1',
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      confidence: result.confidence,
      metadata: { task: req.task },
    });

    return {
      ...result,
      provider,
      task: req.task,
      provenance: { provider, promptVersion: 'v1', timestamp: new Date().toISOString() },
    };
  }

  private async checkQuota(organizationId: string) {
    const org = await Organization.findById(organizationId);
    if (!org) throw Object.assign(new Error('Organization not found'), { status: 404 });
    if (org.aiCallsUsed >= org.aiCallsLimit) {
      throw Object.assign(new Error('AI quota exceeded — upgrade your plan'), { status: 402 });
    }
  }

  private buildPrompt(task: AiTask, product: AiRequest['product']): string {
    const base = `Product: ${product.title ?? 'Unknown'}\nBrand: ${product.brand ?? 'N/A'}\nPrice: ${product.price ?? 'N/A'}\nDescription: ${product.description ?? 'N/A'}`;
    const instructions: Record<AiTask, string> = {
      title: 'Generate an SEO-optimized product title (max 70 chars). Return only the title.',
      description: 'Write a compelling 2-paragraph product description for e-commerce. Return only the description.',
      seo_keywords: 'Generate 10 SEO keywords as a JSON array of strings.',
      marketing_copy: 'Write a short social media post (under 280 chars) promoting this product.',
      category_recommendation: 'Suggest the best e-commerce category path (e.g. Home > Kitchen > Utensils). Return one line.',
      listing_review: 'Rate this listing 1-10 and give 3 improvement tips as JSON: {"score":N,"tips":[]}',
    };
    return `${instructions[task]}\n\n${base}`;
  }

  private async callProvider(provider: string, prompt: string) {
    if (provider === 'anthropic' && config.ai.anthropicKey) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.ai.anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
      const data = (await res.json()) as {
        content?: Array<{ text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      return {
        content: data.content?.[0]?.text ?? '',
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        confidence: 0.85,
      };
    }

    if (config.ai.openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.ai.openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 512,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        content: data.choices?.[0]?.message?.content ?? '',
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        confidence: 0.8,
      };
    }

    throw Object.assign(new Error('No AI provider configured'), { status: 503 });
  }
}

export const aiService = new AiService();
