/**
 * Seed 5 mock users — one per plan (free, starter, pro, team, enterprise).
 * Usage: pnpm --filter @fetcher/api seed:mock-users
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { connectMongo, disconnectMongo } from '../src/lib/mongo.js';
import { hashPassword } from '../src/lib/crypto.js';
import { User, Organization, Membership } from '../src/models/index.js';
import { applyPlanLimits, type PlanId } from '../src/config/plans.js';

const MOCK_PASSWORD = process.env['MOCK_USER_PASSWORD'] ?? 'MockFetcher2026!';

const MOCK_USERS: Array<{ plan: PlanId; email: string; name: string }> = [
  { plan: 'free', email: 'mock-free@productfetcher.online', name: 'Mock Free User' },
  { plan: 'starter', email: 'mock-starter@productfetcher.online', name: 'Mock Starter User' },
  { plan: 'pro', email: 'mock-pro@productfetcher.online', name: 'Mock Pro User' },
  { plan: 'team', email: 'mock-team@productfetcher.online', name: 'Mock Team User' },
  { plan: 'enterprise', email: 'mock-enterprise@productfetcher.online', name: 'Mock Enterprise User' },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || `org-${randomBytes(4).toString('hex')}`;
}

async function upsertMockUser(entry: (typeof MOCK_USERS)[number]) {
  const { plan, email, name } = entry;
  const limits = applyPlanLimits(plan);

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      passwordHash: hashPassword(MOCK_PASSWORD),
      name,
      emailVerified: true,
      emailVerifyToken: undefined,
    });
    console.log(`  + Created user: ${email}`);
  } else {
    user.name = name;
    user.emailVerified = true;
    user.emailVerifyToken = undefined;
    user.passwordHash = hashPassword(MOCK_PASSWORD);
    await user.save();
    console.log(`  ~ Updated user: ${email}`);
  }

  let membership = await Membership.findOne({ userId: user._id, role: 'owner' });
  let org = membership ? await Organization.findById(membership.organizationId) : null;

  if (!org) {
    const orgName = `${name}'s Workspace`;
    org = await Organization.create({
      name: orgName,
      slug: `${slugify(orgName)}-${user._id.toString().slice(-6)}`,
      ownerId: user._id,
      plan,
      ...limits,
      aiCallsUsed: 0,
    });
    await Membership.create({ userId: user._id, organizationId: org._id, role: 'owner' });
    console.log(`  + Created org: ${org.name} (${plan})`);
  } else {
    org.plan = plan;
    org.seats = limits.seats;
    org.aiCallsLimit = limits.aiCallsLimit;
    org.connectorLimit = limits.connectorLimit;
    org.deviceLimit = limits.deviceLimit;
    await org.save();
    console.log(`  ~ Updated org plan: ${plan}`);
  }

  return { email, plan, orgId: org._id.toString(), userId: user._id.toString() };
}

async function main() {
  console.log('Seeding mock users (5 plans)…');
  await connectMongo();

  const results = [];
  for (const entry of MOCK_USERS) {
    console.log(`\n[${entry.plan}]`);
    results.push(await upsertMockUser(entry));
  }

  await disconnectMongo();

  console.log('\n✓ Done. Mock accounts:\n');
  console.log('| Plan       | Email                              | Password          |');
  console.log('|------------|------------------------------------|-------------------|');
  for (const r of results) {
    console.log(`| ${r.plan.padEnd(10)} | ${r.email.padEnd(34)} | ${MOCK_PASSWORD.padEnd(17)} |`);
  }
  console.log('\nLogin at https://app.productfetcher.online/login');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
