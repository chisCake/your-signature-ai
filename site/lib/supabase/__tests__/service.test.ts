// Мокируем @supabase/supabase-js перед импортом
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('supabase/service', () => {
  let mockCreateClient: jest.MockedFunction<any>;
  let createServiceClient: () => any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Устанавливаем переменные окружения
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_SECRET = 'service-role-secret';

    // Импортируем модуль после установки переменных окружения
    const supabaseModule = require('@supabase/supabase-js');
    mockCreateClient = supabaseModule.createClient;
    mockCreateClient.mockReturnValue({} as any);

    // Импортируем тестируемую функцию
    const serviceModule = require('../service');
    createServiceClient = serviceModule.createServiceClient;
  });

  describe('createServiceClient', () => {
    it('should create service client successfully when environment variables are set', () => {
      const client = createServiceClient();

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'service-role-secret',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
      expect(client).toBeDefined();
    });

    it('should throw error when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      jest.resetModules();
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_SECRET = 'service-role-secret';

      const serviceModule = require('../service');
      const createServiceClientFn = serviceModule.createServiceClient;

      expect(() => createServiceClientFn()).toThrow(
        "Your project's URL and service role key are required"
      );
    });

    it('should throw error when SUPABASE_SERVICE_ROLE_SECRET is missing', () => {
      jest.resetModules();
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.SUPABASE_SERVICE_ROLE_SECRET;

      const serviceModule = require('../service');
      const createServiceClientFn = serviceModule.createServiceClient;

      expect(() => createServiceClientFn()).toThrow(
        "Your project's URL and service role key are required"
      );
    });

    it('should throw error when both environment variables are missing', () => {
      jest.resetModules();
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_SECRET;

      const serviceModule = require('../service');
      const createServiceClientFn = serviceModule.createServiceClient;

      expect(() => createServiceClientFn()).toThrow(
        "Your project's URL and service role key are required"
      );
    });

    it('should throw error when NEXT_PUBLIC_SUPABASE_URL is empty string', () => {
      jest.resetModules();
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      process.env.SUPABASE_SERVICE_ROLE_SECRET = 'service-role-secret';

      const serviceModule = require('../service');
      const createServiceClientFn = serviceModule.createServiceClient;

      expect(() => createServiceClientFn()).toThrow(
        "Your project's URL and service role key are required"
      );
    });

    it('should throw error when SUPABASE_SERVICE_ROLE_SECRET is empty string', () => {
      jest.resetModules();
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_SECRET = '';

      const serviceModule = require('../service');
      const createServiceClientFn = serviceModule.createServiceClient;

      expect(() => createServiceClientFn()).toThrow(
        "Your project's URL and service role key are required"
      );
    });

    it('should configure client with correct auth options', () => {
      const client = createServiceClient();

      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    });
  });
});
