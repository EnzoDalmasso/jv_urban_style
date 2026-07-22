import 'dotenv/config';
import { z } from 'zod';

const booleanEnv = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }

  return value;
}, z.boolean().optional());

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DEMO_MODE: booleanEnv,
  ADMIN_PIN: z.string().min(4).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  BUSINESS_TIMEZONE: z.string().default('America/Argentina/Buenos_Aires'),
  SLOT_INTERVAL_MINUTES: z.coerce.number().int().positive().default(15)
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  DEMO_MODE: parsedEnv.DEMO_MODE
    ?? (!parsedEnv.SUPABASE_URL || !parsedEnv.SUPABASE_SERVICE_ROLE_KEY)
};
