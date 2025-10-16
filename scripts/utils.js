import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' })

export function createSupabaseClient() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY);
}