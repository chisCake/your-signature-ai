import { createServerClient as createServerClientSSR } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 * @returns Клиент Supabase {@link SupabaseClient}
 */
export async function createServerClient(): Promise<SupabaseClient> {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "@supabase/ssr: Your project's URL and API key are required to create a Supabase client!\n\n" +
        "Check your Supabase project's API settings to find these values\n" +
        'https://supabase.com/dashboard/project/_/settings/api'
    );
  }
  const cookieStore = await cookies();

  return createServerClientSSR(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
