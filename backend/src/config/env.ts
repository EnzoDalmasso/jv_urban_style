import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DEMO_MODE: z.coerce.boolean().optional(),
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
