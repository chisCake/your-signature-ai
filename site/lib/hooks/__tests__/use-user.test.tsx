import { renderHook, waitFor } from '@testing-library/react';
import { useUser } from '../use-user';
import { createBrowserClient } from '@/lib/supabase/client';
import { hasRole } from '@/lib/utils/auth-utils';

// Моки для зависимостей
jest.mock('@/lib/supabase/client');
jest.mock('@/lib/utils/auth-utils');

describe('use-user', () => {
  const mockCreateBrowserClient = createBrowserClient as jest.MockedFunction<
    typeof createBrowserClient
  >;
  const mockHasRole = hasRole as jest.MockedFunction<typeof hasRole>;

  let mockClient: any;
  let mockGetUser: jest.Mock;
  let mockOnAuthStateChange: jest.Mock;
  let mockUnsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUnsubscribe = jest.fn();
    mockGetUser = jest.fn();
    mockOnAuthStateChange = jest.fn();

    mockClient = {
      auth: {
        getUser: mockGetUser,
        onAuthStateChange: mockOnAuthStateChange,
      },
    };

    mockCreateBrowserClient.mockReturnValue(mockClient);
    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: mockUnsubscribe,
        },
      },
    });
  });

  describe('initialization', () => {
    it('should return loading state initially', () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
      });

      const { result } = renderHook(() => useUser());

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.isMod).toBe(false);
      expect(result.current.isAdmin).toBe(false);
    });

    it('should fetch user on mount', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { role: 'user' },
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
      });
      mockHasRole.mockReturnValue(false);

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetUser).toHaveBeenCalled();
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isMod).toBe(false);
      expect(result.current.isAdmin).toBe(false);
    });

    it('should set isMod to true when user has mod role', async () => {
      const mockUser = {
        id: 'mod-123',
        email: 'mod@example.com',
        user_metadata: { role: 'mod' },
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
      });
      mockHasRole.mockImplementation((user, role) => {
        if (role === 'mod') return true;
        return false;
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isMod).toBe(true);
      expect(result.current.isAdmin).toBe(false);
    });

    it('should set isAdmin to true when user has admin role', async () => {
      const mockUser = {
        id: 'admin-123',
        email: 'admin@example.com',
        user_metadata: { role: 'admin' },
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
      });
      mockHasRole.mockImplementation((user, role) => {
        if (role === 'admin') return true;
        if (role === 'mod') return true; // admin has mod role too
        return false;
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isMod).toBe(true);
      expect(result.current.isAdmin).toBe(true);
    });

    it('should handle null user', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isMod).toBe(false);
      expect(result.current.isAdmin).toBe(false);
    });
  });

  describe('auth state changes', () => {
    it('should update user when auth state changes', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Симулируем изменение auth state
      const newUser = {
        id: 'user-456',
        email: 'new@example.com',
        user_metadata: { role: 'user' },
      };

      mockHasRole.mockReturnValue(false);

      // Вызываем callback onAuthStateChange
      const onAuthStateChangeCall = mockOnAuthStateChange.mock.calls[0][0];
      await onAuthStateChangeCall('SIGNED_IN', { user: newUser } as any);

      await waitFor(() => {
        expect(result.current.user).toEqual(newUser);
      });

      expect(result.current.isMod).toBe(false);
      expect(result.current.isAdmin).toBe(false);
    });

    it('should update roles when user signs in with mod role', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const modUser = {
        id: 'mod-456',
        email: 'mod@example.com',
        user_metadata: { role: 'mod' },
      };

      mockHasRole.mockImplementation((user, role) => {
        if (role === 'mod') return true;
        return false;
      });

      const onAuthStateChangeCall = mockOnAuthStateChange.mock.calls[0][0];
      await onAuthStateChangeCall('SIGNED_IN', { user: modUser } as any);

      await waitFor(() => {
        expect(result.current.isMod).toBe(true);
      });

      expect(result.current.isAdmin).toBe(false);
    });

    it('should clear user and roles when user signs out', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { role: 'user' },
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
      });
      mockHasRole.mockReturnValue(false);

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Симулируем выход
      const onAuthStateChangeCall = mockOnAuthStateChange.mock.calls[0][0];
      await onAuthStateChangeCall('SIGNED_OUT', { user: null } as any);

      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });

      expect(result.current.isMod).toBe(false);
      expect(result.current.isAdmin).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should unsubscribe from auth changes on unmount', () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
      });

      const { unmount } = renderHook(() => useUser());

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
