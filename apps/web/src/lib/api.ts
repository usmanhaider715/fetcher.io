import { API_URL } from './utils';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean;
}

export interface AuthTokens {
  accessToken: string;
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) sessionStorage.setItem('fetcher_access', token);
    else sessionStorage.removeItem('fetcher_access');
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = sessionStorage.getItem('fetcher_access');
  }
  return accessToken;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? body.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  register: (email: string, password: string, name?: string) =>
    apiFetch<{ accessToken: string; user: AuthUser }>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    apiFetch<{ accessToken: string; user: AuthUser; organization?: { id: string; plan: string } }>(
      '/v1/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),

  refresh: () =>
    apiFetch<{ accessToken: string }>('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  logout: () => apiFetch<{ success: boolean }>('/v1/auth/logout', { method: 'POST', body: '{}' }),

  me: () => apiFetch<{ user: AuthUser }>('/v1/auth/me'),

  projects: () => apiFetch<{ projects: Array<{ _id: string; name: string; description?: string }> }>('/v1/projects'),

  createProject: (name: string, description?: string) =>
    apiFetch<{ project: { _id: string; name: string } }>('/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  jobs: () =>
    apiFetch<{ jobs: Array<{ _id: string; mode: string; status: string; productsSaved: number; createdAt: string }> }>(
      '/v1/jobs',
    ),

  usage: () =>
    apiFetch<{ plan: string; aiCallsUsed: number; aiCallsLimit: number }>('/v1/billing/usage'),

  checkout: (plan: string) =>
    apiFetch<{ url: string }>('/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),

  apiKeys: () =>
    apiFetch<{ keys: Array<{ _id: string; name: string; prefix: string; scopes: string[] }> }>('/v1/api-keys'),

  createApiKey: (name: string, scopes: string[]) =>
    apiFetch<{ key: string; apiKey: { id: string; _id?: string; prefix: string } }>('/v1/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, scopes }),
    }),
};
