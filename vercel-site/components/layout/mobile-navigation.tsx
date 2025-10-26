'use client';

import { MobileMenuToggle } from '@/components/layout/mobile-menu-toggle';
import { MobileNavigationContent } from '@/components/layout/mobile-navigation-content';
import { useUser } from '@/lib/hooks/use-user';

export function MobileNavigation() {
  const { user, loading } = useUser();

  return (
    <MobileMenuToggle>
      <MobileNavigationContent user={user} loading={loading} />
    </MobileMenuToggle>
  );
}
