import { UserRole } from '@/lib/types';

export function getUserRole(user: unknown): UserRole | null {
  if (!user) return null;
  return (user as { user_metadata: { role: UserRole } }).user_metadata
    .role as UserRole;
}

export function hasRole(user: unknown, requiredRole: UserRole) {
  const userRole = getUserRole(user);
  if (!userRole) return false;

  const roleHierarchy: Record<UserRole, number> = {
    user: 1,
    mod: 2,
    admin: 3,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
