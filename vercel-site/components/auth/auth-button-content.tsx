import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/auth/logout-button';
import { getUserProfile } from '@/lib/utils/auth-server-utils';

export async function AuthButtonContent() {
  const profile = await getUserProfile();

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
