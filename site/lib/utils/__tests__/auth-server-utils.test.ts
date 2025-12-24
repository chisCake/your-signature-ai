import { getUser, getUserProfile, isMod, isAdmin } from '../auth-server-utils';
import { createServerClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/supabase/queries';
import { createTestProfile } from '@/lib/__tests__/test-helpers';
import { Profile } from '@/lib/types';

// Моки для зависимостей
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/supabase/queries');

describe('auth-server-utils', () => {
  const mockCreateServerClient = createServerClient as jest.MockedFunction<
    typeof createServerClient
  >;
  const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;

  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      auth: {
        getClaims: jest.fn(),
      },
    };

    mockCreateServerClient.mockResolvedValue(mockClient);
  });

  describe('getUser', () => {
    it('should return user claims when authenticated', async () => {
      const mockClaims = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      };

      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: mockClaims },
        error: null,
      });

      const result = await getUser();

      expect(mockCreateServerClient).toHaveBeenCalled();
      expect(mockClient.auth.getClaims).toHaveBeenCalled();
      expect(result).toEqual(mockClaims);
    });

    it('should return null when user is not authenticated', async () => {
      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: null },
        error: null,
      });

      const result = await getUser();

      expect(result).toBeNull();
    });

    it('should return null when getClaims returns error', async () => {
      mockClient.auth.getClaims.mockResolvedValue({
        data: null,
        error: { message: 'Auth error' },
      });

      const result = await getUser();

      expect(result).toBeNull();
    });

    it('should use provided client instead of creating new one', async () => {
      const customClient = {
        auth: {
          getClaims: jest.fn().mockResolvedValue({
            data: { claims: { sub: 'custom-user' } },
            error: null,
          }),
        },
      };

      const result = await getUser(customClient);

      expect(mockCreateServerClient).not.toHaveBeenCalled();
      expect(customClient.auth.getClaims).toHaveBeenCalled();
      expect(result).toEqual({ sub: 'custom-user' });
    });
  });

  describe('getUserProfile', () => {
    it('should return profile when user is authenticated', async () => {
      const mockClaims = {
        sub: 'user-123',
        email: 'test@example.com',
      };

      const mockProfile = createTestProfile('user-123', 'user', 'Test User');

      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: mockClaims },
        error: null,
      });
      mockGetProfile.mockResolvedValue(mockProfile);

      const result = await getUserProfile();

      // Когда client не передан, getUserProfile создает новый client и передает его в getProfile
      expect(mockCreateServerClient).toHaveBeenCalled();
      expect(mockGetProfile).toHaveBeenCalledWith('user-123', mockClient);
      expect(result).toEqual({
        ...mockProfile,
        email: 'test@example.com',
      });
    });

    it('should return null when user is not authenticated', async () => {
      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: null },
        error: null,
      });

      const result = await getUserProfile();

      expect(mockGetProfile).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when user has no sub claim', async () => {
      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: { email: 'test@example.com' } },
        error: null,
      });

      const result = await getUserProfile();

      expect(mockGetProfile).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when profile is not found', async () => {
      const mockClaims = {
        sub: 'user-123',
        email: 'test@example.com',
      };

      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: mockClaims },
        error: null,
      });
      mockGetProfile.mockResolvedValue(null);

      const result = await getUserProfile();

      // Когда client не передан, getUserProfile создает новый client и передает его в getProfile
      expect(mockCreateServerClient).toHaveBeenCalled();
      expect(mockGetProfile).toHaveBeenCalledWith('user-123', mockClient);
      expect(result).toBeNull();
    });

    it('should set email from user claims', async () => {
      const mockClaims = {
        sub: 'user-123',
        email: 'user@example.com',
      };

      const mockProfile = createTestProfile(
        'user-123',
        'user',
        'Test User',
        null
      );

      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: mockClaims },
        error: null,
      });
      mockGetProfile.mockResolvedValue(mockProfile);

      const result = await getUserProfile();

      expect(result?.email).toBe('user@example.com');
    });

    it('should handle null email in user claims', async () => {
      const mockClaims = {
        sub: 'user-123',
        email: null,
      };

      const mockProfile = createTestProfile('user-123', 'user', 'Test User');

      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: mockClaims },
        error: null,
      });
      mockGetProfile.mockResolvedValue(mockProfile);

      const result = await getUserProfile();

      expect(result?.email).toBeNull();
    });

    it('should return null when getProfile throws error', async () => {
      const mockClaims = {
        sub: 'user-123',
        email: 'test@example.com',
      };

      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: mockClaims },
        error: null,
      });
      mockGetProfile.mockRejectedValue(new Error('Database error'));

      const result = await getUserProfile();

      expect(result).toBeNull();
    });

    it('should use provided client instead of creating new one', async () => {
      const customClient = {
        auth: {
          getClaims: jest.fn().mockResolvedValue({
            data: {
              claims: { sub: 'custom-user', email: 'custom@example.com' },
            },
            error: null,
          }),
        },
      } as any;

      const mockProfile = createTestProfile(
        'custom-user',
        'user',
        'Custom User'
      );
      mockGetProfile.mockResolvedValue(mockProfile);

      const result = await getUserProfile(customClient);

      expect(mockCreateServerClient).not.toHaveBeenCalled();
      // getUserProfile передает client в getProfile
      expect(mockGetProfile).toHaveBeenCalledWith('custom-user', customClient);
      expect(result).toEqual({
        ...mockProfile,
        email: 'custom@example.com',
      });
    });
  });

  describe('isMod', () => {
    it('should return true when user has mod role', async () => {
      const mockClaims = {
        sub: 'mod-123',
        user_metadata: {
          role: 'mod',
        },
      };

      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: mockClaims },
        error: null,
      });

      const result = await isMod();

      expect(result).toBe(true);
    });

    it('should return false when user does not have mod role', async () => {
      const mockClaims = {
        sub: 'user-123',
        user_metadata: {
          role: 'user',
        },
      };

      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: mockClaims },
        error: null,
      });

      const result = await isMod();

      expect(result).toBe(false);
    });

    it('should return true when user has admin role (higher than mod)', async () => {
      const mockClaims = {
        sub: 'admin-123',
        user_metadata: {
          role: 'admin',
        },
      };

      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: mockClaims },
        error: null,
      });

      const result = await isMod();

      expect(result).toBe(true);
    });

    it('should use provided user instead of fetching', async () => {
      const providedUser = {
        sub: 'mod-123',
        user_metadata: {
          role: 'mod',
        },
      };

      const result = await isMod(providedUser);

      expect(mockClient.auth.getClaims).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when user is null', async () => {
      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: null },
        error: null,
      });

      const result = await isMod();

      expect(result).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true when user has admin role', async () => {
      const mockClaims = {
        sub: 'admin-123',
        user_metadata: {
          role: 'admin',
        },
      };

      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: mockClaims },
        error: null,
      });

      const result = await isAdmin();

      expect(result).toBe(true);
    });

    it('should return false when user does not have admin role', async () => {
      const mockClaims = {
        sub: 'user-123',
        user_metadata: {
          role: 'user',
        },
      };

      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: mockClaims },
        error: null,
      });

      const result = await isAdmin();

      expect(result).toBe(false);
    });

    it('should return false when user has mod role (lower than admin)', async () => {
      const mockClaims = {
        sub: 'mod-123',
        user_metadata: {
          role: 'mod',
        },
      };

      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: mockClaims },
        error: null,
      });

      const result = await isAdmin();

      expect(result).toBe(false);
    });

    it('should use provided user instead of fetching', async () => {
      const providedUser = {
        sub: 'admin-123',
        user_metadata: {
          role: 'admin',
        },
      };

      const result = await isAdmin(providedUser);

      expect(mockClient.auth.getClaims).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when user is null', async () => {
      mockClient.auth.getClaims.mockResolvedValue({
        data: { claims: null },
        error: null,
      });

      const result = await isAdmin();

      expect(result).toBe(false);
    });
  });
});
