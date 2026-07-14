import { Router } from 'express';
import { User, Organization, Membership, AuditLog } from '../models/index.js';
import { asyncHandler } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin', 'staff'));

adminRouter.get(
  '/users/lookup',
  asyncHandler(async (req, res) => {
    const email = req.query['email'] as string | undefined;
    if (!email) {
      res.status(400).json({ error: 'email query required' });
      return;
    }
    const user = await User.findOne({ email: email.toLowerCase() }).select('-passwordHash');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const memberships = await Membership.find({ userId: user._id });
    const orgIds = memberships.map((m) => m.organizationId);
    const orgs = await Organization.find({ _id: { $in: orgIds } });
    res.json({ user, organizations: orgs });
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const email = req.query['email'] as string | undefined;
    const filter = email ? { email: new RegExp(email, 'i') } : {};
    const users = await User.find(filter).limit(50).select('-passwordHash');
    res.json({ users });
  }),
);

adminRouter.get(
  '/organizations',
  asyncHandler(async (req, res) => {
    const orgs = await Organization.find().limit(50);
    res.json({ organizations: orgs });
  }),
);

adminRouter.patch(
  '/organizations/:id/plan',
  asyncHandler(async (req, res) => {
    const { plan } = req.body as { plan?: string };
    const org = await Organization.findByIdAndUpdate(req.params['id'], { plan }, { new: true });
    await AuditLog.create({
      actorId: req.user!.id,
      action: 'plan_override',
      targetType: 'organization',
      targetId: req.params['id'],
      metadata: { plan },
      ip: req.ip,
    });
    res.json({ success: true, organization: org });
  }),
);

adminRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    res.json({ status: 'ok', queues: 'connected', timestamp: new Date().toISOString() });
  }),
);
