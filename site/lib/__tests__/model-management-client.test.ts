import {
  modelManagementClient,
  ModelManagerStatus,
  ModelStatus,
  UploadModelResponse,
  DeleteModelResponse,
  SwapStrategy,
} from '../model-management-client';

describe('model-management-client', () => {
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

  describe('uploadModel', () => {
    it('should successfully upload model', async () => {
      const mockResponse: UploadModelResponse = {
        success: true,
        strategy: 'zero_downtime',
        new_model: 'model-v2',
        old_model: 'model-v1',
        message: 'Model uploaded successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const ptFile = new File(['pt content'], 'model.pt', {
        type: 'application/octet-stream',
      });
      const pyFile = new File(['py content'], 'model.py', {
        type: 'text/x-python',
      });

      const result = await modelManagementClient.uploadModel(
        'model-v2',
        ptFile,
        pyFile,
        'zero_downtime'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/model/upload'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use zero_downtime strategy by default', async () => {
      const mockResponse: UploadModelResponse = {
        success: true,
        strategy: 'zero_downtime',
        new_model: 'model-v2',
        old_model: null,
        message: 'Model uploaded successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const ptFile = new File(['pt content'], 'model.pt');
      const pyFile = new File(['py content'], 'model.py');

      await modelManagementClient.uploadModel('model-v2', ptFile, pyFile);

      const formData = (mockFetch.mock.calls[0][1] as any).body as FormData;
      expect(formData.get('swap_strategy')).toBe('zero_downtime');
    });

    it('should throw error when response is not ok', async () => {
      const mockHeaders = new Headers();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: mockHeaders,
        json: async () => ({ detail: 'Invalid model files' }),
      });

      const ptFile = new File(['pt content'], 'model.pt');
      const pyFile = new File(['py content'], 'model.py');

      await expect(
        modelManagementClient.uploadModel('model-v2', ptFile, pyFile)
      ).rejects.toThrow('Invalid model files');
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockImplementationOnce(() => {
        return Promise.reject(new Error('Network error'));
      });

      const ptFile = new File(['pt content'], 'model.pt');
      const pyFile = new File(['py content'], 'model.py');

      await expect(
        modelManagementClient.uploadModel('model-v2', ptFile, pyFile)
      ).rejects.toThrow();
    });
  });

  describe('getModelStatus', () => {
    it('should return model status successfully', async () => {
      const mockStatus: ModelManagerStatus = {
        active_model: 'model-v1',
        models: {
          'model-v1': {
            name: 'model-v1',
            state: 'active',
            is_active: true,
            is_ready: true,
            created_at: Date.now(),
            last_used: Date.now(),
          },
        },
        total_models: 1,
        storage_registry: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      });

      const result = await modelManagementClient.getModelStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/model/status'),
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toEqual(mockStatus);
    });

    it('should throw error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: 'Server error' }),
      });

      await expect(modelManagementClient.getModelStatus()).rejects.toThrow(
        'Server error'
      );
    });

    it('should handle 404 error with custom message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(modelManagementClient.getModelStatus()).rejects.toThrow(
        'Not Found'
      );
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockImplementationOnce(() => {
        return Promise.reject(new Error('Network error'));
      });

      await expect(modelManagementClient.getModelStatus()).rejects.toThrow();
    });
  });

  describe('swapModel', () => {
    it('should successfully swap model', async () => {
      const mockResponse: UploadModelResponse = {
        success: true,
        strategy: 'zero_downtime',
        new_model: 'model-v2',
        old_model: 'model-v1',
        message: 'Model swapped successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await modelManagementClient.swapModel(
        'model-v2',
        'zero_downtime'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/model/swap'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use zero_downtime strategy by default', async () => {
      const mockResponse: UploadModelResponse = {
        success: true,
        strategy: 'zero_downtime',
        new_model: 'model-v2',
        old_model: null,
        message: 'Model swapped successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await modelManagementClient.swapModel('model-v2');

      const formData = (mockFetch.mock.calls[0][1] as any).body as FormData;
      expect(formData.get('swap_strategy')).toBe('zero_downtime');
    });

    it('should throw error when response is not ok', async () => {
      const mockHeaders = new Headers();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: mockHeaders,
        json: async () => ({ detail: 'Model not found' }),
      });

      await expect(
        modelManagementClient.swapModel('non-existent-model')
      ).rejects.toThrow('Model not found');
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockImplementationOnce(() => {
        return Promise.reject(new Error('Network error'));
      });

      await expect(
        modelManagementClient.swapModel('model-v2')
      ).rejects.toThrow();
    });
  });

  describe('deleteModel', () => {
    it('should successfully delete model', async () => {
      const mockResponse: DeleteModelResponse = {
        success: true,
        model_name: 'model-v1',
        deleted_files: ['model.pt', 'model.py'],
        message: 'Model deleted successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await modelManagementClient.deleteModel('model-v1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/model/model-v1'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when response is not ok', async () => {
      const mockHeaders = new Headers();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: mockHeaders,
        json: async () => ({ detail: 'Model not found' }),
      });

      await expect(
        modelManagementClient.deleteModel('non-existent-model')
      ).rejects.toThrow('Model not found');
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockImplementationOnce(() => {
        return Promise.reject(new Error('Network error'));
      });

      await expect(
        modelManagementClient.deleteModel('model-v1')
      ).rejects.toThrow();
    });
  });
});
