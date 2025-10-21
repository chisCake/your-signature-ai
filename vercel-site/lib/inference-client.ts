/**
 * Утилита для работы с inference сервером
 * Отправляет запросы на сервер для анализа подделок подписей
 */

import { useState } from 'react';

interface ForgeryAnalysisResponse {
  original_embedding: number[];
  forgery_embedding: number[];
  similarity_score: number;
  is_forgery: boolean;
  threshold: number;
}

interface HealthResponse {
  status: string;
  supabase_connected: boolean;
  model_loaded: boolean;
  model_info?: {
    path: string;
    device: string;
    model_type: string;
    architecture: string;
    config: {
      in_features: number;
      conv_channels: number[];
      gru_hidden: number;
      gru_layers: number;
      embedding_dim: number;
      dropout: number;
    };
    total_parameters: number;
    trainable_parameters: number;
  };
}

export type { ForgeryAnalysisResponse, HealthResponse };

interface InferenceServerConfig {
  baseUrl: string;
  timeout: number;
}

class InferenceServerClient {
  private config: InferenceServerConfig;

  constructor() {
    this.config = {
      baseUrl: process.env.NEXT_PUBLIC_INFERENCE_SERVER_URL || 'http://localhost:8000',
      timeout: 30000, // 30 секунд
    };
  }

  /**
   * Анализ подделки по ID оригинальной подписи и ID подделки
   */
  async analyzeForgeryById(
    originalId: string,
    forgeryId: string
  ): Promise<ForgeryAnalysisResponse> {
    try {
      const requestData = {
        original_id: originalId,
        forgery_id: forgeryId,
      };
      
      // console.log('Sending forgery-by-id request:', requestData);
      // console.log('Request URL:', `${this.config.baseUrl}/forgery-by-id/`);
      // console.log('Request headers:', {
      //   'Content-Type': 'application/json',
      // });
      // console.log('Request body stringified:', JSON.stringify(requestData));
      
      const response = await fetch(`${this.config.baseUrl}/forgery-by-id/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Forgery-by-id request failed:', response.status, errorData);
        console.error('Response headers:', Object.fromEntries(response.headers.entries()));
        console.error('Response status text:', response.statusText);
        throw new Error(
          errorData.detail || 
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      // console.log('Forgery-by-id response:', data);
      return data;
    } catch (error) {
      console.error('Error analyzing forgery by ID:', error);
      throw error;
    }
  }

  /**
   * Анализ подделки по ID оригинальной подписи и CSV данным подделки
   */
  async analyzeForgeryByData(
    originalId: string,
    forgeryData: string | number[][]
  ): Promise<ForgeryAnalysisResponse> {
    try {
      // console.log('Sending request to:', `${this.config.baseUrl}/forgery-by-data/`);
      // console.log('Request data:', { originalId, forgeryDataType: typeof forgeryData });
      
      const response = await fetch(`${this.config.baseUrl}/forgery-by-data/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          original_id: originalId,
          forgery_data: forgeryData,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || 
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      // console.log('Server response:', data);
      return data;
    } catch (error) {
      console.error('Error analyzing forgery by data:', error);
      throw error;
    }
  }

  /**
   * Проверить статус inference сервера
   */
  async checkHealth(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 секунд для health check
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Inference server health check failed:', error);
      throw error;
    }
  }

  /**
   * Получить информацию о сервере
   */
  async getServerInfo(): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(`${this.config.baseUrl}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting server info:', error);
      throw error;
    }
  }
}

// Экспортируем singleton instance
export const inferenceClient = new InferenceServerClient();

/**
 * Хук для работы с inference сервером
 */
export function useInferenceServer() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeForgeryById = async (
    originalId: string,
    forgeryId: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await inferenceClient.analyzeForgeryById(
        originalId,
        forgeryId
      );
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeForgeryByData = async (
    originalId: string,
    forgeryData: string | number[][]
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await inferenceClient.analyzeForgeryByData(
        originalId,
        forgeryData
      );
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const checkHealth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const healthData = await inferenceClient.checkHealth();
      return healthData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getServerInfo = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const info = await inferenceClient.getServerInfo();
      return info;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    analyzeForgeryById,
    analyzeForgeryByData,
    checkHealth,
    getServerInfo,
    isLoading,
    error,
  };
}

/**
 * Утилита для форматирования результата анализа подделки
 * 
 * TODO: вынести пороги
 */
export function formatForgeryResult(result: ForgeryAnalysisResponse) {
  const similarityPercent = Math.max(Math.round(result.similarity_score * 100), 0);
  // Определяем подлинность на фронтенде: >90% -> подлинная, иначе подделка
  const isGenuine = similarityPercent > 85;
  const threshold = 85; // Фронтенд порог

  return {
    similarityPercent,
    isForgery: !isGenuine, // Обратная логика для совместимости
    threshold,
    similarityScore: result.similarity_score,
    message: isGenuine 
      ? `Подпись признана подлинной (${similarityPercent}% схожести, порог: ${threshold}%)`
      : `Подпись признана поддельной (${similarityPercent > 0 ? similarityPercent : 0}% схожести, порог: ${threshold}%)`,
  };
}

/**
 * Утилита для определения цвета результата анализа
 */
export function getForgeryColor(result: ForgeryAnalysisResponse) {
  const similarityPercent = Math.round(result.similarity_score * 100);
  if (similarityPercent > 85) return 'text-green-600'; // Подлинная
  if (similarityPercent > 80) return 'text-yellow-600'; // Сомнительная
  return 'text-red-600'; // Поддельная
}

/**
 * Утилита для определения статуса сервера
 */
export function getServerStatus(healthData: HealthResponse) {
  if (!healthData.supabase_connected || !healthData.model_loaded) {
    return {
      status: 'error',
      message: 'Сервер недоступен',
      color: 'text-red-600'
    };
  }
  
  if (healthData.status === 'healthy') {
    return {
      status: 'healthy',
      message: 'Сервер работает нормально',
      color: 'text-green-600'
    };
  }
  
  return {
    status: 'warning',
    message: 'Сервер работает с предупреждениями',
    color: 'text-yellow-600'
  };
}

export default inferenceClient;
