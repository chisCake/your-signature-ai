import { createBrowserClient as createBrowserClientSSR } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

/**
 * Создает клиент Supabase для работы в браузере
 * @returns Клиент Supabase {@link SupabaseClient}
 */
export function createBrowserClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "@supabase/ssr: Your project's URL and API key are required to create a Supabase client!\n\n" +
        "Check your Supabase project's API settings to find these values\n" +
        'https://supabase.com/dashboard/project/_/settings/api'
    );
  }
  return createBrowserClientSSR(supabaseUrl, supabaseKey);
}
