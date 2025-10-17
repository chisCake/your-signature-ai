'use client';

import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { invalidateProfileCache } from '@/lib/utils/auth-client-utils';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  
  const logout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    invalidateProfileCache();
    router.push('/auth/login');
    router.refresh();
  };

  return <Button onClick={logout}>Logout</Button>;
}
