'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, Link2, Puzzle } from 'lucide-react';
import { api, getAccessToken, restoreSession } from '@/lib/api';

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID ?? '';

type LinkStatus = 'idle' | 'linking' | 'linked' | 'no-extension' | 'error';

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (
          extensionId: string,
          message: unknown,
          callback: (response: unknown) => void,
        ) => void;
        lastError?: { message?: string };
      };
    };
  }
}

export default function ExtensionConnectPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LinkStatus>('idle');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState('');
  const [plan, setPlan] = useState('');
  const [copied, setCopied] = useState(false);
  const token = getAccessToken();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      await restoreSession();
      if (cancelled) return;

      const currentToken = getAccessToken();
      if (!currentToken) {
        router.replace('/login?next=/dashboard/extension');
        return;
      }

      api
        .me()
        .then((res) => {
          if (cancelled) return;
          setUserId(res.user.id);
          setPlan(res.organization?.plan ?? 'free');
          setStatus('linking');
          setMessage(
            'Signed in. If the Fetcher.io extension is installed, it should link automatically within a few seconds. Keep this tab open.',
          );
        })
        .catch(() => {
          if (!cancelled) router.replace('/login?next=/dashboard/extension');
        });
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const linkExtension = useCallback(() => {
    if (!token) return;

    if (!EXTENSION_ID) {
      setStatus('error');
      setMessage('Extension ID not configured. Copy the token below and paste it in extension Settings → Account.');
      return;
    }

    if (!window.chrome?.runtime?.sendMessage) {
      setStatus('no-extension');
      setMessage('Chrome extension not detected. Install Fetcher.io from the Chrome Web Store, then return here.');
      return;
    }

    setStatus('linking');
    window.chrome.runtime.sendMessage(
      EXTENSION_ID,
      { type: 'SET_ACCESS_TOKEN', payload: { accessToken: token } },
      (response) => {
        const err = window.chrome?.runtime?.lastError?.message;
        if (err) {
          setStatus('error');
          setMessage(err);
          return;
        }
        const res = response as { signedIn?: boolean; email?: string; error?: string };
        if (res?.error) {
          setStatus('error');
          setMessage(res.error);
          return;
        }
        if (res?.signedIn) {
          setStatus('linked');
          setMessage(`Extension linked as ${res.email}`);
          return;
        }
        setStatus('linked');
        setMessage('Extension linked successfully.');
      },
    );
  }, [token]);

  useEffect(() => {
    if (token && EXTENSION_ID) {
      const t = setTimeout(linkExtension, 500);
      return () => clearTimeout(t);
    }
  }, [token, linkExtension]);

  const copyToken = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Link Chrome Extension</h1>
      <p className="mt-2 text-muted-foreground">
        Connect your signed-in account to the Fetcher.io extension. Only linked users can start scraping.
      </p>

      <div className="mt-8 space-y-6">
        <div className="glass-card gradient-border p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Puzzle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Your account</h2>
              {userId && (
                <p className="mt-1 text-sm text-muted-foreground">
                  User ID: <code className="font-mono text-xs">{userId}</code> · Plan:{' '}
                  <span className="capitalize font-medium text-primary">{plan}</span>
                </p>
              )}
              <button type="button" onClick={linkExtension} className="btn-primary mt-4">
                <Link2 className="h-4 w-4" />
                {status === 'linking' ? 'Linking…' : 'Link extension now'}
              </button>
              {message && (
                <p
                  className={`mt-3 text-sm ${
                    status === 'linked' ? 'text-green-600' : status === 'error' ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {status === 'linked' && <Check className="mr-1 inline h-4 w-4" />}
                  {message}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="font-semibold">Manual link (fallback)</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Open extension <strong>Settings → Account</strong> and paste this access token if auto-link fails.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              readOnly
              value={token ? `${token.slice(0, 24)}…` : ''}
              className="input-premium flex-1 font-mono text-xs"
            />
            <button type="button" onClick={copyToken} className="btn-primary shrink-0">
              <Copy className="h-4 w-4" />
              {copied ? 'Copied' : 'Copy token'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 p-6 text-sm text-muted-foreground">
          <h3 className="font-semibold text-foreground">What Cloud Sync / Account does</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Verifies you have an active Fetcher.io plan before scraping starts</li>
            <li>Enforces AI usage limits through the cloud API</li>
            <li>Syncs job history to your dashboard</li>
            <li>Issues secure upload tokens for store connectors (Shopify / WooCommerce)</li>
          </ul>
          <p className="mt-4">
            Store credentials (Shopify token, WooCommerce keys) stay in the extension and push products from your machine via the local backend — the cloud never stores your full product catalog.
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Don&apos;t have the extension?{' '}
          <Link href="/docs/chrome-web-store" className="font-semibold text-primary no-underline">
            Install from Chrome Web Store
          </Link>{' '}
          or load the unpacked build from{' '}
          <code className="text-xs">apps/extension/dist</code> in developer mode.
        </p>
      </div>
    </div>
  );
}
