import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export const supabase = env.DEMO_MODE
  ? null
  : createClient(env.SUPABASE_URL as string, env.SUPABASE_SERVICE_ROLE_KEY as string, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
