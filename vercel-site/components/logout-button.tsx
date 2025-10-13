'use client';

import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { invalidateProfileCache } from '@/lib/supabase/user-utils';

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    invalidateProfileCache();
    router.push('/auth/login');
  };

  return <Button onClick={logout}>Logout</Button>;
}
