import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const attempt = scryptSync(password, salt, 64).toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
  } catch {
    return false;
  }
}

export function signAccessToken(payload: object): string {
  return jwt.sign(payload, config.jwt.accessSecret, { expiresIn: config.jwt.accessExpires as jwt.SignOptions['expiresIn'] });
}

export function signRefreshToken(payload: object): string {
  return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpires as jwt.SignOptions['expiresIn'] });
}

export function verifyAccessToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, config.jwt.accessSecret) as jwt.JwtPayload;
}

export function verifyRefreshToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as jwt.JwtPayload;
}

export function hashToken(token: string): string {
  return scryptSync(token, 'refresh-salt', 32).toString('hex');
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const raw = randomBytes(32).toString('hex');
  const key = `fk_${raw}`;
  const prefix = key.slice(0, 12);
  const hash = scryptSync(key, 'api-key-salt', 32).toString('hex');
  return { key, prefix, hash };
}

export function verifyApiKey(key: string, hash: string): boolean {
  const attempt = scryptSync(key, 'api-key-salt', 32).toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
  } catch {
    return false;
  }
}
