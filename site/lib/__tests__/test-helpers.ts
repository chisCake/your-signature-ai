import {
  Profile,
  Pseudouser,
  Signature,
  SignatureForged,
  SignatureGenuine,
  SignaturePoint,
  User,
  UserRole,
} from '@/lib/types';

/**
 * Создает тестовую точку подписи
 */
export function createTestPoint(
  timestamp: number = Date.now(),
  x: number = 100,
  y: number = 100,
  pressure: number = 0.5
): SignaturePoint {
  return { timestamp, x, y, pressure };
}

/**
 * Создает массив тестовых точек подписи
 */
export function createTestPoints(count: number = 10): SignaturePoint[] {
  const points: SignaturePoint[] = [];
  const baseTime = Date.now();
  for (let i = 0; i < count; i++) {
    points.push(
      createTestPoint(
        baseTime + i * 10,
        100 + i * 5,
        100 + i * 3,
        0.5 + (i % 3) * 0.1
      )
    );
  }
  return points;
}

/**
 * Создает тестовый CSV для подписи
 */
export function createTestCSV(points: SignaturePoint[]): string {
  const csvRows = points.map(p => `${p.timestamp},${p.x},${p.y},${p.pressure}`);
  return 't,x,y,p\n' + csvRows.join('\n');
}

/**
 * Создает тестовый профиль пользователя
 */
export function createTestProfile(
  id: string = 'test-user-id',
  role: UserRole = 'user',
  displayName: string = 'Test User',
  email: string | null = 'test@example.com'
): Profile {
  const now = new Date().toISOString();
  return {
    id,
    role,
    display_name: displayName,
    created_at: now,
    updated_at: now,
    email,
  };
}

/**
 * Создает тестового псевдопользователя
 */
export function createTestPseudouser(
  id: string = 'test-pseudouser-id',
  name: string = 'Test Pseudouser',
  source: string = 'test-source'
): Pseudouser {
  const now = new Date().toISOString();
  return {
    id,
    name,
    source,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Создает тестовую настоящую подпись
 */
export function createTestGenuineSignature(
  id: string = 'test-genuine-id',
  userId?: string,
  pseudouserId?: string,
  points?: SignaturePoint[]
): SignatureGenuine {
  const now = new Date().toISOString();
  const testPoints = points || createTestPoints(20);
  return {
    id,
    user_id: userId,
    pseudouser_id: pseudouserId,
    features_table: createTestCSV(testPoints),
    input_type: 'mouse',
    user_for_forgery: false,
    mod_for_forgery: true,
    mod_for_dataset: true,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Создает тестовую поддельную подпись
 */
export function createTestForgedSignature(
  id: string = 'test-forged-id',
  originalSignatureId: string = 'test-original-id',
  originalUserId?: string,
  originalPseudouserId?: string,
  forgerId?: string,
  points?: SignaturePoint[]
): SignatureForged {
  const now = new Date().toISOString();
  const testPoints = points || createTestPoints(20);
  return {
    id,
    original_signature_id: originalSignatureId,
    original_user_id: originalUserId,
    original_pseudouser_id: originalPseudouserId,
    features_table: createTestCSV(testPoints),
    input_type: 'mouse',
    mod_for_dataset: true,
    forger_id: forgerId,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Создает тестовую подпись (объединенный тип)
 */
export function createTestSignature(
  type: 'genuine' | 'forged' = 'genuine',
  options?: {
    id?: string;
    userId?: string;
    pseudouserId?: string;
    points?: SignaturePoint[];
  }
): Signature {
  if (type === 'genuine') {
    return {
      type: 'genuine',
      data: createTestGenuineSignature(
        options?.id,
        options?.userId,
        options?.pseudouserId,
        options?.points
      ),
    };
  } else {
    return {
      type: 'forged',
      data: createTestForgedSignature(
        options?.id,
        'test-original-id',
        options?.userId,
        options?.pseudouserId,
        options?.userId,
        options?.points
      ),
    };
  }
}

/**
 * Создает тестового пользователя (объединенный тип)
 */
export function createTestUser(
  type: 'user' | 'pseudouser' = 'user',
  options?: {
    id?: string;
    role?: UserRole;
    name?: string;
  }
): User {
  if (type === 'user') {
    return {
      type: 'user',
      data: createTestProfile(
        options?.id,
        options?.role,
        options?.name || 'Test User'
      ),
    };
  } else {
    return {
      type: 'pseudouser',
      data: createTestPseudouser(
        options?.id,
        options?.name || 'Test Pseudouser'
      ),
    };
  }
}
