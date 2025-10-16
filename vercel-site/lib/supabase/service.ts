/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_SECRET;

export function createServiceClient() {
  return createClient(
    supabaseUrl!,
    supabaseKey!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
