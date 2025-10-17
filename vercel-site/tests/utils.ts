const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function getAuthTokenName() {
    return `sb-${supabaseUrl?.replace('https://', '').replace('.supabase.co', '')}-auth-token`;
}