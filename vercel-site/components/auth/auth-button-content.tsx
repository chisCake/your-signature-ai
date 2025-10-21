'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/auth/logout-button';
import { useUser } from '@/lib/hooks/use-user';
import { useEffect, useState } from 'react';
import { getProfile } from '@/lib/supabase/queries';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

export function AuthButtonContent() {
  const { user, loading } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        try {
          const supabase = createBrowserClient();
          const userProfile = await getProfile(user.id, supabase);
          if (userProfile) {
            userProfile.email = user.email || null;
            setProfile(userProfile);
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [user]);

  if (loading) {
    return (
      <div className='flex flex-col lg:flex-row gap-2 w-full lg:w-auto'>
        <Button
          size='sm'
          variant={'outline'}
          className='w-full lg:w-auto'
          disabled
        >
          Загрузка...
        </Button>
      </div>
    );
  }

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
