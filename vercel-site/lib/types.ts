export type UserRole = 'user' | 'mod' | 'admin';
export type UserType = 'user' | 'pseudouser';
export type SignatureType = 'genuine' | 'forged';
export type InputType = 'mouse' | 'touch' | 'pen';

/**
 * Объединенный тип для подписей
 * @type { 'genuine' | 'forged' } type - тип подписи
 * @type { SignatureGenuine | SignatureForged } data - данные подписи
 * @see Genuine {@link SignatureGenuine}
 * @see Forged {@link SignatureForged}
 */
export type Signature =
  | { type: 'genuine'; data: SignatureGenuine }
  | { type: 'forged'; data: SignatureForged };

/**
 * Объединенный тип для пользователей
 * @type { 'user' | 'pseudouser' } type - тип пользователя
 * @type { Profile | Pseudouser } data - данные пользователя
 * @see Profile {@link Profile}
 * @see Pseudouser {@link Pseudouser}
 */
export type User =
  | { type: 'user'; data: Profile }
  | { type: 'pseudouser'; data: Pseudouser };

// Типы для векторных данных подписи
export interface SignaturePoint {
  timestamp: number;
  x: number;
  y: number;
  pressure: number;
  tilt?: number;
  azimuth?: number;
  acceleration?: {
    x: number;
    y: number;
    z: number;
  };
  velocity?: {
    x: number;
    y: number;
  };
}

// ========================================
// БАЗОВЫЕ ТИПЫ ДЛЯ ТАБЛИЦ БД
// ========================================

/**
 * Таблица profiles
 * @type { string } id - id пользователя
 * @type { UserRole } role - роль пользователя
 * @type { string } display_name - отображаемое имя пользователя
 * @type { string } created_at - дата создания пользователя
 * @type { string } updated_at - дата последнего обновления пользователя
 * @type { string | null } email - email пользователя из auth.users
 */
export interface Profile {
  id: string;
  role: UserRole;
  display_name: string;
  created_at: string;
  updated_at: string;
  email: string | null;
}

/**
 * Таблица pseudousers
 * @type { string } id - id псевдопользователя
 * @type { string } name - имя псевдопользователя
 * @type { string } source - источник псевдопользователя
 * @type { string } created_at - дата создания псевдопользователя
 * @type { string } updated_at - дата последнего обновления псевдопользователя
 */
export interface Pseudouser {
  id: string;
  name: string;
  source: string;
  created_at: string;
  updated_at: string;
}

// Таблица models
export interface Model {
  id: string;
  version: string;
  admin_id?: string;
  metadata?: Record<string, unknown>;
  description?: string;
  is_active: boolean;
  file_hash: string;
  created_at: string;
  updated_at: string;
}

/**
 * Таблица genuine_signatures
 * @type { string } id - id подписи
 * @type { string | null } user_id - id пользователя
 * @type { string | null } pseudouser_id - id псевдопользователя
 * @type { string } features_table - csv данные подписи
 * @type { 'mouse' | 'touch' | 'pen' | undefined } input_type - тип ввода
 * @type { boolean } user_for_forgery - флаг пользователя для использования в качестве образца для подделки
 * @type { boolean } mod_for_forgery - флаг модератора для использования в качестве образца для подделки
 * @type { boolean } mod_for_dataset - флаг модератора для использования в датасете обучения
 * @type { string | null } name - имя подписи
 * @type { string } created_at - дата создания подписи
 * @type { string } updated_at - дата последнего обновления подписи
 */
export interface SignatureGenuine {
  id: string;
  user_id?: string;
  pseudouser_id?: string;
  features_table: string;
  input_type?: 'mouse' | 'touch' | 'pen';
  user_for_forgery: boolean;
  mod_for_forgery: boolean;
  mod_for_dataset: boolean;
  name?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Таблица forged_signatures
 * @type { string } id - id поддельной подписи
 * @type { string | null } original_signature_id - id оригинальной подписи
 * @type { string | null } original_user_id - id пользователя оригинальной подписи
 * @type { string | null } original_pseudouser_id - id псевдопользователя оригинальной подписи
 * @type { string } features_table - csv данные подписи
 * @type { 'mouse' | 'touch' | 'pen' | undefined } input_type - тип ввода
 * @type { boolean } mod_for_dataset - флаг модератора для использования в датасете обучения
 * @type { number | undefined } score - оценка поддельной подписи
 * @type { string | undefined } model_id - id модели
 * @type { string | undefined } forger_id - id пользователя, который создал поддельную подпись
 * @type { string | undefined } name - имя поддельной подписи
 * @type { string } created_at - дата создания поддельной подписи
 * @type { string } updated_at - дата последнего обновления поддельной подписи
 */
export interface SignatureForged {
  id: string;
  original_signature_id?: string;
  original_user_id?: string;
  original_pseudouser_id?: string;
  features_table: string;
  input_type?: 'mouse' | 'touch' | 'pen';
  mod_for_dataset: boolean;
  score?: number;
  model_id?: string;
  forger_id?: string;
  name?: string;
  created_at: string;
  updated_at: string;
}

// Таблица embeddings
export interface Embedding {
  id: string;
  genuine_signature_id?: string;
  forged_signature_id?: string;
  embedding_vector: number[]; // VECTOR(512)
  dimension: number;
  model_id: string;
  created_at: string;
  updated_at: string;
}

// Таблица user_embeddings
export interface UserEmbedding {
  id: string;
  user_id?: string;
  pseudouser_id?: string;
  embedding_vector: number[]; // VECTOR(512)
  dimension: number;
  model_id: string;
  created_at: string;
  updated_at: string;
}

// Таблица admin_tokens
export interface AdminToken {
  id: string;
  admin_id: string;
  token_hash: string;
  created_at: string;
  expires_at?: string;
  revoked: boolean;
}

// Преобразование SignatureGenuine | SignatureForged в Signature
export function mapToSignature(
  signature: SignatureGenuine | SignatureForged
): Signature {
  if (
    'original_signature_id' in signature ||
    'original_user_id' in signature ||
    'original_pseudouser_id' in signature
  ) {
    return { type: 'forged', data: signature as SignatureForged };
  } else {
    return { type: 'genuine', data: signature as SignatureGenuine };
  }
}

export function createProfileUser(profile: Profile): User {
  return { type: 'user', data: profile };
}

export function createPseudouserUser(pseudouser: Pseudouser): User {
  return { type: 'pseudouser', data: pseudouser };
}

export function createGenuineSignature(signature: SignatureGenuine): Signature {
  return { type: 'genuine', data: signature };
}

export function createForgedSignature(signature: SignatureForged): Signature {
  return { type: 'forged', data: signature };
}

// Функции для получения имени пользователя
export function getUserName(user: User): string {
  return user.type === 'user' ? user.data.display_name : user.data.name;
}

export function getUserId(user: User): string {
  return user.data.id;
}

// ========================================
// ФУНКЦИИ ПРЕОБРАЗОВАНИЯ ДАННЫХ ИЗ БД
// ========================================

// Преобразование данных профиля из БД в интерфейс Profile
export function mapToProfile(data: unknown): Profile {
  const d = data as Record<string, unknown>;
  return {
    id: d.id as string,
    role: d.role as UserRole,
    display_name: d.display_name as string,
    created_at: d.created_at as string,
    updated_at: d.updated_at as string,
    email: d.email as string | null,
  };
}

// Преобразование данных псевдопользователя из БД в интерфейс Pseudouser
export function mapToPseudouser(data: unknown): Pseudouser {
  const d = data as Record<string, unknown>;
  return {
    id: d.id as string,
    name: d.name as string,
    source: d.source as string,
    created_at: d.created_at as string,
    updated_at: d.updated_at as string,
  };
}

// Преобразование данных модели из БД в интерфейс Model
export function mapToModel(data: unknown): Model {
  const d = data as Record<string, unknown>;
  return {
    id: d.id as string,
    version: d.version as string,
    admin_id: d.admin_id as string | undefined,
    metadata: d.metadata as Record<string, unknown> | undefined,
    description: d.description as string | undefined,
    is_active: d.is_active as boolean,
    file_hash: d.file_hash as string,
    created_at: d.created_at as string,
    updated_at: d.updated_at as string,
  };
}

// Преобразование данных подлинной подписи из БД в интерфейс SignatureGenuine
export function mapToSignatureGenuine(data: unknown): SignatureGenuine {
  const d = data as Record<string, unknown>;
  return {
    id: d.id as string,
    user_id: d.user_id as string | undefined,
    pseudouser_id: d.pseudouser_id as string | undefined,
    features_table: d.features_table as string,
    input_type: d.input_type as 'mouse' | 'touch' | 'pen' | undefined,
    user_for_forgery: d.user_for_forgery as boolean,
    mod_for_forgery: d.mod_for_forgery as boolean,
    mod_for_dataset: d.mod_for_dataset as boolean,
    name: d.name as string,
    created_at: d.created_at as string,
    updated_at: d.updated_at as string,
  };
}

// Преобразование данных поддельной подписи из БД в интерфейс SignatureForged
export function mapToSignatureForged(data: unknown): SignatureForged {
  const d = data as Record<string, unknown>;
  return {
    id: d.id as string,
    original_signature_id: d.original_signature_id as string | undefined,
    original_user_id: d.original_user_id as string | undefined,
    original_pseudouser_id: d.original_pseudouser_id as string | undefined,
    features_table: d.features_table as string,
    input_type: d.input_type as 'mouse' | 'touch' | 'pen' | undefined,
    mod_for_dataset: d.mod_for_dataset as boolean,
    score: d.score as number | undefined,
    model_id: d.model_id as string | undefined,
    forger_id: d.forger_id as string | undefined,
    name: d.name as string,
    created_at: d.created_at as string,
    updated_at: d.updated_at as string,
  };
}

// Преобразование данных эмбеддинга из БД в интерфейс Embedding
export function mapToEmbedding(data: unknown): Embedding {
  const d = data as Record<string, unknown>;
  return {
    id: d.id as string,
    genuine_signature_id: d.genuine_signature_id as string | undefined,
    forged_signature_id: d.forged_signature_id as string | undefined,
    embedding_vector: d.embedding_vector as number[],
    dimension: d.dimension as number,
    model_id: d.model_id as string,
    created_at: d.created_at as string,
    updated_at: d.updated_at as string,
  };
}

// Преобразование данных пользовательского эмбеддинга из БД в интерфейс UserEmbedding
export function mapToUserEmbedding(data: unknown): UserEmbedding {
  const d = data as Record<string, unknown>;
  return {
    id: d.id as string,
    user_id: d.user_id as string | undefined,
    pseudouser_id: d.pseudouser_id as string | undefined,
    embedding_vector: d.embedding_vector as number[],
    dimension: d.dimension as number,
    model_id: d.model_id as string,
    created_at: d.created_at as string,
    updated_at: d.updated_at as string,
  };
}

// Преобразование данных админского токена из БД в интерфейс AdminToken
export function mapToAdminToken(data: unknown): AdminToken {
  const d = data as Record<string, unknown>;
  return {
    id: d.id as string,
    admin_id: d.admin_id as string,
    token_hash: d.token_hash as string,
    created_at: d.created_at as string,
    expires_at: d.expires_at as string,
    revoked: d.revoked as boolean,
  };
}
