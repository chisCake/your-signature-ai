import {
  csvStringToPoints,
  csvToPoints,
  formatSignatureDate,
  formatSignatureDateTime,
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
});
