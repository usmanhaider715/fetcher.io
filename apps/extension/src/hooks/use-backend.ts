import { useEffect, useState } from 'react';
import { backendApi } from '@/lib/backend-api';

export function useBackendReady() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await backendApi.init();
      const ok = await backendApi.healthCheck();
      if (!cancelled) {
        setReady(ok);
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, checking };
}
