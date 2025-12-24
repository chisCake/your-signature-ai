import {
  canDeleteSignature,
  canEditSignature,
} from '@/lib/signature-management-policies';
import {
  createTestProfile,
  createTestPseudouser,
  createTestSignature,
} from '@/lib/__tests__/test-helpers';
import { Profile, User } from '@/lib/types';
import { createServerClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/utils/auth-server-utils';
import { getSignatureOwner } from '@/lib/utils/client-utils';

// Моки для зависимостей
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/utils/auth-server-utils');
jest.mock('@/lib/utils/client-utils');

const mockCreateServerClient = createServerClient as jest.MockedFunction<
  typeof createServerClient
>;
const mockGetUserProfile = getUserProfile as jest.MockedFunction<
  typeof getUserProfile
>;
const mockGetSignatureOwner = getSignatureOwner as jest.MockedFunction<
  typeof getSignatureOwner
>;

describe('signature-management-policies', () => {
  let mockClient: unknown;

  beforeEach(() => {
    mockClient = {};
    mockCreateServerClient.mockResolvedValue(mockClient as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canEditSignature', () => {
    it('should return false for user role', async () => {
      const user = createTestProfile('user-123', 'user', 'Test User');
      const signature = createTestSignature('genuine', {
        userId: 'user-123',
      });
      const owner = {
        type: 'user' as const,
        data: user,
      };

      mockGetUserProfile.mockResolvedValue(user);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canEditSignature(signature);

      expect(result).toBe(false);
    });

    it('should return true for mod when owner is pseudouser', async () => {
      const mod = createTestProfile('mod-123', 'mod', 'Mod User');
      const pseudouser = createTestPseudouser('pseudo-123', 'Test Pseudouser');
      const signature = createTestSignature('genuine', {
        pseudouserId: 'pseudo-123',
      });
      const owner = {
        type: 'pseudouser' as const,
        data: pseudouser,
      };

      mockGetUserProfile.mockResolvedValue(mod);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canEditSignature(signature);

      expect(result).toBe(true);
    });

    it('should return true for mod when owner is regular user', async () => {
      const mod = createTestProfile('mod-123', 'mod', 'Mod User');
      const user = createTestProfile('user-123', 'user', 'Regular User');
      const signature = createTestSignature('genuine', {
        userId: 'user-123',
      });
      const owner = {
        type: 'user' as const,
        data: user,
      };

      mockGetUserProfile.mockResolvedValue(mod);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canEditSignature(signature);

      expect(result).toBe(true);
    });

    it('should return false for mod when owner is another mod', async () => {
      const mod1 = createTestProfile('mod-123', 'mod', 'Mod User 1');
      const mod2 = createTestProfile('mod-456', 'mod', 'Mod User 2');
      const signature = createTestSignature('genuine', {
        userId: 'mod-456',
      });
      const owner = {
        type: 'user' as const,
        data: mod2,
      };

      mockGetUserProfile.mockResolvedValue(mod1);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canEditSignature(signature);

      expect(result).toBe(false);
    });

    it('should return false for mod when owner is admin', async () => {
      const mod = createTestProfile('mod-123', 'mod', 'Mod User');
      const admin = createTestProfile('admin-123', 'admin', 'Admin User');
      const signature = createTestSignature('genuine', {
        userId: 'admin-123',
      });
      const owner = {
        type: 'user' as const,
        data: admin,
      };

      mockGetUserProfile.mockResolvedValue(mod);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canEditSignature(signature);

      expect(result).toBe(false);
    });

    it('should return true for admin when owner is regular user', async () => {
      const admin = createTestProfile('admin-123', 'admin', 'Admin User');
      const user = createTestProfile('user-123', 'user', 'Regular User');
      const signature = createTestSignature('genuine', {
        userId: 'user-123',
      });
      const owner = {
        type: 'user' as const,
        data: user,
      };

      mockGetUserProfile.mockResolvedValue(admin);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canEditSignature(signature);

      expect(result).toBe(true);
    });

    it('should return true for admin when owner is mod', async () => {
      const admin = createTestProfile('admin-123', 'admin', 'Admin User');
      const mod = createTestProfile('mod-123', 'mod', 'Mod User');
      const signature = createTestSignature('genuine', {
        userId: 'mod-123',
      });
      const owner = {
        type: 'user' as const,
        data: mod,
      };

      mockGetUserProfile.mockResolvedValue(admin);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canEditSignature(signature);

      expect(result).toBe(true);
    });

    it('should return false for admin when owner is another admin', async () => {
      const admin1 = createTestProfile('admin-123', 'admin', 'Admin User 1');
      const admin2 = createTestProfile('admin-456', 'admin', 'Admin User 2');
      const signature = createTestSignature('genuine', {
        userId: 'admin-456',
      });
      const owner = {
        type: 'user' as const,
        data: admin2,
      };

      mockGetUserProfile.mockResolvedValue(admin1);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canEditSignature(signature);

      expect(result).toBe(false);
    });

    it('should return true for mod when owner is themselves', async () => {
      const mod = createTestProfile('mod-123', 'mod', 'Mod User');
      const signature = createTestSignature('genuine', {
        userId: 'mod-123',
      });
      const owner = {
        type: 'user' as const,
        data: mod,
      };

      mockGetUserProfile.mockResolvedValue(mod);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canEditSignature(signature);

      expect(result).toBe(true);
    });

    it('should return true when owner is null (external dataset)', async () => {
      const mod = createTestProfile('mod-123', 'mod', 'Mod User');
      const signature = createTestSignature('genuine', {
        userId: undefined,
      });

      mockGetUserProfile.mockResolvedValue(mod);
      mockGetSignatureOwner.mockResolvedValue(null);

      const result = await canEditSignature(signature);

      expect(result).toBe(true);
    });

    it('should return false when user is not authenticated', async () => {
      const signature = createTestSignature('genuine');

      mockGetUserProfile.mockResolvedValue(null);

      const result = await canEditSignature(signature);

      expect(result).toBe(false);
    });
  });

  describe('canDeleteSignature', () => {
    it('should return true for user when owner is themselves and is regular user', async () => {
      const user = createTestProfile('user-123', 'user', 'Test User');
      const signature = createTestSignature('genuine', {
        userId: 'user-123',
      });
      const owner = {
        type: 'user' as const,
        data: user,
      };

      mockGetUserProfile.mockResolvedValue(user);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canDeleteSignature(signature);

      expect(result).toBe(true);
    });

    it('should return false for user when owner is null', async () => {
      const user = createTestProfile('user-123', 'user', 'Test User');
      const signature = createTestSignature('genuine', {
        userId: undefined,
      });

      mockGetUserProfile.mockResolvedValue(user);
      mockGetSignatureOwner.mockResolvedValue(null);

      const result = await canDeleteSignature(signature);

      expect(result).toBe(false);
    });

    it('should return false for user when owner is not themselves', async () => {
      const user = createTestProfile('user-123', 'user', 'Test User');
      const otherUser = createTestProfile('user-456', 'user', 'Other User');
      const signature = createTestSignature('genuine', {
        userId: 'user-456',
      });
      const owner = {
        type: 'user' as const,
        data: otherUser,
      };

      mockGetUserProfile.mockResolvedValue(user);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canDeleteSignature(signature);

      // Пользователь может удалять только свои собственные подписи
      // owner.data.id !== user.id, поэтому должно быть false
      expect(result).toBe(false);
    });

    it('should return true for mod when owner is pseudouser', async () => {
      const mod = createTestProfile('mod-123', 'mod', 'Mod User');
      const pseudouser = createTestPseudouser('pseudo-123', 'Test Pseudouser');
      const signature = createTestSignature('genuine', {
        pseudouserId: 'pseudo-123',
      });
      const owner = {
        type: 'pseudouser' as const,
        data: pseudouser,
      };

      mockGetUserProfile.mockResolvedValue(mod);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canDeleteSignature(signature);

      expect(result).toBe(true);
    });

    it('should return true for mod when owner is regular user', async () => {
      const mod = createTestProfile('mod-123', 'mod', 'Mod User');
      const user = createTestProfile('user-123', 'user', 'Regular User');
      const signature = createTestSignature('genuine', {
        userId: 'user-123',
      });
      const owner = {
        type: 'user' as const,
        data: user,
      };

      mockGetUserProfile.mockResolvedValue(mod);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canDeleteSignature(signature);

      expect(result).toBe(true);
    });

    it('should return false for mod when owner is another mod', async () => {
      const mod1 = createTestProfile('mod-123', 'mod', 'Mod User 1');
      const mod2 = createTestProfile('mod-456', 'mod', 'Mod User 2');
      const signature = createTestSignature('genuine', {
        userId: 'mod-456',
      });
      const owner = {
        type: 'user' as const,
        data: mod2,
      };

      mockGetUserProfile.mockResolvedValue(mod1);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canDeleteSignature(signature);

      expect(result).toBe(false);
    });

    it('should return false for mod when owner is admin', async () => {
      const mod = createTestProfile('mod-123', 'mod', 'Mod User');
      const admin = createTestProfile('admin-123', 'admin', 'Admin User');
      const signature = createTestSignature('genuine', {
        userId: 'admin-123',
      });
      const owner = {
        type: 'user' as const,
        data: admin,
      };

      mockGetUserProfile.mockResolvedValue(mod);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canDeleteSignature(signature);

      expect(result).toBe(false);
    });

    it('should return true for admin when owner is regular user', async () => {
      const admin = createTestProfile('admin-123', 'admin', 'Admin User');
      const user = createTestProfile('user-123', 'user', 'Regular User');
      const signature = createTestSignature('genuine', {
        userId: 'user-123',
      });
      const owner = {
        type: 'user' as const,
        data: user,
      };

      mockGetUserProfile.mockResolvedValue(admin);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canDeleteSignature(signature);

      expect(result).toBe(true);
    });

    it('should return true for admin when owner is mod', async () => {
      const admin = createTestProfile('admin-123', 'admin', 'Admin User');
      const mod = createTestProfile('mod-123', 'mod', 'Mod User');
      const signature = createTestSignature('genuine', {
        userId: 'mod-123',
      });
      const owner = {
        type: 'user' as const,
        data: mod,
      };

      mockGetUserProfile.mockResolvedValue(admin);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canDeleteSignature(signature);

      expect(result).toBe(true);
    });

    it('should return false for admin when owner is another admin', async () => {
      const admin1 = createTestProfile('admin-123', 'admin', 'Admin User 1');
      const admin2 = createTestProfile('admin-456', 'admin', 'Admin User 2');
      const signature = createTestSignature('genuine', {
        userId: 'admin-456',
      });
      const owner = {
        type: 'user' as const,
        data: admin2,
      };

      mockGetUserProfile.mockResolvedValue(admin1);
      mockGetSignatureOwner.mockResolvedValue(owner);

      const result = await canDeleteSignature(signature);

      expect(result).toBe(false);
    });

    it('should return true when owner is null (external dataset)', async () => {
      const mod = createTestProfile('mod-123', 'mod', 'Mod User');
      const signature = createTestSignature('genuine', {
        userId: undefined,
      });

      mockGetUserProfile.mockResolvedValue(mod);
      mockGetSignatureOwner.mockResolvedValue(null);

      const result = await canDeleteSignature(signature);

      expect(result).toBe(true);
    });

    it('should return false when user is not authenticated', async () => {
      const signature = createTestSignature('genuine');

      mockGetUserProfile.mockResolvedValue(null);

      const result = await canDeleteSignature(signature);

      expect(result).toBe(false);
    });
  });
});
