import { formatModSearchLabel } from '@/lib/utils/mod-client-utils';
import { createTestUser } from '@/lib/__tests__/test-helpers';

describe('mod-client-utils', () => {
  describe('formatModSearchLabel', () => {
    it('should return display_name for user type', () => {
      const user = createTestUser('user', {
        id: 'user-123',
        name: 'John Doe',
        role: 'user',
      });

      const label = formatModSearchLabel(user);

      expect(label).toBe('John Doe');
    });

    it('should return name for pseudouser type', () => {
      const user = createTestUser('pseudouser', {
        id: 'pseudo-123',
        name: 'Test Pseudouser',
      });

      const label = formatModSearchLabel(user);

      expect(label).toBe('Test Pseudouser');
    });

    it('should return display_name for admin user', () => {
      const user = createTestUser('user', {
        id: 'admin-123',
        name: 'Admin User',
        role: 'admin',
      });

      const label = formatModSearchLabel(user);

      expect(label).toBe('Admin User');
    });

    it('should return display_name for mod user', () => {
      const user = createTestUser('user', {
        id: 'mod-123',
        name: 'Mod User',
        role: 'mod',
      });

      const label = formatModSearchLabel(user);

      expect(label).toBe('Mod User');
    });

    it('should handle empty display_name for user', () => {
      const user = {
        type: 'user' as const,
        data: {
          id: 'user-123',
          role: 'user' as const,
          display_name: '',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          email: null,
        },
      };

      const label = formatModSearchLabel(user);

      expect(label).toBe('');
    });

    it('should handle empty name for pseudouser', () => {
      const user = {
        type: 'pseudouser' as const,
        data: {
          id: 'pseudo-123',
          name: '',
          source: 'test',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      };

      const label = formatModSearchLabel(user);

      expect(label).toBe('');
    });

    it('should handle long names', () => {
      const longName = 'A'.repeat(100);
      const user = createTestUser('user', {
        id: 'user-123',
        name: longName,
        role: 'user',
      });

      const label = formatModSearchLabel(user);

      expect(label).toBe(longName);
    });

    it('should handle special characters in names', () => {
      const specialName = "O'Brien-Smith & Co.";
      const user = createTestUser('user', {
        id: 'user-123',
        name: specialName,
        role: 'user',
      });

      const label = formatModSearchLabel(user);

      expect(label).toBe(specialName);
    });

    it('should handle unicode characters in names', () => {
      const unicodeName = 'Иван Петров';
      const user = createTestUser('user', {
        id: 'user-123',
        name: unicodeName,
        role: 'user',
      });

      const label = formatModSearchLabel(user);

      expect(label).toBe(unicodeName);
    });
  });
});
