import { getUserRole, hasRole } from '@/lib/utils/auth-utils';
import { UserRole } from '@/lib/types';

describe('auth-utils', () => {
  describe('getUserRole', () => {
    it('should return role from user_metadata', () => {
      const user = {
        user_metadata: {
          role: 'admin' as UserRole,
        },
      };

      const role = getUserRole(user);

      expect(role).toBe('admin');
    });

    it('should return role for mod user', () => {
      const user = {
        user_metadata: {
          role: 'mod' as UserRole,
        },
      };

      const role = getUserRole(user);

      expect(role).toBe('mod');
    });

    it('should return role for regular user', () => {
      const user = {
        user_metadata: {
          role: 'user' as UserRole,
        },
      };

      const role = getUserRole(user);

      expect(role).toBe('user');
    });

    it('should return null for null user', () => {
      const role = getUserRole(null);
      expect(role).toBeNull();
    });

    it('should return null for undefined user', () => {
      const role = getUserRole(undefined);
      expect(role).toBeNull();
    });

    it('should return null for user without user_metadata', () => {
      const user = {};
      const role = getUserRole(user);
      expect(role).toBeNull();
    });

    it('should return null for user with empty user_metadata', () => {
      const user = {
        user_metadata: {},
      };
      const role = getUserRole(user);
      expect(role).toBeNull();
    });
  });

  describe('hasRole', () => {
    it('should return true when user has exact required role', () => {
      const user = {
        user_metadata: {
          role: 'admin' as UserRole,
        },
      };

      expect(hasRole(user, 'admin')).toBe(true);
    });

    it('should return true when user has higher role than required', () => {
      const adminUser = {
        user_metadata: {
          role: 'admin' as UserRole,
        },
      };
      const modUser = {
        user_metadata: {
          role: 'mod' as UserRole,
        },
      };

      expect(hasRole(adminUser, 'mod')).toBe(true);
      expect(hasRole(adminUser, 'user')).toBe(true);
      expect(hasRole(modUser, 'user')).toBe(true);
    });

    it('should return false when user has lower role than required', () => {
      const userUser = {
        user_metadata: {
          role: 'user' as UserRole,
        },
      };
      const modUser = {
        user_metadata: {
          role: 'mod' as UserRole,
        },
      };

      expect(hasRole(userUser, 'mod')).toBe(false);
      expect(hasRole(userUser, 'admin')).toBe(false);
      expect(hasRole(modUser, 'admin')).toBe(false);
    });

    it('should return false for null user', () => {
      expect(hasRole(null, 'user')).toBe(false);
      expect(hasRole(null, 'mod')).toBe(false);
      expect(hasRole(null, 'admin')).toBe(false);
    });

    it('should return false for undefined user', () => {
      expect(hasRole(undefined, 'user')).toBe(false);
      expect(hasRole(undefined, 'mod')).toBe(false);
      expect(hasRole(undefined, 'admin')).toBe(false);
    });

    it('should return false for user without role', () => {
      const user = {
        user_metadata: {},
      };

      expect(hasRole(user, 'user')).toBe(false);
      expect(hasRole(user, 'mod')).toBe(false);
      expect(hasRole(user, 'admin')).toBe(false);
    });

    it('should correctly handle role hierarchy: user < mod < admin', () => {
      const userUser = {
        user_metadata: {
          role: 'user' as UserRole,
        },
      };
      const modUser = {
        user_metadata: {
          role: 'mod' as UserRole,
        },
      };
      const adminUser = {
        user_metadata: {
          role: 'admin' as UserRole,
        },
      };

      // User role checks
      expect(hasRole(userUser, 'user')).toBe(true);
      expect(hasRole(modUser, 'user')).toBe(true);
      expect(hasRole(adminUser, 'user')).toBe(true);

      // Mod role checks
      expect(hasRole(userUser, 'mod')).toBe(false);
      expect(hasRole(modUser, 'mod')).toBe(true);
      expect(hasRole(adminUser, 'mod')).toBe(true);

      // Admin role checks
      expect(hasRole(userUser, 'admin')).toBe(false);
      expect(hasRole(modUser, 'admin')).toBe(false);
      expect(hasRole(adminUser, 'admin')).toBe(true);
    });
  });
});
