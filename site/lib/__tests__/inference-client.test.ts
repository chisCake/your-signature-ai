import {
  formatForgeryResult,
  getForgeryColor,
  getServerStatus,
  ForgeryAnalysisResponse,
  HealthResponse,
} from '@/lib/inference-client';

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

    it('should handle boundary case at 85%', () => {
      const resultAt85: ForgeryAnalysisResponse = {
        similarity_score: 0.85,
        is_forgery: false,
        threshold: 0.85,
      };

      const formatted = formatForgeryResult(resultAt85);

      expect(formatted.similarityPercent).toBe(85);
      // 85% не больше 85%, поэтому это подделка (isGenuine = 85 > 85 = false)
      expect(formatted.isForgery).toBe(true);
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

    it('should return yellow for similarity between 80% and 85%', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0.82,
        is_forgery: true,
        threshold: 0.85,
      };

      const color = getForgeryColor(result);

      expect(color).toBe('text-yellow-600');
    });

    it('should return yellow for similarity exactly 81%', () => {
      const result: ForgeryAnalysisResponse = {
        similarity_score: 0.81,
        is_forgery: true,
        threshold: 0.85,
      };

      const color = getForgeryColor(result);

      expect(color).toBe('text-yellow-600');
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

    it('should handle boundary at 85% (exclusive)', () => {
      const resultAt85: ForgeryAnalysisResponse = {
        similarity_score: 0.85,
        is_forgery: false,
        threshold: 0.85,
      };

      const color = getForgeryColor(resultAt85);

      expect(color).toBe('text-yellow-600');
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
});
