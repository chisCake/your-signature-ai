"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { LogoutButton } from "./logout-button";
import { getProfile } from '@/lib/supabase/user-utils';
import { useState, useEffect } from "react";
import { Profile } from "@/lib/types";
import { createBrowserClient } from '@/lib/supabase/client';

export function AuthButton() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    
    const fetchProfile = async () => {
      getProfile().then(setProfile);
    };
    
    // Загружаем профиль при монтировании
    fetchProfile();

    // Слушаем изменения аутентификации
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setProfile(null);
        } else if (event === 'SIGNED_IN' && session) {
          await fetchProfile();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return profile ? (
    <div className="flex items-center gap-4">
      Привет, {profile.display_name ? profile.display_name : profile.email}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">Войти</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">Зарегистрироваться</Link>
      </Button>
    </div>
  );
}
