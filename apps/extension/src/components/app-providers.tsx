import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
    },
  },
});

interface AppProvidersProps {
  children: React.ReactNode;
  theme?: 'dark' | 'light' | 'system';
}

export function AppProviders({ children, theme = 'system' }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}
