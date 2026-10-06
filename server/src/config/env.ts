import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  RESQ_ADMIN_EMAIL: z.string().email(),
  RESQ_ADMIN_PASSWORD: z.string().min(12),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_TENANT_ID: z.string().min(1).optional(),
  MICROSOFT_AUTHORITY: z.string().url().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_MAPS_SERVER_API_KEY: z.string().trim().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const messages = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration: ${messages.join('; ')}`);
}

export const env = parsed.data;
