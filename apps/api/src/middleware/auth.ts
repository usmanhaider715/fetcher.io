import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/crypto.js';
import { User, Membership } from '../models/index.js';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  organizationId?: string;
  orgRole?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.['accessToken'];

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      organizationId: payload['orgId'] as string | undefined,
      orgRole: payload['orgRole'] as string | undefined,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role) && !roles.includes(req.user.orgRole ?? '')) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export async function requireOrgMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user?.organizationId) {
    res.status(400).json({ error: 'Organization context required' });
    return;
  }

  const membership = await Membership.findOne({
    userId: req.user.id,
    organizationId: req.user.organizationId,
  });

  if (!membership) {
    res.status(403).json({ error: 'Not a member of this organization' });
    return;
  }

  req.user.orgRole = membership.role;
  next();
}
