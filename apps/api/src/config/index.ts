import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export const config = {
  env: process.env['NODE_ENV'] ?? 'development',
  port: parseInt(process.env['PORT'] ?? '4000', 10),
  host: process.env['HOST'] ?? '0.0.0.0',
  isProd: process.env['NODE_ENV'] === 'production',

  mongoUri: process.env['MONGODB_URI'] ?? 'mongodb://127.0.0.1:27017/fetcherio',
  redisUrl: process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379',

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-in-production-32chars'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production-32chars'),
    accessExpires: process.env['JWT_ACCESS_EXPIRES'] ?? '15m',
    refreshExpires: process.env['JWT_REFRESH_EXPIRES'] ?? '7d',
  },

  stripe: {
    secretKey: process.env['STRIPE_SECRET_KEY'] ?? '',
    webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'] ?? '',
    prices: {
      starter: process.env['STRIPE_PRICE_STARTER_MONTHLY'] ?? '',
      pro: process.env['STRIPE_PRICE_PRO_MONTHLY'] ?? '',
      team: process.env['STRIPE_PRICE_TEAM_MONTHLY'] ?? '',
    },
  },

  ai: {
    anthropicKey: process.env['ANTHROPIC_API_KEY'] ?? '',
    openaiKey: process.env['OPENAI_API_KEY'] ?? '',
    groqKey: process.env['GROQ_API_KEY'] ?? '',
  },

  email: {
    resendKey: process.env['RESEND_API_KEY'] ?? '',
    from: process.env['EMAIL_FROM'] ?? 'noreply@fetcherio.dev',
  },

  corsOrigins: (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  webUrl: process.env['WEB_URL'] ?? 'http://localhost:3000',
  marketingUrl: process.env['MARKETING_URL'] ?? 'http://localhost:3000',
};
