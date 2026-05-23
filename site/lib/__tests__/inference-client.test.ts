import {
  formatForgeryResult,
  getForgeryColor,
  getServerStatus,
  ForgeryAnalysisResponse,
  HealthResponse,
  inferenceClient,
  useInferenceServer,
} from '@/lib/inference-client';
import { renderHook, waitFor, act } from '@testing-library/react';

describe('inference-client formatting utilities', () => {
  describe('formatForgeryResult', () => {
    it('should format result as genuine when similarity > 85%', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0.9,
        is_forgery: false,
        threshold: 0.85,
      };

      const formatted = formatForgeryResult(result);

      expect(formatted.similarityPercent).toBe(90);
      expect(formatted.isForgery).toBe(false);
      expect(formatted.threshold).toBe(85);
      expect(formatted.similarityScore).toBe(0.9);
      expect(formatted.message).toContain('подлинной');
      expect(formatted.message).toContain('90%');
    });

    it('should format result as forgery when similarity <= 85%', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0.8,
        is_forgery: true,
        threshold: 0.85,
      };

      const formatted = formatForgeryResult(result);

      expect(formatted.similarityPercent).toBe(80);
      expect(formatted.isForgery).toBe(true);
      expect(formatted.threshold).toBe(85);
      expect(formatted.similarityScore).toBe(0.8);
      expect(formatted.message).toContain('поддельной');
      expect(formatted.message).toContain('80%');
    });

    it('should respect API is_forgery at boundary threshold', () => {
      const resultAt85: ForgeryAnalysisResponse = {
        similarity_score: 0.85,
        is_forgery: false,
        threshold: 0.85,
      };

      const formatted = formatForgeryResult(resultAt85);

      expect(formatted.similarityPercent).toBe(85);
      expect(formatted.isForgery).toBe(false);
    });

    it('should handle boundary case just below 85%', () => {
      const resultJustBelow: ForgeryAnalysisResponse = {
        similarity_score: 0.849,
        is_forgery: true,
        threshold: 0.85,
      };

      const formatted = formatForgeryResult(resultJustBelow);

      expect(formatted.similarityPercent).toBe(85);
      expect(formatted.isForgery).toBe(true);
    });

    it('should handle zero similarity score', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0,
        is_forgery: true,
        threshold: 0.85,
      };

      const formatted = formatForgeryResult(result);

      expect(formatted.similarityPercent).toBe(0);
      expect(formatted.isForgery).toBe(true);
      expect(formatted.message).toContain('0%');
    });

    it('should handle negative similarity score (clamp to 0)', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: -0.1,
        is_forgery: true,
        threshold: 0.85,
      };

      const formatted = formatForgeryResult(result);

      expect(formatted.similarityPercent).toBe(0);
      expect(formatted.isForgery).toBe(true);
    });

    it('should round similarity percent correctly', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0.856,
        is_forgery: false,
        threshold: 0.85,
      };

      const formatted = formatForgeryResult(result);

      expect(formatted.similarityPercent).toBe(86);
    });

    it('should handle very high similarity scores', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0.99,
        is_forgery: false,
        threshold: 0.85,
      };

      const formatted = formatForgeryResult(result);

      expect(formatted.similarityPercent).toBe(99);
      expect(formatted.isForgery).toBe(false);
    });

    it('should format not-a-signature rejection', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0,
        is_forgery: true,
        is_not_signature: true,
        rejection_reason: 'input_not_a_signature',
        threshold: 0.47,
        anomaly_score: 12.5,
        anomaly_threshold: 8.0,
      };

      const formatted = formatForgeryResult(result);

      expect(formatted.isNotSignature).toBe(true);
      expect(formatted.message).toContain('не похож на подпись');
      expect(getForgeryColor(result)).toBe('text-amber-600');
    });
  });

  describe('getForgeryColor', () => {
    it('should return green for similarity > 85%', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0.9,
        is_forgery: false,
        threshold: 0.85,
      };

      const color = getForgeryColor(result);

      expect(color).toBe('text-green-600');
    });

    it('should return green for similarity exactly 86%', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0.86,
        is_forgery: false,
        threshold: 0.85,
      };

      const color = getForgeryColor(result);

      expect(color).toBe('text-green-600');
    });

    it('should return red when is_forgery is true', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0.82,
        is_forgery: true,
        threshold: 0.85,
      };

      const color = getForgeryColor(result);

      expect(color).toBe('text-red-600');
    });

    it('should return red for forgery at 81% similarity', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0.81,
        is_forgery: true,
        threshold: 0.85,
      };

      const color = getForgeryColor(result);

      expect(color).toBe('text-red-600');
    });

    it('should return red for similarity <= 80%', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0.75,
        is_forgery: true,
        threshold: 0.85,
      };

      const color = getForgeryColor(result);

      expect(color).toBe('text-red-600');
    });

    it('should return red for similarity exactly 80%', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0.8,
        is_forgery: true,
        threshold: 0.85,
      };

      const color = getForgeryColor(result);

      expect(color).toBe('text-red-600');
    });

    it('should return red for zero similarity', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0,
        is_forgery: true,
        threshold: 0.85,
      };

      const color = getForgeryColor(result);

      expect(color).toBe('text-red-600');
    });

    it('should return green when not forgery at threshold', () => {
      const resultAt85: ForgeryAnalysisResponse = {
        similarity_score: 0.85,
        is_forgery: false,
        threshold: 0.85,
      };

      const color = getForgeryColor(resultAt85);

      expect(color).toBe('text-green-600');
    });
  });

  describe('getServerStatus', () => {
    it('should return error status when supabase is not connected', () => {
      const healthData: HealthResponse = {
        status: 'unhealthy',
        supabase_connected: false,
        model_loaded: true,
      };

      const status = getServerStatus(healthData);

      expect(status.status).toBe('error');
      expect(status.message).toBe('Сервер недоступен');
      expect(status.color).toBe('text-red-600');
    });

    it('should return error status when model is not loaded', () => {
      const healthData: HealthResponse = {
        status: 'unhealthy',
        supabase_connected: true,
        model_loaded: false,
      };

      const status = getServerStatus(healthData);

      expect(status.status).toBe('error');
      expect(status.message).toBe('Сервер недоступен');
      expect(status.color).toBe('text-red-600');
    });

    it('should return error status when both are false', () => {
      const healthData: HealthResponse = {
        status: 'unhealthy',
        supabase_connected: false,
        model_loaded: false,
      };

      const status = getServerStatus(healthData);

      expect(status.status).toBe('error');
      expect(status.message).toBe('Сервер недоступен');
      expect(status.color).toBe('text-red-600');
    });

    it('should return healthy status when all conditions are met', () => {
      const healthData: HealthResponse = {
        status: 'healthy',
        supabase_connected: true,
        model_loaded: true,
      };

      const status = getServerStatus(healthData);

      expect(status.status).toBe('healthy');
      expect(status.message).toBe('Сервер работает нормально');
      expect(status.color).toBe('text-green-600');
    });

    it('should return warning status when connected but status is not healthy', () => {
      const healthData: HealthResponse = {
        status: 'degraded',
        supabase_connected: true,
        model_loaded: true,
      };

      const status = getServerStatus(healthData);

      expect(status.status).toBe('warning');
      expect(status.message).toBe('Сервер работает с предупреждениями');
      expect(status.color).toBe('text-yellow-600');
    });

    it('should return warning status for unknown status', () => {
      const healthData: HealthResponse = {
        status: 'unknown',
        supabase_connected: true,
        model_loaded: true,
      };

      const status = getServerStatus(healthData);

      expect(status.status).toBe('warning');
      expect(status.message).toBe('Сервер работает с предупреждениями');
      expect(status.color).toBe('text-yellow-600');
    });
  });

  describe('InferenceServerClient', () => {
    // Мокируем global fetch
    let mockFetch: jest.Mock;

    beforeEach(() => {
      // Создаем новый мок для каждого теста
      mockFetch = jest.fn();
      global.fetch = mockFetch as any;
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('analyzeForgeryById', () => {
      it('should successfully analyze forgery by ID', async () => {
        const mockResponse: ForgeryAnalysisResponse = {
          similarity_score: 0.9,
          is_forgery: false,
          threshold: 0.85,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await inferenceClient.analyzeForgeryById(
          'orig-1',
          'forgery-1'
        );

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/forgery-by-id/'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              original_id: 'orig-1',
              forgery_id: 'forgery-1',
            }),
          })
        );
        expect(result).toEqual(mockResponse);
      });

      it('should throw error when response is not ok', async () => {
        const mockHeaders = new Headers();
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: mockHeaders,
          json: async () => ({ detail: 'Server error' }),
        });

        await expect(
          inferenceClient.analyzeForgeryById('orig-1', 'forgery-1')
        ).rejects.toThrow();
      });

      it('should throw error when fetch fails', async () => {
        const networkError = new Error('Network error');
        // Используем mockImplementation для правильной обработки ошибок
        // Важно: мок должен возвращать rejected Promise, а не выбрасывать синхронно
        mockFetch.mockImplementationOnce(() => {
          return Promise.reject(networkError);
        });

        // Когда fetch падает, ошибка перехватывается и выбрасывается снова
        await expect(
          inferenceClient.analyzeForgeryById('orig-1', 'forgery-1')
        ).rejects.toThrow();
      });
    });

    describe('analyzeForgeryByData', () => {
      it('should successfully analyze forgery by data', async () => {
        const mockResponse: ForgeryAnalysisResponse = {
          similarity_score: 0.75,
          is_forgery: true,
          threshold: 0.85,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const forgeryData = 't,x,y,p\n100,10,20,0.5';
        const result = await inferenceClient.analyzeForgeryByData(
          'orig-1',
          forgeryData
        );

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/forgery-by-data/'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              original_id: 'orig-1',
              forgery_data: forgeryData,
            }),
          })
        );
        expect(result).toEqual(mockResponse);
      });

      it('should handle array data format', async () => {
        const mockResponse: ForgeryAnalysisResponse = {
          similarity_score: 0.8,
          is_forgery: true,
          threshold: 0.85,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const forgeryData = [[100, 10, 20, 0.5]];
        const result = await inferenceClient.analyzeForgeryByData(
          'orig-1',
          forgeryData
        );

        expect(result).toEqual(mockResponse);
      });

      it('should throw error when response is not ok', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({ detail: 'Invalid data' }),
        });

        await expect(
          inferenceClient.analyzeForgeryByData('orig-1', 'invalid')
        ).rejects.toThrow();
      });
    });

    describe('checkHealth', () => {
      it('should return health data when server is healthy', async () => {
        const mockHealth: HealthResponse = {
          status: 'healthy',
          supabase_connected: true,
          model_loaded: true,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockHealth,
        });

        const result = await inferenceClient.checkHealth();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/health'),
          expect.objectContaining({
            method: 'GET',
          })
        );
        expect(result).toEqual(mockHealth);
      });

      it('should throw error when health check fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        });

        await expect(inferenceClient.checkHealth()).rejects.toThrow();
      });
    });

    describe('getServerInfo', () => {
      it('should return server info', async () => {
        const mockInfo = { version: '1.0.0', status: 'running' };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockInfo,
        });

        const result = await inferenceClient.getServerInfo();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/'),
          expect.objectContaining({
            method: 'GET',
          })
        );
        expect(result).toEqual(mockInfo);
      });

      it('should throw error when request fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

        await expect(inferenceClient.getServerInfo()).rejects.toThrow();
      });
    });
  });

  describe('useInferenceServer', () => {
    // Мокируем global fetch
    let mockFetch: jest.Mock;

    beforeEach(() => {
      // Создаем новый мок для каждого теста
      mockFetch = jest.fn();
      global.fetch = mockFetch as any;
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('analyzeForgeryById', () => {
      it('should return result and clear error', async () => {
        const mockResponse: ForgeryAnalysisResponse = {
          similarity_score: 0.9,
          is_forgery: false,
          threshold: 0.85,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const { result } = renderHook(() => useInferenceServer());

        let analysisResult: ForgeryAnalysisResponse;
        await act(async () => {
          analysisResult = await result.current.analyzeForgeryById(
            'orig-1',
            'forgery-1'
          );
        });

        // Проверяем результат и что ошибка очищена
        expect(analysisResult!).toEqual(mockResponse);
        await waitFor(() => {
          expect(result.current.error).toBeNull();
        });
      });

      it('should set error state when request fails', async () => {
        mockFetch.mockImplementationOnce(() => {
          return Promise.reject(new Error('Network error'));
        });

        const { result } = renderHook(() => useInferenceServer());

        await act(async () => {
          await expect(
            result.current.analyzeForgeryById('orig-1', 'forgery-1')
          ).rejects.toThrow();
        });

        await waitFor(() => {
          expect(result.current.error).toBe('Network error');
        });
      });

      it('should clear error on new request', async () => {
        // Первый запрос с ошибкой
        mockFetch.mockImplementationOnce(() => {
          return Promise.reject(new Error('First error'));
        });

        const { result } = renderHook(() => useInferenceServer());

        await act(async () => {
          await expect(
            result.current.analyzeForgeryById('orig-1', 'forgery-1')
          ).rejects.toThrow();
        });

        expect(result.current.error).toBe('First error');

        // Второй запрос успешный
        const mockResponse: ForgeryAnalysisResponse = {
          similarity_score: 0.9,
          is_forgery: false,
          threshold: 0.85,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        await act(async () => {
          await result.current.analyzeForgeryById('orig-2', 'forgery-2');
        });

        await waitFor(() => {
          expect(result.current.error).toBeNull();
        });
      });
    });

    describe('analyzeForgeryByData', () => {
      it('should return result and clear error', async () => {
        const mockResponse: ForgeryAnalysisResponse = {
          similarity_score: 0.75,
          is_forgery: true,
          threshold: 0.85,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const { result } = renderHook(() => useInferenceServer());

        const forgeryData = 't,x,y,p\n100,10,20,0.5';
        let analysisResult: ForgeryAnalysisResponse;

        await act(async () => {
          analysisResult = await result.current.analyzeForgeryByData(
            'orig-1',
            forgeryData
          );
        });

        expect(analysisResult!).toEqual(mockResponse);
        await waitFor(() => {
          expect(result.current.error).toBeNull();
        });
      });

      it('should handle array data format', async () => {
        const mockResponse: ForgeryAnalysisResponse = {
          similarity_score: 0.8,
          is_forgery: true,
          threshold: 0.85,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const { result } = renderHook(() => useInferenceServer());

        const forgeryData = [[100, 10, 20, 0.5]];
        let analysisResult: ForgeryAnalysisResponse;

        await act(async () => {
          analysisResult = await result.current.analyzeForgeryByData(
            'orig-1',
            forgeryData
          );
        });

        expect(analysisResult!).toEqual(mockResponse);
      });

      it('should set error state when request fails', async () => {
        mockFetch.mockImplementationOnce(() => {
          return Promise.reject(new Error('Server error'));
        });

        const { result } = renderHook(() => useInferenceServer());

        await act(async () => {
          await expect(
            result.current.analyzeForgeryByData('orig-1', 'invalid')
          ).rejects.toThrow();
        });

        await waitFor(() => {
          expect(result.current.error).toBe('Server error');
        });
      });
    });

    describe('checkHealth', () => {
      it('should return health data and clear error', async () => {
        const mockHealth: HealthResponse = {
          status: 'healthy',
          supabase_connected: true,
          model_loaded: true,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockHealth,
        });

        const { result } = renderHook(() => useInferenceServer());

        let healthResult: HealthResponse;

        await act(async () => {
          healthResult = await result.current.checkHealth();
        });

        expect(healthResult!).toEqual(mockHealth);
        await waitFor(() => {
          expect(result.current.error).toBeNull();
        });
      });

      it('should set error state when health check fails', async () => {
        mockFetch.mockImplementationOnce(() => {
          return Promise.reject(new Error('Connection failed'));
        });

        const { result } = renderHook(() => useInferenceServer());

        await act(async () => {
          await expect(result.current.checkHealth()).rejects.toThrow();
        });

        await waitFor(() => {
          expect(result.current.error).toBe('Connection failed');
        });
      });
    });

    describe('getServerInfo', () => {
      it('should return server info and clear error', async () => {
        const mockInfo = { version: '1.0.0', status: 'running' };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockInfo,
        });

        const { result } = renderHook(() => useInferenceServer());

        let infoResult: Record<string, unknown>;

        await act(async () => {
          infoResult = await result.current.getServerInfo();
        });

        expect(infoResult!).toEqual(mockInfo);
        await waitFor(() => {
          expect(result.current.error).toBeNull();
        });
      });

      it('should set error state when request fails', async () => {
        mockFetch.mockImplementationOnce(() => {
          return Promise.reject(new Error('Server unavailable'));
        });

        const { result } = renderHook(() => useInferenceServer());

        await act(async () => {
          await expect(result.current.getServerInfo()).rejects.toThrow();
        });

        await waitFor(() => {
          expect(result.current.error).toBe('Server unavailable');
        });
      });
    });
  });
});
