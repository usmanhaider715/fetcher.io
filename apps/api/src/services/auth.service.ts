import { randomBytes } from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../lib/crypto.js';
import { User, Organization, Membership, RefreshToken } from '../models/index.js';
import { applyPlanLimits } from '../config/plans.js';
import { emailService } from './email.service.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || `org-${randomBytes(4).toString('hex')}`;
}

export class AuthService {
  async register(email: string, password: string, name?: string) {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) throw Object.assign(new Error('Email already registered'), { status: 400 });

    const verifyToken = randomBytes(32).toString('hex');
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      name: name ?? null,
      emailVerifyToken: verifyToken,
    });

    const orgName = name ? `${name}'s Workspace` : 'My Workspace';
    const org = await Organization.create({
      name: orgName,
      slug: `${slugify(orgName)}-${user._id.toString().slice(-6)}`,
      ownerId: user._id,
      plan: 'free',
      ...applyPlanLimits('free'),
    });

    await Membership.create({ userId: user._id, organizationId: org._id, role: 'owner' });

    const tokens = await this.issueTokens(user._id.toString(), user.email, user.role, org._id.toString(), 'owner');

    void emailService.sendVerification(user.email, verifyToken);

    return {
      user: { id: user._id.toString(), email: user.email, name: user.name, emailVerified: false },
      organization: { id: org._id.toString(), name: org.name, slug: org.slug, plan: org.plan },
      ...tokens,
      emailVerifyToken: verifyToken,
    };
  }

  async login(email: string, password: string, deviceFingerprint?: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw Object.assign(new Error('Invalid email or password'), { status: 401 });
    }

    const membership = await Membership.findOne({ userId: user._id }).sort({ createdAt: 1 });
    const org = membership ? await Organization.findById(membership.organizationId) : null;

    const tokens = await this.issueTokens(
      user._id.toString(),
      user.email,
      user.role,
      org?._id.toString(),
      membership?.role,
      deviceFingerprint,
    );

    return {
      user: { id: user._id.toString(), email: user.email, name: user.name, emailVerified: user.emailVerified },
      organization: org
        ? { id: org._id.toString(), name: org.name, slug: org.slug, plan: org.plan }
        : null,
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const stored = await RefreshToken.findOne({ tokenHash, revokedAt: null });
    if (!stored || stored.expiresAt < new Date()) {
      throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
    }

    const user = await User.findById(payload.sub);
    if (!user) throw Object.assign(new Error('User not found'), { status: 401 });

    stored.revokedAt = new Date();
    await stored.save();

    const membership = await Membership.findOne({ userId: user._id }).sort({ createdAt: 1 });
    const org = membership ? await Organization.findById(membership.organizationId) : null;

    return this.issueTokens(
      user._id.toString(),
      user.email,
      user.role,
      org?._id.toString(),
      membership?.role,
      stored.deviceFingerprint ?? undefined,
    );
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await RefreshToken.updateOne({ tokenHash }, { revokedAt: new Date() });
  }

  async verifyEmail(token: string) {
    const user = await User.findOne({ emailVerifyToken: token });
    if (!user) throw Object.assign(new Error('Invalid verification token'), { status: 400 });
    user.emailVerified = true;
    user.emailVerifyToken = undefined;
    await user.save();
    return { verified: true };
  }

  async forgotPassword(email: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return { sent: true };
    const token = randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    await emailService.sendPasswordReset(user.email, token);
    return { sent: true };
  }

  async resetPassword(token: string, password: string) {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpires: { $gt: new Date() },
    });
    if (!user) throw Object.assign(new Error('Invalid or expired reset token'), { status: 400 });
    user.passwordHash = hashPassword(password);
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();
    await RefreshToken.updateMany({ userId: user._id }, { revokedAt: new Date() });
    return { reset: true };
  }

  async listDevices(userId: string) {
    const tokens = await RefreshToken.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ expiresAt: -1 })
      .limit(20);
    return tokens.map((t) => ({
      id: t._id.toString(),
      fingerprint: t.deviceFingerprint,
      expiresAt: t.expiresAt,
    }));
  }

  async revokeDevice(userId: string, tokenId: string) {
    await RefreshToken.updateOne({ _id: tokenId, userId }, { revokedAt: new Date() });
    return { revoked: true };
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
    orgId?: string,
    orgRole?: string,
    deviceFingerprint?: string,
  ) {
    const accessToken = signAccessToken({ sub: userId, email, role, orgId, orgRole });
    const refreshToken = signRefreshToken({ sub: userId });
    const tokenHash = hashToken(refreshToken);

    await RefreshToken.create({
      userId,
      tokenHash,
      deviceFingerprint: deviceFingerprint ?? null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
