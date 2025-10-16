'use client';

import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { invalidateProfileCache } from '@/lib/utils/user-utils';

export function LogoutButton() {
  const logout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    invalidateProfileCache();
    window.location.href="/auth/login";
  };

  return <Button onClick={logout}>Logout</Button>;
}
