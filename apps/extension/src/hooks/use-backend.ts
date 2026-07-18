import { useEffect, useState } from 'react';
import { sendMessage } from '@/lib/messaging';

/** Ready when signed in (cloud saves) or local backend is up. */
export function useBackendReady() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [cloud, setCloud] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = (await sendMessage({ type: 'GET_BACKEND_STATUS' })) as {
          connected?: boolean;
          cloud?: boolean;
        };
        if (!cancelled) {
          setReady(Boolean(status.connected));
          setCloud(Boolean(status.cloud));
        }
      } catch {
        if (!cancelled) setReady(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, checking, cloud };
}
