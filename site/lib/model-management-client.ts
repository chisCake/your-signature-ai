/**
 * Client for inference model bundle management.
 */

export type SwapStrategy = 'zero_downtime' | 'sequential';

export interface BundleSlotInfo {
  bundle_name: string | null;
  loaded?: boolean;
  ready_for_rollback?: boolean;
}

export interface ModelManagerStatus {
  active_model: string | null;
  current: BundleSlotInfo;
  previous: BundleSlotInfo;
  available_bundles: string[];
  blob_synced_at?: number;
  loader_info?: Record<string, unknown>;
}

export interface UploadModelResponse {
  success: boolean;
  activated?: boolean;
  model_name: string;
  completed_stages?: string[];
  failed_stage?: string;
  message?: string;
  storage?: Record<string, unknown>;
  metadata_summary?: Record<string, unknown>;
}

export interface ActivateModelResponse {
  success: boolean;
  model_name?: string;
  current?: string | null;
  previous?: string | null;
  rolled_back?: boolean;
  message?: string;
}

class ModelManagementClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl =
      process.env.NEXT_PUBLIC_INFERENCE_URL || 'http://localhost:8000';
  }

  async uploadModel(
    modelName: string,
    zipFile: File,
    options: {
      activate?: boolean;
      swapStrategy?: SwapStrategy;
    } = {}
  ): Promise<UploadModelResponse> {
    const formData = new FormData();
    formData.append('model_name', modelName);
    formData.append('bundle_file', zipFile);
    formData.append('activate', String(options.activate ?? false));
    formData.append('swap_strategy', options.swapStrategy ?? 'zero_downtime');

    const response = await fetch(`${this.baseUrl}/model/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        data.message || data.detail || `HTTP ${response.status}`
      );
    }
    return data;
  }

  async getModelStatus(): Promise<ModelManagerStatus> {
    const response = await fetch(`${this.baseUrl}/model/status`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async activateModel(
    modelName: string,
    swapStrategy: SwapStrategy = 'zero_downtime'
  ): Promise<ActivateModelResponse> {
    const formData = new FormData();
    formData.append('model_name', modelName);
    formData.append('swap_strategy', swapStrategy);

    const response = await fetch(`${this.baseUrl}/model/activate`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || data.message || `HTTP ${response.status}`);
    }
    return data;
  }

  async rollbackModel(): Promise<ActivateModelResponse> {
    const response = await fetch(`${this.baseUrl}/model/rollback`, {
      method: 'POST',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `HTTP ${response.status}`);
    }
    return data;
  }

  /** @deprecated use activateModel */
  async swapModel(
    modelName: string,
    swapStrategy: SwapStrategy = 'zero_downtime'
  ): Promise<ActivateModelResponse> {
    return this.activateModel(modelName, swapStrategy);
  }

  async deleteModel(modelName: string): Promise<{ success: boolean; deleted: string }> {
    const response = await fetch(`${this.baseUrl}/model/${modelName}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }
    return response.json();
  }
}

export const modelManagementClient = new ModelManagementClient();
