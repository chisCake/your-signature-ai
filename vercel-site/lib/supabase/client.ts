/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createBrowserClient as createBrowserClientSSR } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

/**
 * Создает клиент Supabase для работы в браузере  
 * @returns Клиент Supabase {@link SupabaseClient}
 */
export function createBrowserClient(): SupabaseClient {
  return createBrowserClientSSR(
    supabaseUrl!,
    supabaseKey!
  );
}
