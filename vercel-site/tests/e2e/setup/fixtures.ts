export type TestUserKey = 'admin' | 'mod' | 'user';

interface TestUser {
  email: string;
  password: string;
  role: TestUserKey;
}

export const testUsers: Record<TestUserKey, TestUser> = {
  admin: {
    email: 'admin@test.com',
    password: 'admin123',
    role: 'admin',
  },
  mod: {
    email: 'mod@test.com',
    password: 'mod123',
    role: 'mod',
  },
  user: {
    email: 'user@test.com',
    password: 'user123',
    role: 'user',
  },
};

