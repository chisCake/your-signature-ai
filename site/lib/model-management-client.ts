/**
 * Клиент для управления моделями через API inference сервера
 */

export type SwapStrategy = 'zero_downtime' | 'sequential';

export interface ModelStorageInfo {
  type: 'local' | 'blob';
  py_blob_path?: string;
  pt_blob_path?: string;
  py_download_url?: string;
  pt_download_url?: string;
  py_size?: number;
  pt_size?: number;
  synced_at?: number;
}

export interface ModelStatus {
  name: string;
  state: 'loading' | 'ready' | 'active' | 'unloading' | 'error';
  is_active: boolean;
  is_ready: boolean;
  error?: string;
  created_at: number;
  last_used: number;
  model_info?: {
    path: string;
    device: string;
    model_type: string;
    architecture: string;
    config?: {
      in_features: number;
      conv_channels: number[];
      gru_hidden: number;
      gru_layers: number;
      embedding_dim: number;
      dropout: number;
    };
    total_parameters?: number;
    trainable_parameters?: number;
  };
  model_info_error?: string;
  storage?: ModelStorageInfo;
}

export interface ModelManagerStatus {
  active_model: string | null;
  models: Record<string, ModelStatus>;
  total_models: number;
  storage_registry: Record<string, ModelStorageInfo>;
}

export interface UploadModelResponse {
  success: boolean;
  strategy: SwapStrategy;
  new_model: string;
  old_model: string | null;
  message: string;
  storage?: ModelStorageInfo;
}

export interface DeleteModelResponse {
  success: boolean;
  model_name: string;
  deleted_files: string[];
  message: string;
}

class ModelManagementClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl =
      process.env.NEXT_PUBLIC_INFERENCE_URL || 'http://localhost:8000';
  }

  /**
   * Загрузка новой модели
   */
  async uploadModel(
    modelName: string,
    ptFile: File,
    pyFile: File,
    swapStrategy: SwapStrategy = 'zero_downtime'
  ): Promise<UploadModelResponse> {
    const formData = new FormData();
    formData.append('model_name', modelName);
    formData.append('pt_file', ptFile);
    formData.append('py_file', pyFile);
    formData.append('swap_strategy', swapStrategy);

    const response = await fetch(`${this.baseUrl}/model/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Получение статуса всех моделей
   */
  async getModelStatus(): Promise<ModelManagerStatus> {
    const response = await fetch(`${this.baseUrl}/model/status`, {
      method: 'GET',
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch {
        // Если не удалось распарсить JSON, используем стандартное сообщение
        if (response.status === 404) {
          errorMessage = 'Not Found';
        }
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Переключение на существующую модель
   */
  async swapModel(
    modelName: string,
    swapStrategy: SwapStrategy = 'zero_downtime'
  ): Promise<UploadModelResponse> {
    const formData = new FormData();
    formData.append('model_name', modelName);
    formData.append('swap_strategy', swapStrategy);

    const response = await fetch(`${this.baseUrl}/model/swap`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Удаление модели
   */
  async deleteModel(modelName: string): Promise<DeleteModelResponse> {
    const response = await fetch(`${this.baseUrl}/model/${modelName}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }
}

export const modelManagementClient = new ModelManagementClient();
