/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_SECRET;

/**
 * Создает сервисный клиент Supabase  
 * **Имеет полный доступ к базе данных!**
 * @returns Клиент Supabase {@link SupabaseClient}
 */
export function createServiceClient(): SupabaseClient {
  return createClient(
    supabaseUrl!,
    supabaseKey!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
