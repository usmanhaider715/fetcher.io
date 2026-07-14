import type { AppSettings } from '@fetcher/shared';
import { DEFAULT_SETTINGS } from '@fetcher/shared';
import { prisma } from '../lib/prisma.js';

const SETTINGS_KEY = 'app_settings';

export class SettingsService {
  async get(): Promise<AppSettings> {
    const record = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
    if (!record) return DEFAULT_SETTINGS;
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(record.value) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async update(settings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.get();
    const merged = { ...current, ...settings };

    await prisma.setting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value: JSON.stringify(merged) },
      update: { value: JSON.stringify(merged) },
    });

    return merged;
  }
}

export const settingsService = new SettingsService();
