"use client";

import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from './ui/button';
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    // Обновляем серверные компоненты после выхода
    router.push("/auth/login");
    router.refresh();
  };

  return <Button onClick={logout}>Logout</Button>;
}
