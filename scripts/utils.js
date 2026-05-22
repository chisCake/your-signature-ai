import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js';

const currentDir = process.cwd().split('\\').pop();

if (currentDir === 'your-signature-ai') {
    dotenv.config({ path: 'site/.env.local' });
} else if (currentDir === 'site') {
    dotenv.config({ path: '.env.local' });
} else {
    console.error('Current directory is not supported: ' + currentDir);
    process.exit(1);
}

export function createSupabaseClient() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY);
}