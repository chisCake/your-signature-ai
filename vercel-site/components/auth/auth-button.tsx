'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/auth/logout-button';
import { getProfile } from '@/lib/utils/user-utils';
import { useState, useEffect } from 'react';
import { Profile } from '@/lib/types';
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null);
      } else if (event === 'SIGNED_IN' && session) {
        await fetchProfile();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return profile ? (
    <div className='flex flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-4'>
      <span className='text-sm text-muted-foreground'>
        Привет, {profile.display_name ? profile.display_name : profile.email}!
      </span>
      <LogoutButton />
    </div>
  ) : (
    <div className='flex flex-col lg:flex-row gap-2 w-full lg:w-auto'>
      <Button
        asChild
        size='sm'
        variant={'outline'}
        className='w-full lg:w-auto'
      >
        <Link href='/auth/login'>Войти</Link>
      </Button>
      <Button
        asChild
        size='sm'
        variant={'default'}
        className='w-full lg:w-auto'
      >
        <Link href='/auth/sign-up'>Зарегистрироваться</Link>
      </Button>
    </div>
  );
}
