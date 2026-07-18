import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String },
    emailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String },
    resetToken: { type: String },
    resetTokenExpires: { type: Date },
    role: { type: String, enum: ['user', 'admin', 'staff'], default: 'user' },
    stripeCustomerId: { type: String },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = model('User', userSchema);

const orgSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: String, enum: ['free', 'starter', 'pro', 'team', 'enterprise'], default: 'free' },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    stripePriceId: { type: String },
    planExpiresAt: { type: Date },
    seats: { type: Number, default: 1 },
    aiCallsUsed: { type: Number, default: 0 },
    aiCallsLimit: { type: Number, default: 10 },
    connectorLimit: { type: Number, default: 0 },
    deviceLimit: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export type OrganizationDoc = InferSchemaType<typeof orgSchema> & { _id: Types.ObjectId };
export const Organization = model('Organization', orgSchema);

const membershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
  },
  { timestamps: true },
);
membershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export const Membership = model('Membership', membershipSchema);

const refreshTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true },
  deviceFingerprint: { type: String },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
});
refreshTokenSchema.index({ tokenHash: 1 });

export const RefreshToken = model('RefreshToken', refreshTokenSchema);

const projectSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true },
    description: { type: String },
    tags: [{ type: String }],
  },
  { timestamps: true },
);

export const Project = model('Project', projectSchema);

const scrapeJobSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mode: { type: String, required: true },
    status: { type: String, enum: ['running', 'completed', 'failed', 'interrupted'], default: 'running' },
    websiteUrl: { type: String },
    platform: { type: String },
    categoryName: { type: String },
    subcategoryName: { type: String },
    sortFilter: { type: String },
    maxProducts: { type: Number },
    productsFound: { type: Number, default: 0 },
    productsSaved: { type: Number, default: 0 },
    imagesDownloaded: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    errorMessages: { type: [String], default: [] },
    durationMs: { type: Number },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const ScrapeJob = model('ScrapeJob', scrapeJobSchema);

const scrapeProductSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'ScrapeJob', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String },
    price: { type: Number },
    currency: { type: String },
    productUrl: { type: String },
    imageUrls: { type: [String], default: [] },
    imageCount: { type: Number, default: 0 },
    category: { type: String },
    subcategory: { type: String },
    sku: { type: String },
    platform: { type: String },
    scrapedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
scrapeProductSchema.index({ jobId: 1, productUrl: 1 });

export type ScrapeProductDoc = InferSchemaType<typeof scrapeProductSchema> & { _id: Types.ObjectId };
export const ScrapeProduct = model('ScrapeProduct', scrapeProductSchema);

const apiKeySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    prefix: { type: String, required: true },
    keyHash: { type: String, required: true },
    scopes: [{ type: String, enum: ['read', 'publish', 'admin'] }],
    lastUsedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

export const ApiKey = model('ApiKey', apiKeySchema);

const aiUsageSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    task: { type: String, required: true },
    provider: { type: String, required: true },
    promptVersion: { type: String, default: 'v1' },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    confidence: { type: Number },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const AiUsageLog = model('AiUsageLog', aiUsageSchema);

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    targetType: { type: String },
    targetId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: true },
);

export const AuditLog = model('AuditLog', auditLogSchema);
