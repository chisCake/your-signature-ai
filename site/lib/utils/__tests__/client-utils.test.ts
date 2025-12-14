import { cn, getProfile, getSignatureOwner } from '@/lib/utils/client-utils';
import {
  getProfile as getProfileQuery,
  getPseudouser,
} from '@/lib/supabase/queries';
import {
  createTestProfile,
  createTestPseudouser,
  createTestSignature,
} from '@/lib/__tests__/test-helpers';

// Моки для зависимостей
jest.mock('@/lib/supabase/queries', () => ({
  getProfile: jest.fn(),
  getPseudouser: jest.fn(),
}));

const mockGetProfileQuery = getProfileQuery as jest.MockedFunction<
  typeof getProfileQuery
>;
const mockGetPseudouser = getPseudouser as jest.MockedFunction<
  typeof getPseudouser
>;

describe('client-utils', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {} as any;
    jest.clearAllMocks();
  });

  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('class1', 'class2', 'class3');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
      expect(result).toContain('class3');
    });

    it('should handle conditional classes', () => {
      const condition = true;
      const result = cn('base-class', condition && 'conditional-class');
      expect(result).toContain('base-class');
      expect(result).toContain('conditional-class');
    });

    it('should handle false conditional classes', () => {
      const condition = false;
      const result = cn('base-class', condition && 'conditional-class');
      expect(result).toContain('base-class');
      expect(result).not.toContain('conditional-class');
    });

    it('should handle null and undefined', () => {
      const result = cn('base-class', null, undefined, 'other-class');
      expect(result).toContain('base-class');
      expect(result).toContain('other-class');
    });

    it('should merge tailwind classes correctly (tailwind-merge)', () => {
      // tailwind-merge should remove conflicting classes
      const result = cn('px-2', 'px-4');
      // The result should only contain one px-* class (px-4 wins)
      expect(result).not.toContain('px-2');
      expect(result).toContain('px-4');
    });

    it('should handle empty strings', () => {
      const result = cn('', 'class1', '', 'class2');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should handle arrays of classes', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
      expect(result).toContain('class3');
    });

    it('should handle objects with conditional classes', () => {
      const result = cn({
        class1: true,
        class2: false,
        class3: true,
      });
      expect(result).toContain('class1');
      expect(result).not.toContain('class2');
      expect(result).toContain('class3');
    });

    it('should handle complex combinations', () => {
      const result = cn(
        'base-class',
        true && 'conditional-class',
        false && 'should-not-appear',
        {
          'object-class': true,
          'object-class-false': false,
        },
        ['array-class1', 'array-class2'],
        null,
        undefined
      );

      expect(result).toContain('base-class');
      expect(result).toContain('conditional-class');
      expect(result).not.toContain('should-not-appear');
      expect(result).toContain('object-class');
      expect(result).not.toContain('object-class-false');
      expect(result).toContain('array-class1');
      expect(result).toContain('array-class2');
    });

    it('should handle tailwind conflicting classes with different variants', () => {
      // Test that tailwind-merge properly handles conflicting classes
      const result = cn('bg-red-500', 'bg-blue-500');
      // Should only contain one bg-* class
      expect(result).toContain('bg-blue-500');
      expect(result).not.toContain('bg-red-500');
    });

    it('should preserve non-conflicting tailwind classes', () => {
      const result = cn('px-4', 'py-2', 'bg-red-500');
      expect(result).toContain('px-4');
      expect(result).toContain('py-2');
      expect(result).toContain('bg-red-500');
    });

    it('should return empty string for all falsy values', () => {
      const result = cn(null, undefined, false, '');
      expect(result).toBe('');
    });

    it('should handle mixed string and object inputs', () => {
      const result = cn(
        'string-class',
        {
          'object-class': true,
        },
        'another-string'
      );
      expect(result).toContain('string-class');
      expect(result).toContain('object-class');
      expect(result).toContain('another-string');
    });
  });

  describe('getProfile', () => {
    it('should return profile when found', async () => {
      const mockProfile = createTestProfile('user-123', 'user', 'Test User');
      mockGetProfileQuery.mockResolvedValue(mockProfile);

      const result = await getProfile('user-123', mockClient);

      expect(mockGetProfileQuery).toHaveBeenCalledWith('user-123', mockClient);
      expect(result).toEqual(mockProfile);
    });

    it('should return null when profile not found', async () => {
      mockGetProfileQuery.mockResolvedValue(null);

      const result = await getProfile('non-existent', mockClient);

      expect(mockGetProfileQuery).toHaveBeenCalledWith(
        'non-existent',
        mockClient
      );
      expect(result).toBeNull();
    });
  });

  describe('getSignatureOwner', () => {
    describe('genuine signatures', () => {
      it('should return profile user when genuine signature has user_id', async () => {
        const mockProfile = createTestProfile('user-123', 'user', 'Test User');
        const signature = createTestSignature('genuine', {
          userId: 'user-123',
        });

        mockGetProfileQuery.mockResolvedValue(mockProfile);

        const result = await getSignatureOwner(signature, mockClient);

        expect(mockGetProfileQuery).toHaveBeenCalledWith(
          'user-123',
          mockClient
        );
        expect(result).toEqual({
          type: 'user',
          data: mockProfile,
        });
      });

      it('should return null when genuine signature has no user_id (external dataset)', async () => {
        const signature = createTestSignature('genuine', {
          userId: undefined,
        });

        const result = await getSignatureOwner(signature, mockClient);

        expect(mockGetProfileQuery).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should return null when profile not found for genuine signature', async () => {
        const signature = createTestSignature('genuine', {
          userId: 'user-123',
        });

        mockGetProfileQuery.mockResolvedValue(null);

        const result = await getSignatureOwner(signature, mockClient);

        expect(mockGetProfileQuery).toHaveBeenCalledWith(
          'user-123',
          mockClient
        );
        expect(result).toBeNull();
      });
    });

    describe('forged signatures', () => {
      it('should return pseudouser when forged signature has forger_id', async () => {
        const mockPseudouser = createTestPseudouser(
          'pseudo-123',
          'Test Pseudouser'
        );
        // Создаем forged подпись напрямую, чтобы точно установить forger_id
        const signature: Signature = {
          type: 'forged',
          data: {
            id: 'forged-123',
            original_signature_id: 'orig-123',
            features_table: 't,x,y,p\n100,10,20,0.5',
            input_type: 'mouse',
            mod_for_dataset: true,
            forger_id: 'pseudo-123',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        };

        mockGetPseudouser.mockResolvedValue(mockPseudouser);

        const result = await getSignatureOwner(signature, mockClient);

        expect(mockGetPseudouser).toHaveBeenCalledWith(
          'pseudo-123',
          mockClient
        );
        expect(result).not.toBeNull();
        expect(result?.type).toBe('pseudouser');
        expect(result?.data).toEqual(mockPseudouser);
      });

      it('should return null when forged signature has no forger_id (external dataset)', async () => {
        const signature = createTestSignature('forged', {
          forgerId: undefined,
        });

        const result = await getSignatureOwner(signature, mockClient);

        expect(mockGetPseudouser).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should return null when pseudouser not found for forged signature', async () => {
        // Создаем forged подпись напрямую, чтобы точно установить forger_id
        const signature: Signature = {
          type: 'forged',
          data: {
            id: 'forged-123',
            original_signature_id: 'orig-123',
            features_table: 't,x,y,p\n100,10,20,0.5',
            input_type: 'mouse',
            mod_for_dataset: true,
            forger_id: 'pseudo-123',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        };

        mockGetPseudouser.mockResolvedValue(null);

        const result = await getSignatureOwner(signature, mockClient);

        expect(mockGetPseudouser).toHaveBeenCalledWith(
          'pseudo-123',
          mockClient
        );
        expect(result).toBeNull();
      });
    });
  });
});
