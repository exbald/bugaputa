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

function getSecret(): string {
  return process.env.JWT_SECRET || "dev-secret-change-me";
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
