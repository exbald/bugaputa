import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(100),
  allowedOrigins: z.array(z.string()).optional(),
});

export const reportPublicSchema = z.object({
  projectKey: z.string().min(1),
  message: z.string().min(10).max(2000),
  contactEmail: z.string().email().optional().or(z.literal("")),
  pageUrl: z.string().url(),
  userAgent: z.string().max(500).optional().default(""),
  viewport: z.string().max(100).optional().default(""),
  language: z.string().max(20).optional().default(""),
  website: z.string().optional(), // honeypot
});

export const reportStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "archived"]),
});

export const paginationSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "archived"]).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
