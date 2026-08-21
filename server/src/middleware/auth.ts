import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const MIN_JWT_SECRET_LENGTH = 32;

// Signing login tokens with a known default string would let anyone forge an
// auth cookie, so a missing/weak JWT_SECRET must be fatal, never a fallback.
export function assertJwtSecret(): void {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET is missing or shorter than ${MIN_JWT_SECRET_LENGTH} characters. Generate one with ` +
        `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" and set it in the environment.`
    );
  }
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set; refusing to sign/verify tokens with a default secret.");
  }
  return secret;
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, getSecret()) as AuthUser;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token =
    (req.cookies as any)?.token ||
    (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Cookie options: host-only (no Domain attribute), SameSite=lax, Secure in prod.
 * Moving to a new apex (bugaputa.com vs bugaputa.no-code.gdn) requires one
 * re-login because cookies are host-only and the two hosts are unrelated
 * origins (not parent/child). We intentionally do NOT set Domain to share
 * across them — that would weaken isolation and does not work for unrelated
 * domains anyway. Users hitting the legacy host will be redirected for
 * document requests, but API/widget remain compat; auth cookie stays per-host.
 */
export function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}
