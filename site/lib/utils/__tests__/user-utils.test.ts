import { getGenuineSignatures } from '../user-utils';
import { createBrowserClient } from '@/lib/supabase/client';
import { getUserGenuineSignatures } from '@/lib/supabase/queries';
import { createTestGenuineSignature } from '@/lib/__tests__/test-helpers';

// Моки для зависимостей
jest.mock('@/lib/supabase/client');
jest.mock('@/lib/supabase/queries');

describe('user-utils', () => {
  const mockCreateBrowserClient = createBrowserClient as jest.MockedFunction<
    typeof createBrowserClient
  >;
  const mockGetUserGenuineSignatures =
    getUserGenuineSignatures as jest.MockedFunction<
      typeof getUserGenuineSignatures
    >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGenuineSignatures', () => {
    it('should return genuine signatures for authenticated user', async () => {
      const mockClient = {
        auth: {
          getClaims: jest.fn().mockResolvedValue({
            data: {
              claims: {
                sub: 'user-123',
              },
            },
          }),
        },
      } as any;

      const mockSignatures = [
        createTestGenuineSignature('sig-1'),
        createTestGenuineSignature('sig-2'),
      ];

      mockCreateBrowserClient.mockReturnValue(mockClient);
      mockGetUserGenuineSignatures.mockResolvedValue(mockSignatures);

      const result = await getGenuineSignatures();

      expect(mockCreateBrowserClient).toHaveBeenCalled();
      expect(mockClient.auth.getClaims).toHaveBeenCalled();
      expect(mockGetUserGenuineSignatures).toHaveBeenCalledWith(
        'user-123',
        'user',
        mockClient
      );
      expect(result).toEqual(mockSignatures);
    });

    it('should throw error when user ID is not found', async () => {
      const mockClient = {
        auth: {
          getClaims: jest.fn().mockResolvedValue({
            data: {
              claims: null,
            },
          }),
        },
      } as any;

      mockCreateBrowserClient.mockReturnValue(mockClient);

      await expect(getGenuineSignatures()).rejects.toThrow('User ID not found');

      expect(mockCreateBrowserClient).toHaveBeenCalled();
      expect(mockClient.auth.getClaims).toHaveBeenCalled();
      expect(mockGetUserGenuineSignatures).not.toHaveBeenCalled();
    });

    it('should throw error when getClaims returns null data', async () => {
      const mockClient = {
        auth: {
          getClaims: jest.fn().mockResolvedValue({
            data: null,
          }),
        },
      } as any;

      mockCreateBrowserClient.mockReturnValue(mockClient);

      await expect(getGenuineSignatures()).rejects.toThrow('User ID not found');

      expect(mockCreateBrowserClient).toHaveBeenCalled();
      expect(mockClient.auth.getClaims).toHaveBeenCalled();
      expect(mockGetUserGenuineSignatures).not.toHaveBeenCalled();
    });

    it('should throw error when getClaims fails', async () => {
      const mockClient = {
        auth: {
          getClaims: jest.fn().mockRejectedValue(new Error('Auth error')),
        },
      } as any;

      mockCreateBrowserClient.mockReturnValue(mockClient);

      await expect(getGenuineSignatures()).rejects.toThrow('Auth error');

      expect(mockCreateBrowserClient).toHaveBeenCalled();
      expect(mockClient.auth.getClaims).toHaveBeenCalled();
      expect(mockGetUserGenuineSignatures).not.toHaveBeenCalled();
    });

    it('should throw error when getUserGenuineSignatures fails', async () => {
      const mockClient = {
        auth: {
          getClaims: jest.fn().mockResolvedValue({
            data: {
              claims: {
                sub: 'user-123',
              },
            },
          }),
        },
      } as any;

      mockCreateBrowserClient.mockReturnValue(mockClient);
      mockGetUserGenuineSignatures.mockRejectedValue(new Error('Query error'));

      await expect(getGenuineSignatures()).rejects.toThrow('Query error');

      expect(mockCreateBrowserClient).toHaveBeenCalled();
      expect(mockClient.auth.getClaims).toHaveBeenCalled();
      expect(mockGetUserGenuineSignatures).toHaveBeenCalledWith(
        'user-123',
        'user',
        mockClient
      );
    });

    it('should return empty array when no signatures found', async () => {
      const mockClient = {
        auth: {
          getClaims: jest.fn().mockResolvedValue({
            data: {
              claims: {
                sub: 'user-123',
              },
            },
          }),
        },
      } as any;

      mockCreateBrowserClient.mockReturnValue(mockClient);
      mockGetUserGenuineSignatures.mockResolvedValue([]);

      const result = await getGenuineSignatures();

      expect(result).toEqual([]);
      expect(mockGetUserGenuineSignatures).toHaveBeenCalledWith(
        'user-123',
        'user',
        mockClient
      );
    });
  });
});
