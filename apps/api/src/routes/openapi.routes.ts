import { Router } from 'express';

export const openapiRouter = Router();

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Fetcher.io API',
    version: '1.0.0',
    description: 'Cloud API for auth, billing, AI proxy, connectors, and job metadata.',
  },
  servers: [{ url: 'https://api.fetcherio.dev/v1' }, { url: 'http://localhost:4000/v1' }],
  paths: {
    '/auth/register': { post: { summary: 'Register user' } },
    '/auth/login': { post: { summary: 'Login' } },
    '/auth/me': { get: { summary: 'Current user' } },
    '/projects': { get: { summary: 'List projects' }, post: { summary: 'Create project' } },
    '/jobs': { get: { summary: 'Job history' }, post: { summary: 'Log job metadata' } },
    '/ai/generate': { post: { summary: 'AI generation (metered)' } },
    '/billing/usage': { get: { summary: 'Plan usage' } },
    '/connectors/upload-token': { post: { summary: 'Scoped store upload token' } },
    '/api-keys': { get: { summary: 'List API keys' }, post: { summary: 'Create API key' } },
  },
};

openapiRouter.get('/openapi.json', (_req, res) => {
  res.json(spec);
});
