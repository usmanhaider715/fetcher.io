import { create } from 'zustand';
import type { AppSettings, DashboardStats, LogEntry, SessionStatus } from '@fetcher/shared';
import { DEFAULT_SETTINGS } from '@fetcher/shared';

interface DashboardState {
  stats: DashboardStats;
  logs: LogEntry[];
  settings: AppSettings;
  isLoading: boolean;
  setStats: (stats: Partial<DashboardStats>) => void;
  setSessionStatus: (status: SessionStatus) => void;
  addLog: (log: LogEntry) => void;
  setLogs: (logs: LogEntry[]) => void;
  setSettings: (settings: AppSettings) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialStats: DashboardStats = {
  currentUrl: '',
  detectedPlatform: null,
  productsFound: 0,
  productsSaved: 0,
  imagesDownloaded: 0,
  errors: 0,
  sessionStatus: 'idle',
};

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: initialStats,
  logs: [],
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  setStats: (stats) =>
    set((state) => ({
      stats: { ...state.stats, ...stats },
    })),
  setSessionStatus: (status) =>
    set((state) => ({
      stats: { ...state.stats, sessionStatus: status },
    })),
  addLog: (log) =>
    set((state) => ({
      logs: [log, ...state.logs].slice(0, 100),
    })),
  setLogs: (logs) => set({ logs }),
  setSettings: (settings) => set({ settings }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () =>
    set({
      stats: initialStats,
      logs: [],
      isLoading: false,
    }),
}));
