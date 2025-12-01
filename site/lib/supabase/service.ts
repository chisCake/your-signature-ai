import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_SECRET;

/**
 * Создает сервисный клиент Supabase
 * **Имеет полный доступ к базе данных!**
 * @returns Клиент Supabase {@link SupabaseClient}
 */
export function createServiceClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "@supabase/supabase-js: Your project's URL and service role key are required to create a Supabase client!\n\n" +
        "Check your Supabase project's API settings to find these values\n" +
        'https://supabase.com/dashboard/project/_/settings/api'
    );
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
