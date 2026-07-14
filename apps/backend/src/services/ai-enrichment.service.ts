import type { Product } from '@fetcher/shared';
import { settingsService } from './settings.service.js';
import { logger } from './logger.service.js';

export interface EnrichmentResult {
  enriched: boolean;
  product: Product;
  fields: string[];
  message?: string;
}

export class AiEnrichmentService {
  async enrichProduct(product: Product, sessionId?: string): Promise<EnrichmentResult> {
    const settings = await settingsService.get();
    const apiKey = (settings as AppSettingsWithAi).openAiApiKey;

    if (!apiKey) {
      return {
        enriched: false,
        product,
        fields: [],
        message: 'AI enrichment disabled — no API key configured',
      };
    }

    try {
      const enriched = { ...product };
      const fields: string[] = [];

      if (product.title && !product.shortDescription) {
        enriched.shortDescription = await this.rewriteDescription(product.title, product.description, apiKey);
        fields.push('shortDescription');
      }

      if (product.title) {
        enriched.metaTitle = product.title.slice(0, 60);
        enriched.metaDescription = (enriched.shortDescription ?? product.description ?? product.title).slice(0, 160);
        fields.push('metaTitle', 'metaDescription');
      }

      await logger.log('info', `AI enriched: ${product.title ?? product.uniqueId}`, sessionId, { fields });

      return { enriched: true, product: enriched, fields };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI enrichment failed';
      await logger.log('warning', message, sessionId);
      return { enriched: false, product, fields: [], message };
    }
  }

  private async rewriteDescription(title: string, description: string | undefined, apiKey: string): Promise<string> {
    const prompt = `Write a concise 2-sentence product summary for e-commerce.\nTitle: ${title}\nDescription: ${description ?? 'N/A'}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? title;
  }
}

interface AppSettingsWithAi {
  openAiApiKey?: string;
  aiEnrichmentEnabled?: boolean;
}

export const aiEnrichmentService = new AiEnrichmentService();
