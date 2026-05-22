import {
  modelManagementClient,
  ModelManagerStatus,
  UploadModelResponse,
} from '../model-management-client';

describe('model-management-client', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadModel', () => {
    it('uploads zip bundle', async () => {
      const mockResponse: UploadModelResponse = {
        success: true,
        activated: false,
        model_name: 'sig-v3',
        completed_stages: ['received', 'blob'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const zipFile = new File(['zip'], 'bundle.zip', {
        type: 'application/zip',
      });

      const result = await modelManagementClient.uploadModel('sig-v3', zipFile, {
        activate: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/model/upload'),
        expect.objectContaining({ method: 'POST' })
      );
      const formData = (mockFetch.mock.calls[0][1] as RequestInit)
        .body as FormData;
      expect(formData.get('bundle_file')).toBeTruthy();
      expect(formData.get('activate')).toBe('false');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getModelStatus', () => {
    it('returns slot status', async () => {
      const mockStatus: ModelManagerStatus = {
        active_model: 'sig-v3',
        current: { bundle_name: 'sig-v3', loaded: true },
        previous: { bundle_name: 'sig-v2', ready_for_rollback: true },
        available_bundles: ['sig-v2', 'sig-v3'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      });

      const result = await modelManagementClient.getModelStatus();
      expect(result).toEqual(mockStatus);
    });
  });

  describe('rollbackModel', () => {
    it('calls rollback endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          rolled_back: true,
          model_name: 'sig-v2',
        }),
      });

      await modelManagementClient.rollbackModel();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/model/rollback'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
