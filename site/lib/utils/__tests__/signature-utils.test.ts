import {
  csvStringToPoints,
  csvToPoints,
  downloadSignatureAsPNG,
  formatSignatureDate,
  formatSignatureDateTime,
  generateSignaturePNG,
  generateSignaturePreview,
  getForgedSignatureOwnerId,
  getGenuineSignatureOwnerId,
  getShortSignatureId,
  getSignatureOwnerId,
  getSignatureStats,
  isSignatureBelongsToProfile,
  isValidSignature,
  pointsToCSV,
  prepareForgedSignatureDataForInsert,
  prepareGenuineSignatureDataForInsert,
} from '@/lib/utils/signature-utils';
import {
  createTestCSV,
  createTestForgedSignature,
  createTestGenuineSignature,
  createTestPoints,
  createTestSignature,
} from '@/lib/__tests__/test-helpers';
import { SignaturePoint } from '@/lib/types';

// Мокируем зависимости для новых тестов
jest.mock('@/lib/utils/auth-client-utils', () => ({
  getUser: jest.fn(),
}));

jest.mock('@/components/ui/alert-dialog', () => ({
  confirm: jest.fn(),
}));

describe('signature-utils', () => {
  describe('pointsToCSV', () => {
    it('should convert points array to CSV string', () => {
      const points: SignaturePoint[] = [
        { timestamp: 1000, x: 10, y: 20, pressure: 0.5 },
        { timestamp: 1010, x: 15, y: 25, pressure: 0.6 },
      ];

      const csv = pointsToCSV(points);

      expect(csv).toBe('t,x,y,p\n1000,10,20,0.5\n1010,15,25,0.6');
    });

    it('should handle empty array', () => {
      const csv = pointsToCSV([]);
      expect(csv).toBe('t,x,y,p\n');
    });
  });

  describe('csvStringToPoints', () => {
    it('should convert CSV string to points array', () => {
      const csv = 't,x,y,p\n1000,10,20,0.5\n1010,15,25,0.6';
      const points = csvStringToPoints(csv);

      expect(points).toEqual([
        { timestamp: 1000, x: 10, y: 20, pressure: 0.5 },
        { timestamp: 1010, x: 15, y: 25, pressure: 0.6 },
      ]);
    });

    it('should handle empty CSV', () => {
      const csv = 't,x,y,p\n';
      const points = csvStringToPoints(csv);
      expect(points).toEqual([]);
    });

    it('should handle CSV with whitespace', () => {
      const csv = 't,x,y,p\n  1000,10,20,0.5  \n  1010,15,25,0.6  ';
      const points = csvStringToPoints(csv);

      expect(points).toEqual([
        { timestamp: 1000, x: 10, y: 20, pressure: 0.5 },
        { timestamp: 1010, x: 15, y: 25, pressure: 0.6 },
      ]);
    });
  });

  describe('round-trip conversion', () => {
    it('should convert points to CSV and back correctly', () => {
      const originalPoints = createTestPoints(10);
      const csv = pointsToCSV(originalPoints);
      const convertedPoints = csvStringToPoints(csv);

      expect(convertedPoints).toEqual(originalPoints);
    });
  });

  describe('csvToPoints', () => {
    it('should extract points from genuine signature', () => {
      const points = createTestPoints(5);
      const signature = createTestSignature('genuine', { points });

      const extractedPoints = csvToPoints(signature);

      expect(extractedPoints).toEqual(points);
    });

    it('should extract points from forged signature', () => {
      const points = createTestPoints(5);
      const signature = createTestSignature('forged', { points });

      const extractedPoints = csvToPoints(signature);

      expect(extractedPoints).toEqual(points);
    });
  });

  describe('isValidSignature', () => {
    it('should return true for signature with enough points', () => {
      const signature = createTestSignature('genuine', {
        points: createTestPoints(15),
      });

      expect(isValidSignature(signature, 10)).toBe(true);
    });

    it('should return false for signature with too few points', () => {
      const signature = createTestSignature('genuine', {
        points: createTestPoints(5),
      });

      expect(isValidSignature(signature, 10)).toBe(false);
    });

    it('should use default minPoints of 10', () => {
      const signatureWith10 = createTestSignature('genuine', {
        points: createTestPoints(10),
      });
      const signatureWith9 = createTestSignature('genuine', {
        points: createTestPoints(9),
      });

      expect(isValidSignature(signatureWith10)).toBe(true);
      expect(isValidSignature(signatureWith9)).toBe(false);
    });
  });

  describe('getSignatureStats', () => {
    it('should calculate stats for signature with points', () => {
      const points: SignaturePoint[] = [
        { timestamp: 1000, x: 10, y: 20, pressure: 0.5 },
        { timestamp: 1010, x: 15, y: 25, pressure: 0.6 },
        { timestamp: 1020, x: 20, y: 30, pressure: 0.7 },
      ];
      const signature = createTestSignature('genuine', { points });

      const stats = getSignatureStats(signature);

      expect(stats.pointCount).toBe(3);
      expect(stats.duration).toBe(0.02); // (1020 - 1000) / 1000
      expect(stats.averagePressure).toBeCloseTo(0.6, 1);
      expect(stats.bounds.minX).toBe(10);
      expect(stats.bounds.maxX).toBe(20);
      expect(stats.bounds.minY).toBe(20);
      expect(stats.bounds.maxY).toBe(30);
      expect(stats.bounds.width).toBe(10);
      expect(stats.bounds.height).toBe(10);
    });

    it('should return zero stats for empty signature', () => {
      const signature = createTestSignature('genuine', { points: [] });

      const stats = getSignatureStats(signature);

      expect(stats.pointCount).toBe(0);
      expect(stats.duration).toBe(0);
      expect(stats.averagePressure).toBe(0);
      expect(stats.bounds).toEqual({
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        width: 0,
        height: 0,
      });
    });
  });

  describe('formatSignatureDate', () => {
    it('should format date with default locale', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const signature = createTestGenuineSignature();
      signature.created_at = date.toISOString();

      const formatted = formatSignatureDate(
        { type: 'genuine', data: signature },
        'ru-RU'
      );

      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('should format date with custom locale', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const signature = createTestGenuineSignature();
      signature.created_at = date.toISOString();

      const formatted = formatSignatureDate(
        { type: 'genuine', data: signature },
        'en-US'
      );

      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('formatSignatureDateTime', () => {
    it('should format date and time with default locale', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const signature = createTestGenuineSignature();
      signature.created_at = date.toISOString();

      const formatted = formatSignatureDateTime(
        { type: 'genuine', data: signature },
        'ru-RU'
      );

      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('should format date and time with custom locale', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const signature = createTestGenuineSignature();
      signature.created_at = date.toISOString();

      const formatted = formatSignatureDateTime(
        { type: 'genuine', data: signature },
        'en-US'
      );

      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('getShortSignatureId', () => {
    it('should return short ID with default length', () => {
      const signature = createTestSignature('genuine', {
        id: 'very-long-id-12345',
      });

      const shortId = getShortSignatureId(signature);

      expect(shortId).toBe('very-lon...');
      expect(shortId.length).toBe(11); // 8 + '...'
    });

    it('should return short ID with custom length', () => {
      const signature = createTestSignature('genuine', {
        id: 'very-long-id-12345',
      });

      const shortId = getShortSignatureId(signature, 5);

      expect(shortId).toBe('very-...');
      expect(shortId.length).toBe(8); // 5 + '...'
    });
  });

  describe('getSignatureOwnerId', () => {
    it('should return user_id for genuine signature with user_id', () => {
      const signature = createTestSignature('genuine', { userId: 'user-123' });

      const ownerId = getSignatureOwnerId(signature);

      expect(ownerId).toBe('user-123');
    });

    it('should return pseudouser_id for genuine signature with pseudouser_id', () => {
      const signature = createTestSignature('genuine', {
        pseudouserId: 'pseudo-123',
      });

      const ownerId = getSignatureOwnerId(signature);

      expect(ownerId).toBe('pseudo-123');
    });

    it('should return null for genuine signature without owner', () => {
      const signature = createTestSignature('genuine');

      const ownerId = getSignatureOwnerId(signature);

      expect(ownerId).toBeNull();
    });

    it('should return forger_id for forged signature', () => {
      const forgedSignature = createTestForgedSignature(
        'forged-123',
        'original-123',
        undefined,
        undefined,
        'forger-123'
      );
      const signature = { type: 'forged' as const, data: forgedSignature };

      const ownerId = getSignatureOwnerId(signature);

      expect(ownerId).toBe('forger-123');
    });

    it('should return null for forged signature without forger_id', () => {
      const forgedSignature = createTestForgedSignature('forged-123');
      const signature = { type: 'forged' as const, data: forgedSignature };

      const ownerId = getSignatureOwnerId(signature);

      expect(ownerId).toBeNull();
    });
  });

  describe('getGenuineSignatureOwnerId', () => {
    it('should return user owner info for signature with user_id', () => {
      const signature = createTestGenuineSignature('sig-123', 'user-123');

      const owner = getGenuineSignatureOwnerId(signature);

      expect(owner).toEqual({ id: 'user-123', type: 'user' });
    });

    it('should return pseudouser owner info for signature with pseudouser_id', () => {
      const signature = createTestGenuineSignature(
        'sig-123',
        undefined,
        'pseudo-123'
      );

      const owner = getGenuineSignatureOwnerId(signature);

      expect(owner).toEqual({ id: 'pseudo-123', type: 'pseudouser' });
    });

    it('should return null for signature without owner', () => {
      const signature = createTestGenuineSignature('sig-123');

      const owner = getGenuineSignatureOwnerId(signature);

      expect(owner).toBeNull();
    });
  });

  describe('getForgedSignatureOwnerId', () => {
    it('should return forger_id when present', () => {
      const signature = createTestForgedSignature(
        'forged-123',
        'original-123',
        undefined,
        undefined,
        'forger-123'
      );

      const ownerId = getForgedSignatureOwnerId(signature);

      expect(ownerId).toBe('forger-123');
    });

    it('should return null when forger_id is missing', () => {
      const signature = createTestForgedSignature('forged-123');

      const ownerId = getForgedSignatureOwnerId(signature);

      expect(ownerId).toBeNull();
    });
  });

  describe('isSignatureBelongsToProfile', () => {
    it('should return true for genuine signature with user_id', () => {
      const signature = createTestSignature('genuine', { userId: 'user-123' });

      expect(isSignatureBelongsToProfile(signature)).toBe(true);
    });

    it('should return false for genuine signature with pseudouser_id', () => {
      const genuine = createTestGenuineSignature(
        'sig-123',
        undefined,
        'pseudo-123'
      );
      const signature = { type: 'genuine' as const, data: genuine };

      expect(isSignatureBelongsToProfile(signature)).toBe(false);
    });

    it('should return false for genuine signature without owner', () => {
      const genuine = createTestGenuineSignature('sig-123');
      const signature = { type: 'genuine' as const, data: genuine };

      expect(isSignatureBelongsToProfile(signature)).toBe(false);
    });

    it('should return true for forged signature with original_user_id', () => {
      const forgedSignature = createTestForgedSignature(
        'forged-123',
        'original-123',
        'user-123'
      );
      const signature = { type: 'forged' as const, data: forgedSignature };

      expect(isSignatureBelongsToProfile(signature)).toBe(true);
    });

    it('should return false for forged signature with original_pseudouser_id', () => {
      const forgedSignature = createTestForgedSignature(
        'forged-123',
        'original-123',
        undefined,
        'pseudo-123'
      );
      const signature = { type: 'forged' as const, data: forgedSignature };

      expect(isSignatureBelongsToProfile(signature)).toBe(false);
    });
  });

  describe('prepareGenuineSignatureDataForInsert', () => {
    it('should prepare data with user_id', () => {
      const points = createTestPoints(10);
      const data = prepareGenuineSignatureDataForInsert(
        points,
        'mouse',
        'user-123',
        null,
        false,
        true,
        true
      );

      expect(data.user_id).toBe('user-123');
      expect(data.pseudouser_id).toBeUndefined();
      expect(data.features_table).toBe(createTestCSV(points));
      expect(data.input_type).toBe('mouse');
      expect(data.user_for_forgery).toBe(false);
      expect(data.mod_for_forgery).toBe(true);
      expect(data.mod_for_dataset).toBe(true);
    });

    it('should prepare data with pseudouser_id', () => {
      const points = createTestPoints(10);
      const data = prepareGenuineSignatureDataForInsert(
        points,
        'touch',
        null,
        'pseudo-123',
        true,
        false,
        false
      );

      expect(data.user_id).toBeUndefined();
      expect(data.pseudouser_id).toBe('pseudo-123');
      expect(data.features_table).toBe(createTestCSV(points));
      expect(data.input_type).toBe('touch');
      expect(data.user_for_forgery).toBe(true);
      expect(data.mod_for_forgery).toBe(false);
      expect(data.mod_for_dataset).toBe(false);
    });

    it('should throw error when both user_id and pseudouser_id are provided', () => {
      const points = createTestPoints(10);

      expect(() => {
        prepareGenuineSignatureDataForInsert(
          points,
          'mouse',
          'user-123',
          'pseudo-123'
        );
      }).toThrow('Only one of user or pseudouser id is allowed');
    });

    it('should throw error when neither user_id nor pseudouser_id are provided', () => {
      const points = createTestPoints(10);

      expect(() => {
        prepareGenuineSignatureDataForInsert(points, 'mouse', null, null);
      }).toThrow('User or pseudouser id is required');
    });
  });

  describe('prepareForgedSignatureDataForInsert', () => {
    it('should prepare data with original_user_id', () => {
      const originalSignature = createTestGenuineSignature('original-123');
      const forgedPoints = createTestPoints(10);

      const data = prepareForgedSignatureDataForInsert(
        originalSignature,
        'user-123',
        null,
        forgedPoints,
        'pen',
        true
      );

      expect(data.original_signature_id).toBe('original-123');
      expect(data.original_user_id).toBe('user-123');
      expect(data.original_pseudouser_id).toBeNull();
      expect(data.features_table).toBe(createTestCSV(forgedPoints));
      expect(data.input_type).toBe('pen');
      expect(data.mod_for_dataset).toBe(true);
    });

    it('should prepare data with original_pseudouser_id', () => {
      const originalSignature = createTestGenuineSignature('original-123');
      const forgedPoints = createTestPoints(10);

      const data = prepareForgedSignatureDataForInsert(
        originalSignature,
        null,
        'pseudo-123',
        forgedPoints,
        'mouse',
        false
      );

      expect(data.original_signature_id).toBe('original-123');
      expect(data.original_user_id).toBeNull();
      expect(data.original_pseudouser_id).toBe('pseudo-123');
      expect(data.features_table).toBe(createTestCSV(forgedPoints));
      expect(data.input_type).toBe('mouse');
      expect(data.mod_for_dataset).toBe(false);
    });

    it('should throw error when both original_user_id and original_pseudouser_id are provided', () => {
      const originalSignature = createTestGenuineSignature('original-123');
      const forgedPoints = createTestPoints(10);

      expect(() => {
        prepareForgedSignatureDataForInsert(
          originalSignature,
          'user-123',
          'pseudo-123',
          forgedPoints,
          'mouse',
          true
        );
      }).toThrow('Only one of original user or pseudouser id is allowed');
    });

    it('should throw error when neither original_user_id nor original_pseudouser_id are provided', () => {
      const originalSignature = createTestGenuineSignature('original-123');
      const forgedPoints = createTestPoints(10);

      expect(() => {
        prepareForgedSignatureDataForInsert(
          originalSignature,
          null,
          null,
          forgedPoints,
          'mouse',
          true
        );
      }).toThrow('Original user or pseudouser id is required');
    });
  });

  describe('generateSignaturePNG', () => {
    it('should generate PNG data URL for valid signature', () => {
      const signature = createTestSignature('genuine', {
        points: createTestPoints(10),
      });

      const result = generateSignaturePNG(signature);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toContain('data:image/png');
    });

    it('should return empty string for signature with no points', () => {
      const signature = createTestSignature('genuine', {
        points: [],
      });

      const result = generateSignaturePNG(signature);

      expect(result).toBe('');
    });

    it('should use custom width and height', () => {
      const signature = createTestSignature('genuine', {
        points: createTestPoints(10),
      });

      const result = generateSignaturePNG(signature, 400, 200, 2);

      expect(result).toBeTruthy();
      expect(result).toContain('data:image/png');
    });

    it('should handle forged signature', () => {
      const signature = createTestSignature('forged', {
        points: createTestPoints(10),
      });

      const result = generateSignaturePNG(signature);

      expect(result).toBeTruthy();
      expect(result).toContain('data:image/png');
    });

    it('should return empty string when canvas context is null', () => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = jest.fn(() => null);

      const signature = createTestSignature('genuine', {
        points: createTestPoints(10),
      });

      const result = generateSignaturePNG(signature);

      expect(result).toBe('');

      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    it('should handle signature with zero width', () => {
      const points: SignaturePoint[] = [
        { timestamp: 1000, x: 10, y: 20, pressure: 0.5 },
        { timestamp: 1010, x: 10, y: 30, pressure: 0.6 },
      ];
      const signature = createTestSignature('genuine', { points });

      const result = generateSignaturePNG(signature);

      expect(result).toBe('');
    });

    it('should handle signature with zero height', () => {
      const points: SignaturePoint[] = [
        { timestamp: 1000, x: 10, y: 20, pressure: 0.5 },
        { timestamp: 1010, x: 20, y: 20, pressure: 0.6 },
      ];
      const signature = createTestSignature('genuine', { points });

      const result = generateSignaturePNG(signature);

      expect(result).toBe('');
    });
  });

  describe('generateSignaturePreview', () => {
    it('should generate preview with default dimensions', () => {
      const signature = createTestSignature('genuine', {
        points: createTestPoints(10),
      });

      const result = generateSignaturePreview(signature);

      expect(result).toBeTruthy();
      expect(result).toContain('data:image/png');
    });

    it('should call generateSignaturePNG with correct parameters', () => {
      const signature = createTestSignature('genuine', {
        points: createTestPoints(10),
      });

      const result = generateSignaturePreview(signature);

      expect(result).toBeTruthy();
      // Preview uses 200x100 with strokeWidth 2
    });

    it('should return empty string for empty signature', () => {
      const signature = createTestSignature('genuine', {
        points: [],
      });

      const result = generateSignaturePreview(signature);

      expect(result).toBe('');
    });
  });

  describe('downloadSignatureAsPNG', () => {
    let createElementSpy: jest.SpyInstance;
    let mockLink: {
      download: string;
      href: string;
      click: jest.Mock;
    };
    let originalCreateElement: typeof document.createElement;

    beforeEach(() => {
      mockLink = {
        download: '',
        href: '',
        click: jest.fn(),
      };

      // Получаем оригинальный createElement из global (экспортирован из jest.setup.js)
      originalCreateElement = (global as any).originalCreateElement;

      // Мокируем createElement, переопределяя только для 'a'
      createElementSpy = jest.spyOn(document, 'createElement');
      createElementSpy.mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return mockLink as unknown as HTMLElement;
        }
        // Для canvas используем оригинальный createElement
        // Моки для getContext и toDataURL уже настроены в jest.setup.js
        if (tagName === 'canvas') {
          return originalCreateElement.call(document, 'canvas');
        }
        // Для других тегов тоже используем оригинальный
        return originalCreateElement.call(document, tagName);
      });
    });

    afterEach(() => {
      createElementSpy.mockRestore();
    });

    it('should create download link with default filename', () => {
      const signature = createTestSignature('genuine', {
        id: 'test-signature-id',
        points: createTestPoints(10),
      });

      downloadSignatureAsPNG(signature);

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('signature-test-signature-id.png');
      expect(mockLink.href).toContain('data:image/png');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should create download link with custom filename', () => {
      const signature = createTestSignature('genuine', {
        points: createTestPoints(10),
      });

      downloadSignatureAsPNG(signature, 'my-custom-signature.png');

      expect(mockLink.download).toBe('my-custom-signature.png');
      expect(mockLink.href).toContain('data:image/png');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should not create link if PNG generation fails', () => {
      const signature = createTestSignature('genuine', {
        points: [],
      });

      downloadSignatureAsPNG(signature);

      expect(mockLink.click).not.toHaveBeenCalled();
    });

    it('should handle forged signature download', () => {
      const signature = createTestSignature('forged', {
        id: 'forged-id',
        points: createTestPoints(10),
      });

      downloadSignatureAsPNG(signature);

      expect(mockLink.download).toBe('signature-forged-id.png');
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  describe('saveOwnSignature', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should save own signature successfully', async () => {
      const { saveOwnSignature } = require('../signature-utils');
      const { getUser } = require('../auth-client-utils');

      const user = { id: 'user-1' } as any;
      (getUser as jest.Mock).mockResolvedValue(user);

      const points = createTestPoints(10);
      const mockResponse = { id: 'new-signature-id' };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await saveOwnSignature({ points, inputType: 'mouse' });

      expect(result).toBe('new-signature-id');
      expect(global.fetch).toHaveBeenCalledWith('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points,
          inputType: 'mouse',
          userForForgery: false,
        }),
      });
    });

    it('should throw error when user is not authenticated', async () => {
      const { saveOwnSignature } = require('../signature-utils');
      const { getUser } = require('../auth-client-utils');

      (getUser as jest.Mock).mockResolvedValue(null);

      const points = createTestPoints(10);

      await expect(saveOwnSignature({ points })).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('should throw error when API request fails', async () => {
      const { saveOwnSignature } = require('../signature-utils');
      const { getUser } = require('../auth-client-utils');

      const user = { id: 'user-1' } as any;
      (getUser as jest.Mock).mockResolvedValue(user);

      const points = createTestPoints(10);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Server error' }),
      });

      await expect(saveOwnSignature({ points })).rejects.toThrow(
        'Server error'
      );
    });
  });

  describe('saveForAnotherSignature', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should save signature for another user successfully', async () => {
      const { saveForAnotherSignature } = require('../signature-utils');

      const points = createTestPoints(10);
      const mockResponse = { id: 'new-signature-id' };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await saveForAnotherSignature({
        points,
        inputType: 'mouse',
        targetTable: 'profiles',
        targetId: 'user-1',
      });

      expect(result).toBe('new-signature-id');
      expect(global.fetch).toHaveBeenCalledWith('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points,
          inputType: 'mouse',
          userForForgery: false,
          targetTable: 'profiles',
          targetId: 'user-1',
        }),
      });
    });

    it('should handle network errors', async () => {
      const { saveForAnotherSignature } = require('../signature-utils');

      const points = createTestPoints(10);

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        saveForAnotherSignature({
          points,
          targetTable: 'profiles',
          targetId: 'user-1',
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('toggleUserForForgery', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
      window.dispatchEvent = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should toggle userForForgery successfully', async () => {
      const { toggleUserForForgery } = require('../signature-utils');

      const signature = createTestGenuineSignature('sig-1', 'user-1');
      signature.user_for_forgery = false;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ user_for_forgery: true }),
      });

      const result = await toggleUserForForgery(signature);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/signatures/sig-1?type=genuine',
        {
          method: 'PATCH',
          body: JSON.stringify({ userForForgery: true }),
        }
      );
      expect(window.dispatchEvent).toHaveBeenCalled();
    });

    it('should return original value on error', async () => {
      const { toggleUserForForgery } = require('../signature-utils');

      const signature = createTestGenuineSignature('sig-1', 'user-1');
      signature.user_for_forgery = false;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Server error' }),
      });

      const result = await toggleUserForForgery(signature);

      expect(result).toBe(false);
    });
  });

  describe('toggleModForForgery', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
      window.dispatchEvent = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should toggle modForForgery successfully', async () => {
      const { toggleModForForgery } = require('../signature-utils');

      const signature = createTestGenuineSignature('sig-1', 'user-1');
      signature.mod_for_forgery = false;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ mod_for_forgery: true }),
      });

      const result = await toggleModForForgery(signature);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/signatures/sig-1?type=genuine',
        {
          method: 'PATCH',
          body: JSON.stringify({ modForForgery: true }),
        }
      );
    });
  });

  describe('toggleModForDataset', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
      window.dispatchEvent = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should toggle modForDataset for genuine signature', async () => {
      const { toggleModForDataset } = require('../signature-utils');

      const signature = createTestSignature('genuine', {
        id: 'sig-1',
        userId: 'user-1',
      });
      signature.data.mod_for_dataset = false;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ mod_for_dataset: true }),
      });

      const result = await toggleModForDataset(signature);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/signatures/sig-1?type=genuine',
        {
          method: 'PATCH',
          body: JSON.stringify({ modForDataset: true }),
        }
      );
    });

    it('should toggle modForDataset for forged signature', async () => {
      const { toggleModForDataset } = require('../signature-utils');

      const signature = createTestSignature('forged', {
        id: 'sig-1',
        userId: 'user-1',
      });
      signature.data.mod_for_dataset = false;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ mod_for_dataset: true }),
      });

      const result = await toggleModForDataset(signature);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/signatures/sig-1?type=forged',
        {
          method: 'PATCH',
          body: JSON.stringify({ modForDataset: true }),
        }
      );
    });
  });

  describe('deleteSignature', () => {
    let mockConfirm: jest.Mock;

    beforeEach(() => {
      global.fetch = jest.fn();
      window.dispatchEvent = jest.fn();

      // Получаем замоканную функцию confirm
      const { confirm } = require('@/components/ui/alert-dialog');
      mockConfirm = confirm as jest.Mock;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should delete signature when confirmed', async () => {
      const { deleteSignature } = require('../signature-utils');
      const { confirm } = require('@/components/ui/alert-dialog');

      const signature = createTestSignature('genuine', {
        id: 'sig-1',
        userId: 'user-1',
      });

      (confirm as jest.Mock).mockResolvedValue(true);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      const result = await deleteSignature(signature);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/signatures/sig-1?type=genuine',
        {
          method: 'DELETE',
        }
      );
      expect(window.dispatchEvent).toHaveBeenCalled();
    });

    it('should not delete signature when not confirmed', async () => {
      const { deleteSignature } = require('../signature-utils');

      const signature = createTestSignature('genuine', {
        id: 'sig-1',
        userId: 'user-1',
      });

      mockConfirm.mockResolvedValue(false);

      const result = await deleteSignature(signature);

      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return false on API error', async () => {
      const { deleteSignature } = require('../signature-utils');

      const signature = createTestSignature('genuine', {
        id: 'sig-1',
        userId: 'user-1',
      });

      mockConfirm.mockResolvedValue(true);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Server error' }),
      });

      const result = await deleteSignature(signature);

      expect(result).toBe(false);
    });
  });
});
