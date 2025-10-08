export type UserRole = 'user' | 'mod' | 'admin';

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

// Таблица profiles
export interface Profile {
  id: string;
  role: UserRole;
  display_name: string;
  created_at: string;
  updated_at: string;
  email: string | null; // email пользователя из auth.users
}

// Таблица pseudousers
export interface Pseudouser {
  id: string;
  name: string;
  source: string;
  created_at: string;
  updated_at: string;
}

// Объединенный тип для пользователей
export type User = 
  | { type: 'user'; data: Profile }
  | { type: 'pseudouser'; data: Pseudouser };

// Вспомогательные типы для определения типа пользователя
export type UserType = 'user' | 'pseudouser';
export type SignatureType = 'genuine' | 'forged';

// Таблица models
export interface Model {
  id: string;
  version: string;
  admin_id?: string;
  metadata?: Record<string, any>;
  description?: string;
  is_active: boolean;
  file_hash: string;
  created_at: string;
  updated_at: string;
}

// Таблица genuine_signatures
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

// Таблица forged_signatures
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

// Объединенный тип для подписей
export type Signature = SignatureGenuine | SignatureForged;

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

// ========================================
// СТАРЫЕ ТИПЫ (для обратной совместимости)
// ========================================

// Устаревший интерфейс Signature - используйте SignatureGenuine или SignatureForged
export interface SignatureLegacy {
  id: string;
  user_id?: string;
  csv_header: string; // первая строка CSV, например: "t,x,y,p"
  csv_rows: string;   // строки данных CSV без заголовка
  user_for_forgery?: boolean;
  mod_for_forgery?: boolean;
  mod_for_dataset?: boolean;
  created_at: string;
  updated_at: string;
}

// ========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ТИПОВ
// ========================================

// Type guards для определения типа пользователя
export function isProfile(user: User): user is { type: 'user'; data: Profile } {
  return user.type === 'user';
}

export function isPseudouser(user: User): user is { type: 'pseudouser'; data: Pseudouser } {
  return user.type === 'pseudouser';
}

// Type guards для определения типа подписи
export function isSignatureGenuine(signature: Signature): signature is SignatureGenuine {
  return 'user_id' in signature || 'pseudouser_id' in signature;
}

export function isSignatureForged(signature: Signature): signature is SignatureForged {
  return 'original_signature_id' in signature || 'original_user_id' in signature || 'original_pseudouser_id' in signature;
}

// Вспомогательные функции для создания объектов User
export function createProfileUser(profile: Profile): User {
  return { type: 'user', data: profile };
}

export function createPseudouserUser(pseudouser: Pseudouser): User {
  return { type: 'pseudouser', data: pseudouser };
}

// Функции для получения имени пользователя
export function getUserName(user: User): string {
  if (isProfile(user)) {
    return user.data.display_name;
  } else {
    return user.data.name;
  }
}

export function getUserId(user: User): string {
  return user.data.id;
}

// Подпись принадлежит настоящему пользователю или псевдопользователю
export function isSignatureBelongsToProfile(signature: Signature): boolean {
  return isSignatureGenuine(signature) ? signature.user_id !== null : signature.original_user_id !== null;
}

// ========================================
// ФУНКЦИИ ПРЕОБРАЗОВАНИЯ ДАННЫХ ИЗ БД
// ========================================

// Преобразование данных профиля из БД в интерфейс Profile
export function mapToProfile(data: any): Profile {
  return {
    id: data.id,
    role: data.role,
    display_name: data.display_name,
    created_at: data.created_at,
    updated_at: data.updated_at,
    email: data.email ?? null,
  };
}

// Преобразование данных псевдопользователя из БД в интерфейс Pseudouser
export function mapToPseudouser(data: any): Pseudouser {
  console.log(data);
  return {
    id: data.id,
    name: data.name,
    source: data.source,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// Преобразование данных модели из БД в интерфейс Model
export function mapToModel(data: any): Model {
  return {
    id: data.id,
    version: data.version,
    admin_id: data.admin_id,
    metadata: data.metadata,
    description: data.description,
    is_active: data.is_active,
    file_hash: data.file_hash,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// Преобразование данных подлинной подписи из БД в интерфейс SignatureGenuine
export function mapToSignatureGenuine(data: any): SignatureGenuine {
  return {
    id: data.id,
    user_id: data.user_id,
    pseudouser_id: data.pseudouser_id,
    features_table: data.features_table,
    input_type: data.input_type,
    user_for_forgery: data.user_for_forgery,
    mod_for_forgery: data.mod_for_forgery,
    mod_for_dataset: data.mod_for_dataset,
    name: data.name,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// Преобразование данных поддельной подписи из БД в интерфейс SignatureForged
export function mapToSignatureForged(data: any): SignatureForged {
  return {
    id: data.id,
    original_signature_id: data.original_signature_id,
    original_user_id: data.original_user_id,
    original_pseudouser_id: data.original_pseudouser_id,
    features_table: data.features_table,
    input_type: data.input_type,
    mod_for_dataset: data.mod_for_dataset,
    score: data.score,
    model_id: data.model_id,
    forger_id: data.forger_id,
    name: data.name,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// Преобразование данных эмбеддинга из БД в интерфейс Embedding
export function mapToEmbedding(data: any): Embedding {
  return {
    id: data.id,
    genuine_signature_id: data.genuine_signature_id,
    forged_signature_id: data.forged_signature_id,
    embedding_vector: data.embedding_vector,
    dimension: data.dimension,
    model_id: data.model_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// Преобразование данных пользовательского эмбеддинга из БД в интерфейс UserEmbedding
export function mapToUserEmbedding(data: any): UserEmbedding {
  return {
    id: data.id,
    user_id: data.user_id,
    pseudouser_id: data.pseudouser_id,
    embedding_vector: data.embedding_vector,
    dimension: data.dimension,
    model_id: data.model_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// Преобразование данных админского токена из БД в интерфейс AdminToken
export function mapToAdminToken(data: any): AdminToken {
  return {
    id: data.id,
    admin_id: data.admin_id,
    token_hash: data.token_hash,
    created_at: data.created_at,
    expires_at: data.expires_at,
    revoked: data.revoked,
  };
}

// Преобразование данных устаревшей подписи из БД в интерфейс SignatureLegacy
export function mapToSignatureLegacy(data: any): SignatureLegacy {
  return {
    id: data.id,
    user_id: data.user_id,
    csv_header: data.csv_header,
    csv_rows: data.csv_rows,
    user_for_forgery: data.user_for_forgery,
    mod_for_forgery: data.mod_for_forgery,
    mod_for_dataset: data.mod_for_dataset,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}
