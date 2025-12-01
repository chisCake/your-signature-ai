import {
  createForgedSignature,
  createGenuineSignature,
  createProfileUser,
  createPseudouserUser,
  getUserId,
  getUserName,
  mapToAdminToken,
  mapToEmbedding,
  mapToModel,
  mapToProfile,
  mapToPseudouser,
  mapToSignature,
  mapToSignatureForged,
  mapToSignatureGenuine,
  mapToUserEmbedding,
  Profile,
  Pseudouser,
} from '@/lib/types';
import {
  createTestGenuineSignature,
  createTestForgedSignature,
  createTestProfile,
  createTestPseudouser,
} from '@/lib/__tests__/test-helpers';

describe('types transformation functions', () => {
  describe('mapToSignature', () => {
    it('should map genuine signature correctly', () => {
      const genuine = createTestGenuineSignature('sig-123', 'user-123');
      const signature = mapToSignature(genuine);

      expect(signature.type).toBe('genuine');
      expect(signature.data).toEqual(genuine);
    });

    it('should map forged signature by original_signature_id', () => {
      const forged = createTestForgedSignature(
        'forged-123',
        'original-123',
        'user-123'
      );
      const signature = mapToSignature(forged);

      expect(signature.type).toBe('forged');
      expect(signature.data).toEqual(forged);
    });

    it('should map forged signature by original_user_id', () => {
      const forged = createTestForgedSignature(
        'forged-123',
        undefined,
        'user-123'
      );
      const signature = mapToSignature(forged);

      expect(signature.type).toBe('forged');
      expect(signature.data).toEqual(forged);
    });

    it('should map forged signature by original_pseudouser_id', () => {
      const forged = createTestForgedSignature(
        'forged-123',
        undefined,
        undefined,
        'pseudo-123'
      );
      const signature = mapToSignature(forged);

      expect(signature.type).toBe('forged');
      expect(signature.data).toEqual(forged);
    });
  });

  describe('createProfileUser', () => {
    it('should create user from profile', () => {
      const profile = createTestProfile('user-123', 'admin', 'Test User');
      const user = createProfileUser(profile);

      expect(user.type).toBe('user');
      expect(user.data).toEqual(profile);
    });
  });

  describe('createPseudouserUser', () => {
    it('should create user from pseudouser', () => {
      const pseudouser = createTestPseudouser('pseudo-123', 'Test Pseudouser');
      const user = createPseudouserUser(pseudouser);

      expect(user.type).toBe('pseudouser');
      expect(user.data).toEqual(pseudouser);
    });
  });

  describe('createGenuineSignature', () => {
    it('should create signature from genuine data', () => {
      const genuine = createTestGenuineSignature('sig-123');
      const signature = createGenuineSignature(genuine);

      expect(signature.type).toBe('genuine');
      expect(signature.data).toEqual(genuine);
    });
  });

  describe('createForgedSignature', () => {
    it('should create signature from forged data', () => {
      const forged = createTestForgedSignature('forged-123');
      const signature = createForgedSignature(forged);

      expect(signature.type).toBe('forged');
      expect(signature.data).toEqual(forged);
    });
  });

  describe('getUserName', () => {
    it('should return display_name for user type', () => {
      const profile = createTestProfile('user-123', 'user', 'John Doe');
      const user = createProfileUser(profile);

      expect(getUserName(user)).toBe('John Doe');
    });

    it('should return name for pseudouser type', () => {
      const pseudouser = createTestPseudouser('pseudo-123', 'Test Pseudouser');
      const user = createPseudouserUser(pseudouser);

      expect(getUserName(user)).toBe('Test Pseudouser');
    });
  });

  describe('getUserId', () => {
    it('should return id for user type', () => {
      const profile = createTestProfile('user-123');
      const user = createProfileUser(profile);

      expect(getUserId(user)).toBe('user-123');
    });

    it('should return id for pseudouser type', () => {
      const pseudouser = createTestPseudouser('pseudo-123');
      const user = createPseudouserUser(pseudouser);

      expect(getUserId(user)).toBe('pseudo-123');
    });
  });

  describe('mapToProfile', () => {
    it('should map valid data to Profile', () => {
      const data = {
        id: 'user-123',
        role: 'admin',
        display_name: 'Test User',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        email: 'test@example.com',
      };

      const profile = mapToProfile(data);

      expect(profile).toEqual(data);
    });

    it('should map data with null email', () => {
      const data = {
        id: 'user-123',
        role: 'user',
        display_name: 'Test User',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        email: null,
      };

      const profile = mapToProfile(data);

      expect(profile.email).toBeNull();
    });

    it('should handle unknown data structure', () => {
      const data: Profile & { extraField?: string } = {
        id: 'user-123',
        role: 'mod',
        display_name: 'Test',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        email: 'test@test.com',
        extraField: 'should be ignored',
      };

      const profile = mapToProfile(data);

      expect(profile.id).toBe('user-123');
      expect(profile.role).toBe('mod');
    });
  });

  describe('mapToPseudouser', () => {
    it('should map valid data to Pseudouser', () => {
      const data = {
        id: 'pseudo-123',
        name: 'Test Pseudouser',
        source: 'test-source',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const pseudouser = mapToPseudouser(data);

      expect(pseudouser).toEqual(data);
    });

    it('should handle unknown data structure', () => {
      const data: Pseudouser & { extraField?: string } = {
        id: 'pseudo-123',
        name: 'Test',
        source: 'source',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        extraField: 'ignored',
      };

      const pseudouser = mapToPseudouser(data);

      expect(pseudouser.id).toBe('pseudo-123');
      expect(pseudouser.name).toBe('Test');
    });
  });

  describe('mapToModel', () => {
    it('should map valid data to Model', () => {
      const data = {
        id: 'model-123',
        version: '1.0.0',
        admin_id: 'admin-123',
        metadata: { key: 'value' },
        description: 'Test model',
        is_active: true,
        file_hash: 'abc123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const model = mapToModel(data);

      expect(model).toEqual(data);
    });

    it('should map data with undefined optional fields', () => {
      const data = {
        id: 'model-123',
        version: '1.0.0',
        is_active: false,
        file_hash: 'abc123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const model = mapToModel(data);

      expect(model.admin_id).toBeUndefined();
      expect(model.metadata).toBeUndefined();
      expect(model.description).toBeUndefined();
    });
  });

  describe('mapToSignatureGenuine', () => {
    it('should map valid data to SignatureGenuine', () => {
      const data = {
        id: 'sig-123',
        user_id: 'user-123',
        pseudouser_id: undefined,
        features_table: 't,x,y,p\n1000,10,20,0.5',
        input_type: 'mouse',
        user_for_forgery: true,
        mod_for_forgery: false,
        mod_for_dataset: true,
        name: 'Test Signature',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const signature = mapToSignatureGenuine(data);

      expect(signature).toEqual(data);
    });

    it('should map data with pseudouser_id', () => {
      const data = {
        id: 'sig-123',
        user_id: undefined,
        pseudouser_id: 'pseudo-123',
        features_table: 't,x,y,p\n1000,10,20,0.5',
        input_type: 'touch',
        user_for_forgery: false,
        mod_for_forgery: true,
        mod_for_dataset: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const signature = mapToSignatureGenuine(data);

      expect(signature.pseudouser_id).toBe('pseudo-123');
      expect(signature.user_id).toBeUndefined();
    });
  });

  describe('mapToSignatureForged', () => {
    it('should map valid data to SignatureForged', () => {
      const data = {
        id: 'forged-123',
        original_signature_id: 'original-123',
        original_user_id: 'user-123',
        original_pseudouser_id: undefined,
        features_table: 't,x,y,p\n1000,10,20,0.5',
        input_type: 'pen',
        mod_for_dataset: true,
        score: 0.85,
        model_id: 'model-123',
        forger_id: 'forger-123',
        name: 'Forged Signature',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const signature = mapToSignatureForged(data);

      expect(signature).toEqual(data);
    });

    it('should map data with undefined optional fields', () => {
      const data = {
        id: 'forged-123',
        original_signature_id: undefined,
        original_user_id: undefined,
        original_pseudouser_id: undefined,
        features_table: 't,x,y,p\n1000,10,20,0.5',
        mod_for_dataset: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const signature = mapToSignatureForged(data);

      expect(signature.score).toBeUndefined();
      expect(signature.model_id).toBeUndefined();
      expect(signature.forger_id).toBeUndefined();
      expect(signature.name).toBeUndefined();
    });
  });

  describe('mapToEmbedding', () => {
    it('should map valid data to Embedding', () => {
      const data = {
        id: 'emb-123',
        genuine_signature_id: 'sig-123',
        forged_signature_id: undefined,
        embedding_vector: [0.1, 0.2, 0.3],
        dimension: 512,
        model_id: 'model-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const embedding = mapToEmbedding(data);

      expect(embedding).toEqual(data);
    });

    it('should map data with forged_signature_id', () => {
      const data = {
        id: 'emb-123',
        genuine_signature_id: undefined,
        forged_signature_id: 'forged-123',
        embedding_vector: [0.1, 0.2],
        dimension: 2,
        model_id: 'model-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const embedding = mapToEmbedding(data);

      expect(embedding.forged_signature_id).toBe('forged-123');
      expect(embedding.genuine_signature_id).toBeUndefined();
    });
  });

  describe('mapToUserEmbedding', () => {
    it('should map valid data to UserEmbedding', () => {
      const data = {
        id: 'user-emb-123',
        user_id: 'user-123',
        pseudouser_id: undefined,
        embedding_vector: [0.1, 0.2, 0.3],
        dimension: 512,
        model_id: 'model-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const embedding = mapToUserEmbedding(data);

      expect(embedding).toEqual(data);
    });

    it('should map data with pseudouser_id', () => {
      const data = {
        id: 'user-emb-123',
        user_id: undefined,
        pseudouser_id: 'pseudo-123',
        embedding_vector: [0.1, 0.2],
        dimension: 2,
        model_id: 'model-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const embedding = mapToUserEmbedding(data);

      expect(embedding.pseudouser_id).toBe('pseudo-123');
      expect(embedding.user_id).toBeUndefined();
    });
  });

  describe('mapToAdminToken', () => {
    it('should map valid data to AdminToken', () => {
      const data = {
        id: 'token-123',
        admin_id: 'admin-123',
        token_hash: 'hash123',
        created_at: '2024-01-01T00:00:00Z',
        expires_at: '2025-01-01T00:00:00Z',
        revoked: false,
      };

      const token = mapToAdminToken(data);

      expect(token).toEqual(data);
    });

    it('should map data with undefined expires_at', () => {
      const data = {
        id: 'token-123',
        admin_id: 'admin-123',
        token_hash: 'hash123',
        created_at: '2024-01-01T00:00:00Z',
        expires_at: undefined,
        revoked: true,
      };

      const token = mapToAdminToken(data);

      expect(token.expires_at).toBeUndefined();
      expect(token.revoked).toBe(true);
    });
  });
});
