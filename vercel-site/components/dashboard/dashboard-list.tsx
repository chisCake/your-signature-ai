import Link from 'next/link';
import { getUser, isMod, isAdmin } from '@/lib/utils/auth-server-utils';
import { Button } from '@/components/ui/button';

export async function DashboardList() {
  const user = await getUser();
  const modFlag = await isMod(user);
  const adminFlag = await isAdmin(user);

  return (
    user && (
      <div className='flex flex-col lg:flex-row gap-2 items-start lg:items-center'>
        {!modFlag && (
          <Button
            asChild
            size='sm'
            variant={'outline'}
            className='w-full lg:w-auto'
          >
            <Link href='/dashboard'>Dashboard</Link>
          </Button>
        )}

        {modFlag && (
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
              {adminFlag && (
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
