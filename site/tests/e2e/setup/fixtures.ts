export type TestUserKey = 'admin' | 'mod' | 'user';

interface TestUser {
  email: string;
  password: string;
  role: TestUserKey;
}

export const testUsers: Record<TestUserKey, TestUser> = {
  admin: {
    email: 'admin@example.com',
    password: '*GtwY+irGTw2-D%L',
    role: 'admin',
  },
  mod: {
    email: 'mod@example.com',
    password: '*_tt_*8#Z.6647F',
    role: 'mod',
  },
  user: {
    email: 'user@example.com',
    password: 'R@#6$y!qzcEfM9S',
    role: 'user',
  },
};
