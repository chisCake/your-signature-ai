import { MobileMenuToggle } from '@/components/layout/mobile-menu-toggle';
import { MobileNavigationContent } from '@/components/layout/mobile-navigation-content';

export function MobileNavigation() {
  return (
    <MobileMenuToggle>
      <MobileNavigationContent />
    </MobileMenuToggle>
  );
}
