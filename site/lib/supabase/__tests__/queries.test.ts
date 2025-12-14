import {
  getProfile,
  getPseudouser,
  searchUser,
  getUsers,
  getPseudousers,
  getEmail,
  getSignature,
  getGenuineSignature,
  getForgedSignature,
  searchSignature,
  getUserGenuineSignatures,
  getUserForgedSignatures,
  getGenuineSignaturesAmount,
  getForgedSignaturesAmount,
  getInputTypeStats,
  getGenuineSignatures,
  getForgedSignatures,
  profilesPrefixSearch,
  pseudousersPrefixSearch,
  profilesSubstrSearch,
  pseudousersSubstrSearch,
  getPseudouserByName,
  insertGenuineSignature,
  insertForgedSignature,
  insertPseudouser,
  updateUserForForgery,
  updateModForForgery,
  updateModForDataset,
  updateAllUserForForgery,
  updateAllModForForgery,
  updateAllModForDataset,
  deleteSignature,
  MIN_POINTS_FOR_SIGNATURE,
  InsertGenuineSignatureData,
  InsertForgedSignatureData,
} from '../queries';
import { createBrowserClient } from '../client';
import {
  createTestProfile,
  createTestPseudouser,
  createTestGenuineSignature,
  createTestForgedSignature,
  createTestPoints,
  createTestCSV,
} from '@/lib/__tests__/test-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

// Моки для зависимостей
jest.mock('../client');

const mockCreateBrowserClient = createBrowserClient as jest.MockedFunction<
  typeof createBrowserClient
>;

describe('queries', () => {
  let mockClient: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Создаем мок query builder с цепочкой методов
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    mockClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
      rpc: jest.fn(),
    };

    mockCreateBrowserClient.mockReturnValue(mockClient);
  });

  describe('GETS - Profiles', () => {
    describe('getProfile', () => {
      it('should return profile when found', async () => {
        const testProfile = createTestProfile('user-123', 'user', 'Test User');
        const dbProfile = {
          id: 'user-123',
          role: 'user',
          display_name: 'Test User',
          created_at: testProfile.created_at,
          updated_at: testProfile.updated_at,
          email: 'test@example.com',
        };

        mockQueryBuilder.single.mockResolvedValue({
          data: dbProfile,
          error: null,
        });

        const result = await getProfile('user-123');

        expect(mockClient.from).toHaveBeenCalledWith('profiles');
        expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-123');
        expect(mockQueryBuilder.single).toHaveBeenCalled();
        expect(result).toEqual(testProfile);
      });

      it('should return null when profile not found', async () => {
        mockQueryBuilder.single.mockResolvedValue({
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        });

        const result = await getProfile('non-existent');

        expect(result).toBeNull();
      });

      it('should return null on database error', async () => {
        mockQueryBuilder.single.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await getProfile('user-123');

        expect(result).toBeNull();
      });

      it('should use provided client', async () => {
        const customClient = {
          from: jest.fn().mockReturnValue(mockQueryBuilder),
        };
        const testProfile = createTestProfile('user-123');
        const dbProfile = {
          id: 'user-123',
          role: 'user',
          display_name: 'Test User',
          created_at: testProfile.created_at,
          updated_at: testProfile.updated_at,
        };

        mockQueryBuilder.single.mockResolvedValue({
          data: dbProfile,
          error: null,
        });

        await getProfile('user-123', customClient as any);

        expect(mockCreateBrowserClient).not.toHaveBeenCalled();
        expect(customClient.from).toHaveBeenCalledWith('profiles');
      });
    });

    describe('getUsers', () => {
      it('should return array of profiles', async () => {
        const dbProfiles = [
          {
            id: 'user-1',
            role: 'user',
            display_name: 'User 1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'user-2',
            role: 'mod',
            display_name: 'User 2',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];

        mockQueryBuilder.select.mockResolvedValue({
          data: dbProfiles,
          error: null,
        });

        const result = await getUsers();

        expect(mockClient.from).toHaveBeenCalledWith('profiles');
        expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('user-1');
        expect(result[1].id).toBe('user-2');
      });

      it('should return empty array on error', async () => {
        mockQueryBuilder.select.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await getUsers();

        expect(result).toEqual([]);
      });
    });
  });

  describe('GETS - Pseudousers', () => {
    describe('getPseudouser', () => {
      it('should return pseudouser when found', async () => {
        const testPseudouser = createTestPseudouser(
          'pseudo-123',
          'Test Pseudouser'
        );
        const dbPseudouser = {
          id: 'pseudo-123',
          name: 'Test Pseudouser',
          source: 'test-source',
          created_at: testPseudouser.created_at,
          updated_at: testPseudouser.updated_at,
        };

        mockQueryBuilder.single.mockResolvedValue({
          data: dbPseudouser,
          error: null,
        });

        const result = await getPseudouser('pseudo-123');

        expect(mockClient.from).toHaveBeenCalledWith('pseudousers');
        expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'pseudo-123');
        expect(result).toEqual(testPseudouser);
      });

      it('should return null when pseudouser not found', async () => {
        mockQueryBuilder.single.mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        });

        const result = await getPseudouser('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('getPseudousers', () => {
      it('should return array of pseudousers', async () => {
        const dbPseudousers = [
          {
            id: 'pseudo-1',
            name: 'Pseudouser 1',
            source: 'source-1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];

        mockQueryBuilder.select.mockResolvedValue({
          data: dbPseudousers,
          error: null,
        });

        const result = await getPseudousers();

        expect(mockClient.from).toHaveBeenCalledWith('pseudousers');
        expect(result).toHaveLength(1);
      });

      it('should return empty array on error', async () => {
        mockQueryBuilder.select.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await getPseudousers();

        expect(result).toEqual([]);
      });
    });

    describe('getPseudouserByName', () => {
      it('should return pseudouser by name', async () => {
        const testPseudouser = createTestPseudouser('pseudo-123', 'Test Name');
        const dbPseudouser = {
          id: 'pseudo-123',
          name: 'Test Name',
          source: 'test-source',
          created_at: testPseudouser.created_at,
          updated_at: testPseudouser.updated_at,
        };

        mockQueryBuilder.maybeSingle.mockResolvedValue({
          data: dbPseudouser,
          error: null,
        });

        const result = await getPseudouserByName('Test Name');

        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('name', 'Test Name');
        expect(result).toEqual(testPseudouser);
      });

      it('should return null when not found', async () => {
        mockQueryBuilder.maybeSingle.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await getPseudouserByName('Non-existent');

        expect(result).toBeNull();
      });
    });
  });

  describe('GETS - Search', () => {
    describe('searchUser', () => {
      it('should return user when profile found', async () => {
        const testProfile = createTestProfile('user-123');
        const dbProfile = {
          id: 'user-123',
          role: 'user',
          display_name: 'Test User',
          created_at: testProfile.created_at,
          updated_at: testProfile.updated_at,
        };

        // Мокаем getProfile и getPseudouser через цепочку вызовов
        mockQueryBuilder.single
          .mockResolvedValueOnce({
            data: dbProfile,
            error: null,
          })
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Not found' },
          });

        const result = await searchUser('user-123');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('user');
      });

      it('should return pseudouser when pseudouser found', async () => {
        const testPseudouser = createTestPseudouser('pseudo-123');
        const dbPseudouser = {
          id: 'pseudo-123',
          name: 'Test Pseudouser',
          source: 'test-source',
          created_at: testPseudouser.created_at,
          updated_at: testPseudouser.updated_at,
        };

        mockQueryBuilder.single
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Not found' },
          })
          .mockResolvedValueOnce({
            data: dbPseudouser,
            error: null,
          });

        const result = await searchUser('pseudo-123');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('pseudouser');
      });

      it('should return null when neither found', async () => {
        mockQueryBuilder.single
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Not found' },
          })
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Not found' },
          });

        const result = await searchUser('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('getEmail', () => {
      it('should return email from RPC', async () => {
        mockClient.rpc.mockResolvedValue({
          data: 'test@example.com',
          error: null,
        });

        const result = await getEmail('user-123');

        expect(mockClient.rpc).toHaveBeenCalledWith('get_user_email', {
          profile_id: 'user-123',
        });
        expect(result).toBe('test@example.com');
      });

      it('should return null on error', async () => {
        mockClient.rpc.mockResolvedValue({
          data: null,
          error: { message: 'RPC error' },
        });

        const result = await getEmail('user-123');

        expect(result).toBeNull();
      });
    });
  });

  describe('GETS - Signatures', () => {
    describe('getGenuineSignature', () => {
      it('should return genuine signature when found', async () => {
        const testSignature = createTestGenuineSignature('sig-123', 'user-123');
        const dbSignature = {
          id: 'sig-123',
          user_id: 'user-123',
          pseudouser_id: null,
          features_table: testSignature.features_table,
          input_type: 'mouse',
          user_for_forgery: false,
          mod_for_forgery: true,
          mod_for_dataset: true,
          name: undefined,
          created_at: testSignature.created_at,
          updated_at: testSignature.updated_at,
        };

        mockQueryBuilder.maybeSingle.mockResolvedValue({
          data: dbSignature,
          error: null,
        });

        const result = await getGenuineSignature('sig-123');

        expect(mockClient.from).toHaveBeenCalledWith('genuine_signatures');
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'sig-123');
        expect(result).not.toBeNull();
        expect(result?.id).toBe('sig-123');
        expect(result?.user_id).toBe('user-123');
      });

      it('should return null when not found', async () => {
        mockQueryBuilder.maybeSingle.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await getGenuineSignature('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('getForgedSignature', () => {
      it('should return forged signature when found', async () => {
        const testSignature = createTestForgedSignature(
          'forged-123',
          'orig-123'
        );
        const dbSignature = {
          id: 'forged-123',
          original_signature_id: 'orig-123',
          original_user_id: null,
          original_pseudouser_id: null,
          features_table: testSignature.features_table,
          input_type: 'mouse',
          mod_for_dataset: true,
          score: undefined,
          model_id: undefined,
          forger_id: undefined,
          name: undefined,
          created_at: testSignature.created_at,
          updated_at: testSignature.updated_at,
        };

        mockQueryBuilder.maybeSingle.mockResolvedValue({
          data: dbSignature,
          error: null,
        });

        const result = await getForgedSignature('forged-123');

        expect(mockClient.from).toHaveBeenCalledWith('forged_signatures');
        expect(result).not.toBeNull();
        expect(result?.id).toBe('forged-123');
        expect(result?.original_signature_id).toBe('orig-123');
      });

      it('should return null when not found', async () => {
        mockQueryBuilder.maybeSingle.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await getForgedSignature('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('getSignature', () => {
      it('should return genuine signature when type is genuine', async () => {
        const testSignature = createTestGenuineSignature('sig-123');
        const dbSignature = {
          id: 'sig-123',
          user_id: null,
          pseudouser_id: null,
          features_table: testSignature.features_table,
          input_type: 'mouse',
          user_for_forgery: false,
          mod_for_forgery: true,
          mod_for_dataset: true,
          created_at: testSignature.created_at,
          updated_at: testSignature.updated_at,
        };

        mockQueryBuilder.maybeSingle.mockResolvedValue({
          data: dbSignature,
          error: null,
        });

        const result = await getSignature('sig-123', 'genuine');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('genuine');
      });

      it('should return forged signature when type is forged', async () => {
        const testSignature = createTestForgedSignature(
          'forged-123',
          'orig-123'
        );
        const dbSignature = {
          id: 'forged-123',
          original_signature_id: 'orig-123',
          features_table: testSignature.features_table,
          input_type: 'mouse',
          mod_for_dataset: true,
          created_at: testSignature.created_at,
          updated_at: testSignature.updated_at,
        };

        mockQueryBuilder.maybeSingle.mockResolvedValue({
          data: dbSignature,
          error: null,
        });

        const result = await getSignature('forged-123', 'forged');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('forged');
      });
    });

    describe('searchSignature', () => {
      it('should return genuine signature when found in genuine_signatures', async () => {
        const testSignature = createTestGenuineSignature('sig-123');
        const dbSignature = {
          id: 'sig-123',
          user_id: null,
          pseudouser_id: null,
          features_table: testSignature.features_table,
          input_type: 'mouse',
          user_for_forgery: false,
          mod_for_forgery: true,
          mod_for_dataset: true,
          created_at: testSignature.created_at,
          updated_at: testSignature.updated_at,
        };

        mockQueryBuilder.maybeSingle
          .mockResolvedValueOnce({
            data: dbSignature,
            error: null,
          })
          .mockResolvedValueOnce({
            data: null,
            error: null,
          });

        const result = await searchSignature('sig-123');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('genuine');
      });

      it('should return forged signature when found in forged_signatures', async () => {
        const testSignature = createTestForgedSignature(
          'forged-123',
          'orig-123'
        );
        const dbSignature = {
          id: 'forged-123',
          original_signature_id: 'orig-123',
          features_table: testSignature.features_table,
          input_type: 'mouse',
          mod_for_dataset: true,
          created_at: testSignature.created_at,
          updated_at: testSignature.updated_at,
        };

        mockQueryBuilder.maybeSingle
          .mockResolvedValueOnce({
            data: null,
            error: null,
          })
          .mockResolvedValueOnce({
            data: dbSignature,
            error: null,
          });

        const result = await searchSignature('forged-123');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('forged');
      });

      it('should return null when not found in either table', async () => {
        mockQueryBuilder.maybeSingle
          .mockResolvedValueOnce({
            data: null,
            error: null,
          })
          .mockResolvedValueOnce({
            data: null,
            error: null,
          });

        const result = await searchSignature('non-existent');

        expect(result).toBeNull();
      });
    });
  });

  describe('GETS - User Signatures', () => {
    describe('getUserGenuineSignatures', () => {
      it('should return genuine signatures for user', async () => {
        const testSignature = createTestGenuineSignature('sig-123', 'user-123');
        const dbSignatures = [
          {
            id: 'sig-123',
            user_id: 'user-123',
            pseudouser_id: null,
            features_table: testSignature.features_table,
            input_type: 'mouse',
            user_for_forgery: false,
            mod_for_forgery: true,
            mod_for_dataset: true,
            created_at: testSignature.created_at,
            updated_at: testSignature.updated_at,
          },
        ];

        mockQueryBuilder.limit.mockResolvedValue({
          data: dbSignatures,
          error: null,
        });

        const result = await getUserGenuineSignatures('user-123', 'user');

        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
        expect(result).toHaveLength(1);
      });

      it('should return genuine signatures for pseudouser', async () => {
        const testSignature = createTestGenuineSignature(
          'sig-123',
          undefined,
          'pseudo-123'
        );
        const dbSignatures = [
          {
            id: 'sig-123',
            user_id: null,
            pseudouser_id: 'pseudo-123',
            features_table: testSignature.features_table,
            input_type: 'mouse',
            user_for_forgery: false,
            mod_for_forgery: true,
            mod_for_dataset: true,
            created_at: testSignature.created_at,
            updated_at: testSignature.updated_at,
          },
        ];

        mockQueryBuilder.limit.mockResolvedValue({
          data: dbSignatures,
          error: null,
        });

        const result = await getUserGenuineSignatures(
          'pseudo-123',
          'pseudouser'
        );

        expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
          'pseudouser_id',
          'pseudo-123'
        );
        expect(result).toHaveLength(1);
      });

      it('should use custom limit', async () => {
        mockQueryBuilder.limit.mockResolvedValue({
          data: [],
          error: null,
        });

        await getUserGenuineSignatures('user-123', 'user', undefined, 50);

        expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      });

      it('should return empty array on error', async () => {
        mockQueryBuilder.limit.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await getUserGenuineSignatures('user-123', 'user');

        expect(result).toEqual([]);
      });
    });

    describe('getUserForgedSignatures', () => {
      it('should return forged signatures for user', async () => {
        const testSignature = createTestForgedSignature(
          'forged-123',
          'orig-123',
          'user-123'
        );
        const dbSignatures = [
          {
            id: 'forged-123',
            original_signature_id: 'orig-123',
            original_user_id: 'user-123',
            features_table: testSignature.features_table,
            input_type: 'mouse',
            mod_for_dataset: true,
            created_at: testSignature.created_at,
            updated_at: testSignature.updated_at,
          },
        ];

        mockQueryBuilder.limit.mockResolvedValue({
          data: dbSignatures,
          error: null,
        });

        const result = await getUserForgedSignatures('user-123', 'user');

        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(result).toHaveLength(1);
      });

      it('should return empty array on error', async () => {
        mockQueryBuilder.limit.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await getUserForgedSignatures('user-123', 'user');

        expect(result).toEqual([]);
      });
    });
  });

  describe('GETS - Statistics', () => {
    describe('getGenuineSignaturesAmount', () => {
      it('should return count without date filters', async () => {
        mockQueryBuilder.select.mockResolvedValue({
          count: 42,
          error: null,
        });

        const result = await getGenuineSignaturesAmount();

        expect(mockClient.from).toHaveBeenCalledWith('genuine_signatures');
        expect(result).toBe(42);
      });

      it('should return count with date filters', async () => {
        const dateFrom = new Date('2024-01-01');
        const dateTo = new Date('2024-12-31');

        mockQueryBuilder.lte.mockResolvedValue({
          count: 25,
          error: null,
        });

        const result = await getGenuineSignaturesAmount(
          undefined,
          dateFrom,
          dateTo
        );

        expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
          'created_at',
          dateFrom.toISOString()
        );
        expect(mockQueryBuilder.lte).toHaveBeenCalledWith(
          'created_at',
          dateTo.toISOString()
        );
        expect(result).toBe(25);
      });

      it('should return 0 on error', async () => {
        mockQueryBuilder.select.mockResolvedValue({
          count: null,
          error: { message: 'Database error' },
        });

        const result = await getGenuineSignaturesAmount();

        expect(result).toBe(0);
      });
    });

    describe('getForgedSignaturesAmount', () => {
      it('should return count', async () => {
        mockQueryBuilder.select.mockResolvedValue({
          count: 15,
          error: null,
        });

        const result = await getForgedSignaturesAmount();

        expect(mockClient.from).toHaveBeenCalledWith('forged_signatures');
        expect(result).toBe(15);
      });

      it('should return 0 on error', async () => {
        mockQueryBuilder.select.mockResolvedValue({
          count: null,
          error: { message: 'Database error' },
        });

        const result = await getForgedSignaturesAmount();

        expect(result).toBe(0);
      });
    });

    describe('getInputTypeStats', () => {
      it('should return stats from RPC', async () => {
        mockClient.rpc.mockResolvedValue({
          data: [
            { input_type: 'mouse', count: 10 },
            { input_type: 'touch', count: 5 },
            { input_type: 'pen', count: 3 },
          ],
          error: null,
        });

        const result = await getInputTypeStats();

        expect(mockClient.rpc).toHaveBeenCalledWith('get_input_type_stats', {
          date_from: null,
          date_to: null,
        });
        expect(result).toEqual({ mouse: 10, touch: 5, pen: 3 });
      });

      it('should return zero stats on error', async () => {
        mockClient.rpc.mockResolvedValue({
          data: null,
          error: { message: 'RPC error' },
        });

        const result = await getInputTypeStats();

        expect(result).toEqual({ mouse: 0, touch: 0, pen: 0 });
      });

      it('should handle date filters', async () => {
        const dateFrom = new Date('2024-01-01');
        const dateTo = new Date('2024-12-31');

        mockClient.rpc.mockResolvedValue({
          data: [{ input_type: 'mouse', count: 5 }],
          error: null,
        });

        await getInputTypeStats(undefined, dateFrom, dateTo);

        expect(mockClient.rpc).toHaveBeenCalledWith('get_input_type_stats', {
          date_from: dateFrom.toISOString(),
          date_to: dateTo.toISOString(),
        });
      });
    });
  });

  describe('GETS - All Signatures', () => {
    describe('getGenuineSignatures', () => {
      it('should return genuine signatures with default pagination', async () => {
        const testSignature = createTestGenuineSignature('sig-123');
        const dbSignatures = [
          {
            id: 'sig-123',
            user_id: null,
            pseudouser_id: null,
            features_table: testSignature.features_table,
            input_type: 'mouse',
            user_for_forgery: false,
            mod_for_forgery: true,
            mod_for_dataset: true,
            created_at: testSignature.created_at,
            updated_at: testSignature.updated_at,
          },
        ];

        mockQueryBuilder.range.mockResolvedValue({
          data: dbSignatures,
          error: null,
        });

        const result = await getGenuineSignatures();

        expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', {
          ascending: false,
        });
        expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
        expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 99);
        expect(result).toHaveLength(1);
      });

      it('should use custom pagination', async () => {
        mockQueryBuilder.range.mockResolvedValue({
          data: [],
          error: null,
        });

        await getGenuineSignatures(undefined, 50, 10);

        expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
        expect(mockQueryBuilder.range).toHaveBeenCalledWith(10, 59);
      });

      it('should apply date filters', async () => {
        const dateFrom = new Date('2024-01-01');
        const dateTo = new Date('2024-12-31');

        mockQueryBuilder.range.mockResolvedValue({
          data: [],
          error: null,
        });

        await getGenuineSignatures(undefined, 100, 0, dateFrom, dateTo);

        expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
          'created_at',
          dateFrom.toISOString()
        );
        expect(mockQueryBuilder.lte).toHaveBeenCalledWith(
          'created_at',
          dateTo.toISOString()
        );
      });

      it('should return empty array on error', async () => {
        mockQueryBuilder.range.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await getGenuineSignatures();

        expect(result).toEqual([]);
      });
    });

    describe('getForgedSignatures', () => {
      it('should return forged signatures', async () => {
        const testSignature = createTestForgedSignature(
          'forged-123',
          'orig-123'
        );
        const dbSignatures = [
          {
            id: 'forged-123',
            original_signature_id: 'orig-123',
            features_table: testSignature.features_table,
            input_type: 'mouse',
            mod_for_dataset: true,
            created_at: testSignature.created_at,
            updated_at: testSignature.updated_at,
          },
        ];

        mockQueryBuilder.range.mockResolvedValue({
          data: dbSignatures,
          error: null,
        });

        const result = await getForgedSignatures();

        expect(mockClient.from).toHaveBeenCalledWith('forged_signatures');
        expect(result).toHaveLength(1);
      });

      it('should return empty array on error', async () => {
        mockQueryBuilder.range.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await getForgedSignatures();

        expect(result).toEqual([]);
      });
    });
  });

  describe('GETS - Search', () => {
    describe('profilesPrefixSearch', () => {
      it('should return profiles matching prefix', async () => {
        const dbProfiles = [
          {
            id: 'user-1',
            role: 'user',
            display_name: 'Test User',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];

        mockQueryBuilder.limit.mockResolvedValue({
          data: dbProfiles,
          error: null,
        });

        const result = await profilesPrefixSearch('Test');

        expect(mockQueryBuilder.ilike).toHaveBeenCalledWith(
          'display_name',
          'Test%'
        );
        expect(mockQueryBuilder.order).toHaveBeenCalledWith('display_name', {
          ascending: true,
        });
        expect(result).toHaveLength(1);
      });

      it('should return empty array for empty query', async () => {
        const result = await profilesPrefixSearch('');

        expect(mockClient.from).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      });

      it('should trim query', async () => {
        mockQueryBuilder.limit.mockResolvedValue({
          data: [],
          error: null,
        });

        await profilesPrefixSearch('  Test  ');

        expect(mockQueryBuilder.ilike).toHaveBeenCalledWith(
          'display_name',
          'Test%'
        );
      });

      it('should return empty array on error', async () => {
        mockQueryBuilder.limit.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await profilesPrefixSearch('Test');

        expect(result).toEqual([]);
      });
    });

    describe('pseudousersPrefixSearch', () => {
      it('should return pseudousers matching prefix', async () => {
        const dbPseudousers = [
          {
            id: 'pseudo-1',
            name: 'Test Pseudouser',
            source: 'test',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];

        mockQueryBuilder.limit.mockResolvedValue({
          data: dbPseudousers,
          error: null,
        });

        const result = await pseudousersPrefixSearch('Test');

        expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('name', 'Test%');
        expect(result).toHaveLength(1);
      });

      it('should return empty array for empty query', async () => {
        const result = await pseudousersPrefixSearch('');

        expect(result).toEqual([]);
      });
    });

    describe('profilesSubstrSearch', () => {
      it('should return profiles matching substring but not prefix', async () => {
        const dbProfiles = [
          {
            id: 'user-1',
            role: 'user',
            display_name: 'Some Test User',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];

        mockQueryBuilder.limit.mockResolvedValue({
          data: dbProfiles,
          error: null,
        });

        const result = await profilesSubstrSearch('Test');

        expect(mockQueryBuilder.ilike).toHaveBeenCalledWith(
          'display_name',
          '%Test%'
        );
        expect(mockQueryBuilder.not).toHaveBeenCalledWith(
          'display_name',
          'ilike',
          'Test%'
        );
        expect(result).toHaveLength(1);
      });

      it('should return empty array for empty query', async () => {
        const result = await profilesSubstrSearch('');

        expect(result).toEqual([]);
      });
    });

    describe('pseudousersSubstrSearch', () => {
      it('should return pseudousers matching substring but not prefix', async () => {
        const dbPseudousers = [
          {
            id: 'pseudo-1',
            name: 'Some Test Pseudouser',
            source: 'test',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];

        mockQueryBuilder.limit.mockResolvedValue({
          data: dbPseudousers,
          error: null,
        });

        const result = await pseudousersSubstrSearch('Test');

        expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('name', '%Test%');
        expect(mockQueryBuilder.not).toHaveBeenCalledWith(
          'name',
          'ilike',
          'Test%'
        );
        expect(result).toHaveLength(1);
      });

      it('should return empty array for empty query', async () => {
        const result = await pseudousersSubstrSearch('');

        expect(result).toEqual([]);
      });
    });
  });

  describe('INSERTS', () => {
    describe('insertGenuineSignature', () => {
      it('should insert genuine signature successfully', async () => {
        const points = createTestPoints(MIN_POINTS_FOR_SIGNATURE);
        const signatureData: InsertGenuineSignatureData = {
          user_id: 'user-123',
          features_table: createTestCSV(points),
          input_type: 'mouse',
          user_for_forgery: false,
          mod_for_forgery: true,
          mod_for_dataset: true,
        };

        const insertedSignature = {
          id: 'sig-123',
          ...signatureData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        mockQueryBuilder.single.mockResolvedValue({
          data: insertedSignature,
          error: null,
        });

        const result = await insertGenuineSignature(signatureData);

        expect(mockClient.from).toHaveBeenCalledWith('genuine_signatures');
        expect(mockQueryBuilder.insert).toHaveBeenCalledWith(signatureData);
        expect(result).not.toBeNull();
      });

      it('should throw error when points count is less than minimum', async () => {
        const points = createTestPoints(MIN_POINTS_FOR_SIGNATURE - 1);
        const signatureData: InsertGenuineSignatureData = {
          user_id: 'user-123',
          features_table: createTestCSV(points),
          input_type: 'mouse',
          user_for_forgery: false,
          mod_for_forgery: true,
          mod_for_dataset: true,
        };

        await expect(insertGenuineSignature(signatureData)).rejects.toThrow(
          `Минимальное количество точек для подписи - ${MIN_POINTS_FOR_SIGNATURE}`
        );
      });

      it('should return null on database error', async () => {
        const points = createTestPoints(MIN_POINTS_FOR_SIGNATURE);
        const signatureData: InsertGenuineSignatureData = {
          user_id: 'user-123',
          features_table: createTestCSV(points),
          input_type: 'mouse',
          user_for_forgery: false,
          mod_for_forgery: true,
          mod_for_dataset: true,
        };

        mockQueryBuilder.single.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await insertGenuineSignature(signatureData);

        expect(result).toBeNull();
      });

      it('should handle pseudouser_id', async () => {
        const points = createTestPoints(MIN_POINTS_FOR_SIGNATURE);
        const signatureData: InsertGenuineSignatureData = {
          pseudouser_id: 'pseudo-123',
          features_table: createTestCSV(points),
          input_type: 'touch',
          user_for_forgery: true,
          mod_for_forgery: false,
          mod_for_dataset: false,
        };

        const insertedSignature = {
          id: 'sig-123',
          ...signatureData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        mockQueryBuilder.single.mockResolvedValue({
          data: insertedSignature,
          error: null,
        });

        const result = await insertGenuineSignature(signatureData);

        expect(result).not.toBeNull();
      });
    });

    describe('insertForgedSignature', () => {
      it('should insert forged signature successfully', async () => {
        const points = createTestPoints(MIN_POINTS_FOR_SIGNATURE);
        const signatureData: InsertForgedSignatureData = {
          original_signature_id: 'orig-123',
          original_user_id: 'user-123',
          features_table: createTestCSV(points),
          input_type: 'pen',
          mod_for_dataset: true,
        };

        const insertedSignature = {
          id: 'forged-123',
          ...signatureData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        mockQueryBuilder.single.mockResolvedValue({
          data: insertedSignature,
          error: null,
        });

        const result = await insertForgedSignature(signatureData);

        expect(mockClient.from).toHaveBeenCalledWith('forged_signatures');
        expect(result).not.toBeNull();
      });

      it('should throw error when points count is less than minimum', async () => {
        const points = createTestPoints(MIN_POINTS_FOR_SIGNATURE - 1);
        const signatureData: InsertForgedSignatureData = {
          original_signature_id: 'orig-123',
          features_table: createTestCSV(points),
          input_type: 'mouse',
          mod_for_dataset: false,
        };

        await expect(insertForgedSignature(signatureData)).rejects.toThrow(
          `Минимальное количество точек для подписи - ${MIN_POINTS_FOR_SIGNATURE}`
        );
      });

      it('should return null on database error', async () => {
        const points = createTestPoints(MIN_POINTS_FOR_SIGNATURE);
        const signatureData: InsertForgedSignatureData = {
          original_signature_id: 'orig-123',
          features_table: createTestCSV(points),
          input_type: 'mouse',
          mod_for_dataset: true,
        };

        mockQueryBuilder.single.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await insertForgedSignature(signatureData);

        expect(result).toBeNull();
      });
    });

    describe('insertPseudouser', () => {
      it('should insert pseudouser successfully', async () => {
        const pseudouserData = {
          name: 'Test Pseudouser',
          source: 'test-source',
        };
        const insertedPseudouser = {
          id: 'pseudo-123',
          ...pseudouserData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        mockQueryBuilder.single.mockResolvedValue({
          data: insertedPseudouser,
          error: null,
        });

        const result = await insertPseudouser(pseudouserData);

        expect(mockClient.from).toHaveBeenCalledWith('pseudousers');
        expect(mockQueryBuilder.insert).toHaveBeenCalledWith(pseudouserData);
        expect(result).not.toBeNull();
        expect(result?.name).toBe('Test Pseudouser');
      });

      it('should return null on database error', async () => {
        const pseudouserData = { name: 'Test', source: 'test' };

        mockQueryBuilder.single.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await insertPseudouser(pseudouserData);

        expect(result).toBeNull();
      });
    });
  });

  describe('UPDATES', () => {
    describe('updateUserForForgery', () => {
      it('should update user_for_forgery successfully', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await updateUserForForgery('sig-123', true);

        expect(mockClient.from).toHaveBeenCalledWith('genuine_signatures');
        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          user_for_forgery: true,
        });
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'sig-123');
        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await updateUserForForgery('sig-123', false);

        expect(result).toBe(false);
      });
    });

    describe('updateModForForgery', () => {
      it('should update mod_for_forgery successfully', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await updateModForForgery('sig-123', true);

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          mod_for_forgery: true,
        });
        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await updateModForForgery('sig-123', false);

        expect(result).toBe(false);
      });
    });

    describe('updateModForDataset', () => {
      it('should update mod_for_dataset for genuine signature', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await updateModForDataset('sig-123', true, 'genuine');

        expect(mockClient.from).toHaveBeenCalledWith('genuine_signatures');
        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          mod_for_dataset: true,
        });
        expect(result).toBe(true);
      });

      it('should update mod_for_dataset for forged signature', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await updateModForDataset('forged-123', false, 'forged');

        expect(mockClient.from).toHaveBeenCalledWith('forged_signatures');
        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          mod_for_dataset: false,
        });
        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await updateModForDataset('sig-123', true, 'genuine');

        expect(result).toBe(false);
      });
    });

    describe('updateAllUserForForgery', () => {
      it('should update all signatures for user', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await updateAllUserForForgery('user-123', true, 'user');

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          user_for_forgery: true,
        });
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(result).toBe(true);
      });

      it('should update all signatures for pseudouser', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await updateAllUserForForgery(
          'pseudo-123',
          false,
          'pseudouser'
        );

        expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
          'pseudouser_id',
          'pseudo-123'
        );
        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await updateAllUserForForgery('user-123', true, 'user');

        expect(result).toBe(false);
      });
    });

    describe('updateAllModForForgery', () => {
      it('should update all mod_for_forgery for user', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await updateAllModForForgery('user-123', true, 'user');

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          mod_for_forgery: true,
        });
        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await updateAllModForForgery('user-123', false, 'user');

        expect(result).toBe(false);
      });
    });

    describe('updateAllModForDataset', () => {
      it('should update all mod_for_dataset for genuine signatures', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await updateAllModForDataset(
          'user-123',
          true,
          'user',
          'genuine'
        );

        expect(mockClient.from).toHaveBeenCalledWith('genuine_signatures');
        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          mod_for_dataset: true,
        });
        expect(result).toBe(true);
      });

      it('should update all mod_for_dataset for forged signatures', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await updateAllModForDataset(
          'user-123',
          false,
          'user',
          'forged'
        );

        expect(mockClient.from).toHaveBeenCalledWith('forged_signatures');
        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await updateAllModForDataset(
          'user-123',
          true,
          'user',
          'genuine'
        );

        expect(result).toBe(false);
      });
    });
  });

  describe('DELETES', () => {
    describe('deleteSignature', () => {
      it('should delete genuine signature successfully', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await deleteSignature('sig-123', 'genuine');

        expect(mockClient.from).toHaveBeenCalledWith('genuine_signatures');
        expect(mockQueryBuilder.delete).toHaveBeenCalled();
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'sig-123');
        expect(result).toBe(true);
      });

      it('should delete forged signature successfully', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await deleteSignature('forged-123', 'forged');

        expect(mockClient.from).toHaveBeenCalledWith('forged_signatures');
        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        mockQueryBuilder.eq.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await deleteSignature('sig-123', 'genuine');

        expect(result).toBe(false);
      });
    });
  });
});
