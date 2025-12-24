// Мокируем @supabase/ssr перед импортом
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(),
}));

// Мокируем переменные окружения перед импортом модуля
const mockEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'test-key',
};

describe('supabase/client', () => {
  let mockCreateBrowserClientSSR: jest.MockedFunction<any>;
  let createBrowserClient: () => any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Устанавливаем переменные окружения
    process.env.NEXT_PUBLIC_SUPABASE_URL = mockEnv.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY =
      mockEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    // Импортируем модуль после установки переменных окружения
    const ssrModule = require('@supabase/ssr');
    mockCreateBrowserClientSSR = ssrModule.createBrowserClient;
    mockCreateBrowserClientSSR.mockReturnValue({} as any);

    // Импортируем тестируемую функцию
    const clientModule = require('../client');
    createBrowserClient = clientModule.createBrowserClient;
  });

  describe('createBrowserClient', () => {
    it('should create client successfully when environment variables are set', () => {
      const client = createBrowserClient();

      expect(mockCreateBrowserClientSSR).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-key'
      );
      expect(client).toBeDefined();
    });

    it('should throw error when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      jest.resetModules();
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'test-key';

      const clientModule = require('../client');
      const createBrowserClientFn = clientModule.createBrowserClient;

      expect(() => createBrowserClientFn()).toThrow(
        "Your project's URL and API key are required"
      );
    });

    it('should throw error when NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY is missing', () => {
      jest.resetModules();
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

      const clientModule = require('../client');
      const createBrowserClientFn = clientModule.createBrowserClient;

      expect(() => createBrowserClientFn()).toThrow(
        "Your project's URL and API key are required"
      );
    });

    it('should throw error when both environment variables are missing', () => {
      jest.resetModules();
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

      const clientModule = require('../client');
      const createBrowserClientFn = clientModule.createBrowserClient;

      expect(() => createBrowserClientFn()).toThrow(
        "Your project's URL and API key are required"
      );
    });

    it('should throw error when NEXT_PUBLIC_SUPABASE_URL is empty string', () => {
      jest.resetModules();
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'test-key';

      const clientModule = require('../client');
      const createBrowserClientFn = clientModule.createBrowserClient;

      expect(() => createBrowserClientFn()).toThrow(
        "Your project's URL and API key are required"
      );
    });

    it('should throw error when NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY is empty string', () => {
      jest.resetModules();
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = '';

      const clientModule = require('../client');
      const createBrowserClientFn = clientModule.createBrowserClient;

      expect(() => createBrowserClientFn()).toThrow(
        "Your project's URL and API key are required"
      );
    });
  });
});
