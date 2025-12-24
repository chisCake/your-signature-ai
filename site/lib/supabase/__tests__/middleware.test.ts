// Полифилл для Request (нужен для NextRequest)
if (typeof global.Request === 'undefined') {
  global.Request = class MockRequest {
    url: string;
    method: string;
    headers: Headers;
    constructor(input: string | Request, init?: any) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = init?.method || 'GET';
      this.headers = new Headers(init?.headers);
    }
  } as any;
}

// Мокируем зависимости перед импортом
jest.mock('next/server', () => {
  class MockNextRequest {
    nextUrl: any;
    cookies: any;
    constructor(url: string | URL, init?: any) {
      const urlObj = typeof url === 'string' ? new URL(url) : url;
      this.nextUrl = {
        pathname: urlObj.pathname,
        clone: jest.fn(() => {
          const cloned = new URL(urlObj.toString());
          cloned.pathname = urlObj.pathname;
          return cloned;
        }),
      };
      this.cookies = {
        getAll: jest.fn().mockReturnValue([]),
        set: jest.fn(),
      };
    }
  }

  class MockNextResponse {
    status: number;
    headers: Headers;
    cookies: any;
    request: any;

    constructor(body?: any, init?: any) {
      this.status = init?.status || 200;
      this.headers = new Headers(init?.headers);
      this.cookies = {
        set: jest.fn(),
        getAll: jest.fn().mockReturnValue([]),
      };
      this.request = init?.request;
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: Object.assign(MockNextResponse, {
      next: jest.fn((init?: any) => {
        return new MockNextResponse(null, {
          ...init,
          status: 200,
        });
      }),
      redirect: jest.fn((url: string | URL) => {
        const location = typeof url === 'string' ? url : url.toString();
        const headers = new Headers();
        headers.set('location', location);
        return new MockNextResponse(null, {
          status: 307,
          headers,
        });
      }),
      json: jest.fn((data: any, init?: any) => {
        const response: any = new MockNextResponse(data, {
          status: init?.status || 200,
        });
        response.json = jest.fn().mockResolvedValue(data);
        return response;
      }),
    }),
  };
});

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

jest.mock('@/lib/utils/auth-server-utils', () => ({
  getUser: jest.fn(),
  isAdmin: jest.fn(),
  isMod: jest.fn(),
}));

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getUser, isAdmin, isMod } from '@/lib/utils/auth-server-utils';
import { createTestProfile } from '@/lib/__tests__/test-helpers';

// Устанавливаем переменные окружения перед импортом middleware
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'test-key';

// Импортируем middleware после установки переменных окружения
const { updateSession } = require('../middleware');

describe('middleware', () => {
  let mockCreateServerClient: jest.MockedFunction<typeof createServerClient>;
  let mockGetUser: jest.MockedFunction<typeof getUser>;
  let mockIsAdmin: jest.MockedFunction<typeof isAdmin>;
  let mockIsMod: jest.MockedFunction<typeof isMod>;
  let mockSupabaseClient: any;
  let mockCookies: any;

  beforeEach(() => {
    // Настраиваем моки
    mockCreateServerClient = createServerClient as jest.MockedFunction<
      typeof createServerClient
    >;
    mockGetUser = getUser as jest.MockedFunction<typeof getUser>;
    mockIsAdmin = isAdmin as jest.MockedFunction<typeof isAdmin>;
    mockIsMod = isMod as jest.MockedFunction<typeof isMod>;

    // Мок Supabase клиента
    mockSupabaseClient = {
      auth: {
        getClaims: jest.fn(),
      },
    };

    // Мок cookies
    mockCookies = {
      getAll: jest
        .fn()
        .mockReturnValue([{ name: 'sb-access-token', value: 'token-value' }]),
      set: jest.fn(),
    };

    mockCreateServerClient.mockReturnValue(mockSupabaseClient as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createMockRequest(
    pathname: string,
    method: string = 'GET'
  ): NextRequest {
    const url = `http://localhost:3000${pathname}`;
    const request = new NextRequest(url, {
      method,
      headers: {
        cookie: 'sb-access-token=token-value',
      },
    } as any);
    // Настраиваем cookies для мока
    request.cookies.getAll = jest
      .fn()
      .mockReturnValue([{ name: 'sb-access-token', value: 'token-value' }]);
    request.cookies.set = jest.fn();
    return request;
  }

  describe('GUEST_ROUTES', () => {
    it('should allow access to /login without authentication', async () => {
      const request = createMockRequest('/login');
      mockGetUser.mockResolvedValue(null);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('should allow access to /auth without authentication', async () => {
      const request = createMockRequest('/auth');
      mockGetUser.mockResolvedValue(null);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });

    it('should allow access to /about without authentication', async () => {
      const request = createMockRequest('/about');
      mockGetUser.mockResolvedValue(null);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });

    it('should allow access to /api/forgery without authentication', async () => {
      const request = createMockRequest('/api/forgery');
      mockGetUser.mockResolvedValue(null);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });

    it('should allow access to /api/health without authentication', async () => {
      const request = createMockRequest('/api/health');
      mockGetUser.mockResolvedValue(null);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });

    it('should allow access to /api/inference without authentication', async () => {
      const request = createMockRequest('/api/inference');
      mockGetUser.mockResolvedValue(null);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Admin access', () => {
    it('should allow admin access to all routes', async () => {
      const request = createMockRequest('/dashboard-mod');
      const adminUser = createTestProfile('admin-id', 'admin');
      mockGetUser.mockResolvedValue(adminUser as any);
      mockIsAdmin.mockResolvedValue(true);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
      expect(mockIsAdmin).toHaveBeenCalledWith(adminUser);
    });

    it('should allow admin access to user routes', async () => {
      const request = createMockRequest('/dashboard');
      const adminUser = createTestProfile('admin-id', 'admin');
      mockGetUser.mockResolvedValue(adminUser as any);
      mockIsAdmin.mockResolvedValue(true);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });

    it('should allow admin access to mod routes', async () => {
      const request = createMockRequest('/signatures');
      const adminUser = createTestProfile('admin-id', 'admin');
      mockGetUser.mockResolvedValue(adminUser as any);
      mockIsAdmin.mockResolvedValue(true);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Unauthorized users', () => {
    it('should redirect to /auth/login for non-public routes', async () => {
      const request = createMockRequest('/dashboard');
      mockGetUser.mockResolvedValue(null);
      mockIsAdmin.mockResolvedValue(false);

      const response = await updateSession(request);

      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('/auth/login');
    });

    it('should return 401 for API routes when unauthorized', async () => {
      const request = createMockRequest('/api/signatures');
      mockGetUser.mockResolvedValue(null);
      mockIsAdmin.mockResolvedValue(false);

      const response = await updateSession(request);
      const jsonResponse = response as any;
      const json = await jsonResponse.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('should allow access to root path / when unauthorized', async () => {
      const request = createMockRequest('/');
      mockGetUser.mockResolvedValue(null);
      mockIsAdmin.mockResolvedValue(false);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });
  });

  describe('USER_ROUTES protection', () => {
    it('should allow authenticated user to access /dashboard', async () => {
      const request = createMockRequest('/dashboard');
      const user = createTestProfile('user-id', 'user');
      mockGetUser.mockResolvedValue(user as any);
      mockIsAdmin.mockResolvedValue(false);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });

    it('should redirect unauthenticated user accessing /dashboard to login', async () => {
      const request = createMockRequest('/dashboard');
      mockGetUser.mockResolvedValue(null);
      mockIsAdmin.mockResolvedValue(false);

      const response = await updateSession(request);

      // Неавторизованные пользователи редиректятся на /auth/login
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth/login');
    });
  });

  describe('MOD_ROUTES protection', () => {
    it('should allow mod user to access /dashboard-mod', async () => {
      const request = createMockRequest('/dashboard-mod');
      const modUser = createTestProfile('mod-id', 'mod');
      mockGetUser.mockResolvedValue(modUser as any);
      mockIsAdmin.mockResolvedValue(false);
      mockIsMod.mockResolvedValue(true);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
      expect(mockIsMod).toHaveBeenCalledWith(modUser);
    });

    it('should allow mod user to access /signatures', async () => {
      const request = createMockRequest('/signatures');
      const modUser = createTestProfile('mod-id', 'mod');
      mockGetUser.mockResolvedValue(modUser as any);
      mockIsAdmin.mockResolvedValue(false);
      mockIsMod.mockResolvedValue(true);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });

    it('should allow mod user to access /users', async () => {
      const request = createMockRequest('/users');
      const modUser = createTestProfile('mod-id', 'mod');
      mockGetUser.mockResolvedValue(modUser as any);
      mockIsAdmin.mockResolvedValue(false);
      mockIsMod.mockResolvedValue(true);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });

    it('should allow mod user to access /api/signatures', async () => {
      const request = createMockRequest('/api/signatures');
      const modUser = createTestProfile('mod-id', 'mod');
      mockGetUser.mockResolvedValue(modUser as any);
      mockIsAdmin.mockResolvedValue(false);
      mockIsMod.mockResolvedValue(true);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });

    it('should return 403 for authenticated non-mod user accessing /signatures', async () => {
      const request = createMockRequest('/signatures');
      const user = createTestProfile('user-id', 'user');
      mockGetUser.mockResolvedValue(user as any);
      mockIsAdmin.mockResolvedValue(false);
      mockIsMod.mockResolvedValue(false);

      const response = await updateSession(request);

      // Авторизованный пользователь без прав модератора получает 403
      expect(response.status).toBe(403);
    });

    it('should redirect unauthenticated user accessing /signatures to login', async () => {
      const request = createMockRequest('/signatures');
      mockGetUser.mockResolvedValue(null);
      mockIsAdmin.mockResolvedValue(false);
      mockIsMod.mockResolvedValue(false);

      const response = await updateSession(request);

      // Неавторизованные пользователи редиректятся на /auth/login
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth/login');
    });
  });

  describe('Cookie handling', () => {
    it('should create Supabase client with cookies', async () => {
      const request = createMockRequest('/dashboard');
      const user = createTestProfile('user-id', 'user');
      mockGetUser.mockResolvedValue(user as any);
      mockIsAdmin.mockResolvedValue(false);

      await updateSession(request);

      expect(mockCreateServerClient).toHaveBeenCalled();
      const callArgs = mockCreateServerClient.mock.calls[0];
      expect(callArgs[0]).toBe('https://test.supabase.co');
      expect(callArgs[1]).toBe('test-key');
      expect(callArgs[2]).toHaveProperty('cookies');
      expect(callArgs[2].cookies).toHaveProperty('getAll');
      expect(callArgs[2].cookies).toHaveProperty('setAll');
    });

    it('should handle empty cookies', async () => {
      const request = createMockRequest('/login');
      const emptyCookies = {
        getAll: jest.fn().mockReturnValue([]),
        set: jest.fn(),
      };
      mockGetUser.mockResolvedValue(null);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Edge cases', () => {
    it('should handle request to /auth/login path correctly', async () => {
      const request = createMockRequest('/auth/login');
      mockGetUser.mockResolvedValue(null);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });

    it('should handle nested guest routes', async () => {
      const request = createMockRequest('/about/terms');
      mockGetUser.mockResolvedValue(null);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });

    it('should handle nested mod routes', async () => {
      const request = createMockRequest('/signatures/123');
      const modUser = createTestProfile('mod-id', 'mod');
      mockGetUser.mockResolvedValue(modUser as any);
      mockIsAdmin.mockResolvedValue(false);
      mockIsMod.mockResolvedValue(true);

      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });
  });
});
