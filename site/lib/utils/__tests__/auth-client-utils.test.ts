import { invalidateProfileCache, getUserProfile } from '../auth-client-utils';
import { createTestProfile } from '@/lib/__tests__/test-helpers';
import { createBrowserClient } from '@/lib/supabase/client';
import { getProfile } from '@/lib/supabase/queries';

// Моки для зависимостей
jest.mock('@/lib/supabase/client');
jest.mock('@/lib/supabase/queries');
jest.mock('../auth-utils', () => ({
  hasRole: jest.fn(),
}));

const mockCreateBrowserClient = createBrowserClient as jest.MockedFunction<
  typeof createBrowserClient
>;
const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;

// Мок localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('auth-client-utils - cache functions', () => {
  let mockClient: {
    auth: {
      getClaims: jest.Mock;
      getSession: jest.Mock;
    };
  };

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();

    mockClient = {
      auth: {
        getClaims: jest.fn(),
        getSession: jest.fn(),
      },
    };

    mockCreateBrowserClient.mockReturnValue(mockClient as never);
  });

  describe('invalidateProfileCache', () => {
    it('should clear profile cache from localStorage', () => {
      // Устанавливаем кэш
      const profile = createTestProfile('user-123');
      const cachedData = {
        profile,
        timestamp: Date.now(),
        userId: 'user-123',
      };
      localStorage.setItem('user_profile_cache', JSON.stringify(cachedData));

      expect(localStorage.getItem('user_profile_cache')).toBeTruthy();

      invalidateProfileCache();

      expect(localStorage.getItem('user_profile_cache')).toBeNull();
    });

    it('should not throw error when cache does not exist', () => {
      expect(localStorage.getItem('user_profile_cache')).toBeNull();

      expect(() => invalidateProfileCache()).not.toThrow();
    });
  });

  describe('getUserProfile - cache behavior', () => {
    it('should return cached profile when valid cache exists', async () => {
      const userId = 'user-123';
      const profile = createTestProfile(userId, 'user', 'Test User');
      const cachedData = {
        profile,
        timestamp: Date.now(),
        userId,
      };

      localStorage.setItem('user_profile_cache', JSON.stringify(cachedData));

      mockClient.auth.getClaims.mockResolvedValue({
        data: {
          claims: {
            sub: userId,
            email: 'test@example.com',
          },
        },
      });

      const result = await getUserProfile();

      expect(result).toEqual(profile);
      expect(mockGetProfile).not.toHaveBeenCalled();
    });

    it('should fetch profile from API when cache is expired', async () => {
      const userId = 'user-123';
      const cachedProfile = createTestProfile(userId, 'user', 'Old Name');
      const freshProfile = createTestProfile(userId, 'user', 'New Name');

      // Создаем истекший кэш (6 минут назад)
      const expiredTimestamp = Date.now() - 6 * 60 * 1000;
      const cachedData = {
        profile: cachedProfile,
        timestamp: expiredTimestamp,
        userId,
      };

      localStorage.setItem('user_profile_cache', JSON.stringify(cachedData));

      mockClient.auth.getClaims.mockResolvedValue({
        data: {
          claims: {
            sub: userId,
            email: 'test@example.com',
          },
        },
      });

      mockGetProfile.mockResolvedValue(freshProfile);

      const result = await getUserProfile();

      expect(result).toEqual(freshProfile);
      expect(mockGetProfile).toHaveBeenCalledWith(userId, mockClient);
    });

    it('should fetch profile from API when cache belongs to different user', async () => {
      const userId1 = 'user-123';
      const userId2 = 'user-456';
      const profile1 = createTestProfile(userId1);
      const profile2 = createTestProfile(userId2);

      // Кэш для другого пользователя
      const cachedData = {
        profile: profile1,
        timestamp: Date.now(),
        userId: userId1,
      };

      localStorage.setItem('user_profile_cache', JSON.stringify(cachedData));

      mockClient.auth.getClaims.mockResolvedValue({
        data: {
          claims: {
            sub: userId2,
            email: 'test2@example.com',
          },
        },
      });

      mockGetProfile.mockResolvedValue(profile2);

      const result = await getUserProfile();

      expect(result).toEqual(profile2);
      expect(mockGetProfile).toHaveBeenCalledWith(userId2, mockClient);
      // Кэш должен быть обновлен для нового пользователя
      const cached = localStorage.getItem('user_profile_cache');
      expect(cached).toBeTruthy();
      if (cached) {
        const cachedData = JSON.parse(cached);
        expect(cachedData.userId).toBe(userId2);
      }
    });

    it('should save profile to cache after fetching from API', async () => {
      const userId = 'user-123';
      const profile = createTestProfile(userId);

      mockClient.auth.getClaims.mockResolvedValue({
        data: {
          claims: {
            sub: userId,
            email: 'test@example.com',
          },
        },
      });

      mockGetProfile.mockResolvedValue(profile);

      const result = await getUserProfile();

      expect(result).toEqual(profile);

      // Проверяем, что профиль сохранен в кэш
      const cached = localStorage.getItem('user_profile_cache');
      expect(cached).toBeTruthy();

      if (cached) {
        const cachedData = JSON.parse(cached);
        expect(cachedData.userId).toBe(userId);
        expect(cachedData.profile).toEqual(profile);
        expect(cachedData.timestamp).toBeGreaterThan(0);
      }
    });

    it('should handle invalid JSON in cache', async () => {
      const userId = 'user-123';
      const profile = createTestProfile(userId);

      // Устанавливаем невалидный JSON
      localStorage.setItem('user_profile_cache', 'invalid json');

      mockClient.auth.getClaims.mockResolvedValue({
        data: {
          claims: {
            sub: userId,
            email: 'test@example.com',
          },
        },
      });

      mockGetProfile.mockResolvedValue(profile);

      const result = await getUserProfile();

      expect(result).toEqual(profile);
      // Кэш должен быть очищен после ошибки
      expect(localStorage.getItem('user_profile_cache')).toBeTruthy(); // Новый кэш должен быть установлен
    });

    it('should return null when userId is not found', async () => {
      mockClient.auth.getClaims.mockResolvedValue({
        data: {
          claims: null,
        },
      });

      const result = await getUserProfile();

      expect(result).toBeNull();
      expect(mockGetProfile).not.toHaveBeenCalled();
    });

    it('should return null when claims are null', async () => {
      mockClient.auth.getClaims.mockResolvedValue({
        data: null,
      });

      const result = await getUserProfile();

      expect(result).toBeNull();
      expect(mockGetProfile).not.toHaveBeenCalled();
    });

    it('should update profile email from claims', async () => {
      const userId = 'user-123';
      const profile = createTestProfile(userId);
      profile.email = null; // Изначально email отсутствует

      mockClient.auth.getClaims.mockResolvedValue({
        data: {
          claims: {
            sub: userId,
            email: 'newemail@example.com',
          },
        },
      });

      mockGetProfile.mockResolvedValue(profile);

      const result = await getUserProfile();

      expect(result?.email).toBe('newemail@example.com');
    });

    it('should throw error when profile is not found', async () => {
      const userId = 'user-123';

      mockClient.auth.getClaims.mockResolvedValue({
        data: {
          claims: {
            sub: userId,
            email: 'test@example.com',
          },
        },
      });

      mockGetProfile.mockResolvedValue(null);

      await expect(getUserProfile()).rejects.toThrow('Profile not found');
    });

    it('should handle error when getProfile throws', async () => {
      const userId = 'user-123';

      mockClient.auth.getClaims.mockResolvedValue({
        data: {
          claims: {
            sub: userId,
            email: 'test@example.com',
          },
        },
      });

      const error = new Error('Database error');
      mockGetProfile.mockRejectedValue(error);

      await expect(getUserProfile()).rejects.toThrow('Database error');
    });

    it('should handle localStorage error when setting cache', async () => {
      const userId = 'user-123';
      const profile = createTestProfile(userId);

      mockClient.auth.getClaims.mockResolvedValue({
        data: {
          claims: {
            sub: userId,
            email: 'test@example.com',
          },
        },
      });

      mockGetProfile.mockResolvedValue(profile);

      // Мокируем localStorage.setItem чтобы он выбрасывал ошибку
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn(() => {
        throw new Error('QuotaExceededError');
      });

      // Функция должна обработать ошибку и продолжить работу
      const result = await getUserProfile();

      expect(result).toEqual(profile);

      // Восстанавливаем оригинальный setItem
      localStorage.setItem = originalSetItem;
    });
  });

  describe('invalidateProfileCache', () => {
    it('should clear profile cache', () => {
      const { invalidateProfileCache } = require('../auth-client-utils');

      localStorage.setItem(
        'user_profile_cache',
        JSON.stringify({ test: 'data' })
      );

      invalidateProfileCache();

      expect(localStorage.getItem('user_profile_cache')).toBeNull();
    });

    it('should handle error when clearing cache', () => {
      const { invalidateProfileCache } = require('../auth-client-utils');

      // Мокируем localStorage.removeItem чтобы он выбрасывал ошибку
      const originalRemoveItem = localStorage.removeItem;
      localStorage.removeItem = jest.fn(() => {
        throw new Error('Storage error');
      });

      // Функция должна обработать ошибку и не падать
      expect(() => invalidateProfileCache()).not.toThrow();

      // Восстанавливаем оригинальный removeItem
      localStorage.removeItem = originalRemoveItem;
    });
  });

  describe('isMod', () => {
    const { hasRole } = require('../auth-utils');

    it('should return true when user is mod', async () => {
      const { isMod } = require('../auth-client-utils');

      const modUser = { id: 'mod-1', role: 'mod' } as any;
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: { user: modUser } },
      });
      (hasRole as jest.Mock).mockReturnValue(true);

      const result = await isMod();

      expect(result).toBe(true);
    });

    it('should return false when user is not mod', async () => {
      const { isMod } = require('../auth-client-utils');

      const user = { id: 'user-1', role: 'user' } as any;
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: { user } },
      });
      (hasRole as jest.Mock).mockReturnValue(false);

      const result = await isMod();

      expect(result).toBe(false);
    });

    it('should use provided user instead of calling getUser', async () => {
      const { isMod } = require('../auth-client-utils');

      const providedUser = { id: 'mod-1', role: 'mod' } as any;
      (hasRole as jest.Mock).mockReturnValue(true);

      const result = await isMod(providedUser);

      expect(result).toBe(true);
      expect(mockClient.auth.getSession).not.toHaveBeenCalled();
    });
  });

  describe('isAdmin', () => {
    const { hasRole } = require('../auth-utils');

    it('should return true when user is admin', async () => {
      const { isAdmin } = require('../auth-client-utils');

      const adminUser = { id: 'admin-1', role: 'admin' } as any;
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: { user: adminUser } },
      });
      (hasRole as jest.Mock).mockReturnValue(true);

      const result = await isAdmin();

      expect(result).toBe(true);
    });

    it('should return false when user is not admin', async () => {
      const { isAdmin } = require('../auth-client-utils');

      const user = { id: 'user-1', role: 'user' } as any;
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: { user } },
      });
      (hasRole as jest.Mock).mockReturnValue(false);

      const result = await isAdmin();

      expect(result).toBe(false);
    });

    it('should use provided user instead of calling getUser', async () => {
      const { isAdmin } = require('../auth-client-utils');

      const providedUser = { id: 'admin-1', role: 'admin' } as any;
      (hasRole as jest.Mock).mockReturnValue(true);

      const result = await isAdmin(providedUser);

      expect(result).toBe(true);
      expect(mockClient.auth.getSession).not.toHaveBeenCalled();
    });
  });
});
