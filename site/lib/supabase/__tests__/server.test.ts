// Мокируем @supabase/ssr и next/headers перед импортом
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

describe('supabase/server', () => {
  let mockCreateServerClientSSR: jest.MockedFunction<any>;
  let mockCookies: jest.MockedFunction<any>;
  let createServerClient: () => Promise<any>;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Устанавливаем переменные окружения
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'test-key';

    // Настраиваем моки
    const ssrModule = require('@supabase/ssr');
    mockCreateServerClientSSR = ssrModule.createServerClient;
    mockCreateServerClientSSR.mockReturnValue({} as any);

    const headersModule = require('next/headers');
    mockCookies = headersModule.cookies;

    // Создаем мок cookieStore
    const mockCookieStore = {
      getAll: jest.fn().mockReturnValue([
        { name: 'cookie1', value: 'value1' },
        { name: 'cookie2', value: 'value2' },
      ]),
      set: jest.fn(),
    };

    mockCookies.mockResolvedValue(mockCookieStore);

    // Импортируем тестируемую функцию
    const serverModule = require('../server');
    createServerClient = serverModule.createServerClient;
  });

  describe('createServerClient', () => {
    it('should create server client successfully when environment variables are set', async () => {
      const client = await createServerClient();

      expect(mockCookies).toHaveBeenCalled();
      expect(mockCreateServerClientSSR).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-key',
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function),
          }),
        })
      );
      expect(client).toBeDefined();
    });

    it('should throw error when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
      jest.resetModules();
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'test-key';

      const serverModule = require('../server');
      const createServerClientFn = serverModule.createServerClient;

      await expect(createServerClientFn()).rejects.toThrow(
        "Your project's URL and API key are required"
      );
    });

    it('should throw error when NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY is missing', async () => {
      jest.resetModules();
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

      const serverModule = require('../server');
      const createServerClientFn = serverModule.createServerClient;

      await expect(createServerClientFn()).rejects.toThrow(
        "Your project's URL and API key are required"
      );
    });

    it('should throw error when both environment variables are missing', async () => {
      jest.resetModules();
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

      const serverModule = require('../server');
      const createServerClientFn = serverModule.createServerClient;

      await expect(createServerClientFn()).rejects.toThrow(
        "Your project's URL and API key are required"
      );
    });

    it('should call cookies.getAll correctly', async () => {
      const mockCookieStore = {
        getAll: jest
          .fn()
          .mockReturnValue([{ name: 'auth-token', value: 'token-value' }]),
        set: jest.fn(),
      };
      mockCookies.mockResolvedValue(mockCookieStore);

      await createServerClient();

      // Проверяем, что getAll вызывается через cookies API
      const createServerClientCall = mockCreateServerClientSSR.mock.calls[0];
      const cookiesConfig = createServerClientCall[2].cookies;

      const allCookies = cookiesConfig.getAll();
      expect(allCookies).toEqual([
        { name: 'auth-token', value: 'token-value' },
      ]);
      expect(mockCookieStore.getAll).toHaveBeenCalled();
    });

    it('should call cookies.setAll correctly', async () => {
      const mockCookieStore = {
        getAll: jest.fn().mockReturnValue([]),
        set: jest.fn(),
      };
      mockCookies.mockResolvedValue(mockCookieStore);

      await createServerClient();

      const createServerClientCall = mockCreateServerClientSSR.mock.calls[0];
      const cookiesConfig = createServerClientCall[2].cookies;

      const cookiesToSet = [
        { name: 'new-cookie', value: 'new-value', options: { httpOnly: true } },
      ];

      cookiesConfig.setAll(cookiesToSet);

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'new-cookie',
        'new-value',
        { httpOnly: true }
      );
    });

    it('should handle setAll error gracefully (Server Component case)', async () => {
      const mockCookieStore = {
        getAll: jest.fn().mockReturnValue([]),
        set: jest.fn().mockImplementation(() => {
          throw new Error('Cannot set cookie in Server Component');
        }),
      };
      mockCookies.mockResolvedValue(mockCookieStore);

      // Не должно выбрасывать ошибку
      await expect(createServerClient()).resolves.toBeDefined();

      const createServerClientCall = mockCreateServerClientSSR.mock.calls[0];
      const cookiesConfig = createServerClientCall[2].cookies;

      const cookiesToSet = [
        { name: 'test-cookie', value: 'test-value', options: {} },
      ];

      // Вызов setAll не должен выбрасывать ошибку
      expect(() => {
        cookiesConfig.setAll(cookiesToSet);
      }).not.toThrow();
    });
  });
});
