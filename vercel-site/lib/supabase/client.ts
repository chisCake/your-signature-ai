/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createBrowserClient as createBrowserClientSSR } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export function createBrowserClient() {
  return createBrowserClientSSR(
    supabaseUrl!,
    supabaseKey!
  );
}
