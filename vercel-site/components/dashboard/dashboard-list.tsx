'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/hooks/use-user';

export function DashboardList() {
  const { user, isMod, isAdmin } = useUser();

  return (
    user && (
      <div className='flex flex-col lg:flex-row gap-2 items-start lg:items-center'>
        {!isMod && (
          <Button
            asChild
            size='sm'
            variant={'outline'}
            className='w-full lg:w-auto'
          >
            <Link href='/dashboard'>Dashboard</Link>
          </Button>
        )}

        {isMod && (
          <>
            <span className='text-sm font-medium text-muted-foreground lg:hidden'>
              Dashboards:
            </span>
            <div className='flex flex-col lg:flex-row gap-2 w-full lg:w-auto'>
              <Button
                asChild
                size='sm'
                variant={'outline'}
                className='w-full lg:w-auto'
              >
                <Link href='/dashboard'>User</Link>
              </Button>
              <Button
                asChild
                size='sm'
                variant={'outline'}
                className='w-full lg:w-auto'
              >
                <Link href='/dashboard-mod'>Mod</Link>
              </Button>
              {isAdmin && (
                <Button
                  asChild
                  size='sm'
                  variant={'outline'}
                  className='w-full lg:w-auto'
                >
                  <Link href='/dashboard-admin'>Admin</Link>
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    )
  );
}
