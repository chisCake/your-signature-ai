import { createBrowserClient } from '@/lib/supabase/client';
import {
  InputType,
  Profile,
  Pseudouser,
  Signature,
  SignatureForged,
  SignatureGenuine,
  SignatureType,
  User,
  createProfileUser,
  createPseudouserUser,
  mapToProfile,
  mapToPseudouser,
  mapToSignature,
  mapToSignatureForged,
  mapToSignatureGenuine,
} from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export const MIN_POINTS_FOR_SIGNATURE = 20;

export interface InsertGenuineSignatureData {
  user_id?: string;
  pseudouser_id?: string;
  features_table: string;
  input_type: InputType;
  user_for_forgery: boolean;
  mod_for_forgery: boolean;
  mod_for_dataset: boolean;
}

export interface InsertForgedSignatureData {
  original_signature_id: string;
  original_user_id?: string;
  original_pseudouser_id?: string;
  features_table: string;
  input_type: InputType;
  mod_for_dataset: boolean;
}

function getClient(client?: SupabaseClient): SupabaseClient {
  return client || createBrowserClient();
}

// ========================================
// GETS
// ========================================

/**
 * Получает профиль пользователя
 * @param id id пользователя для которого следует получить профиль
 * @param client клиент Supabase {@link SupabaseClient}
 * @returns Profile, если профиль найден, null если пользователь не найден
 */
export async function getProfile(
  id: string,
  client?: SupabaseClient
): Promise<Profile | null> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Ошибка получения профиля:', error);
    return null;
  }

  return mapToProfile(data);
}

/**
 * Получает псевдопользователя
 * @param id id псевдопользователя для которого следует получить псевдопользователя
 * @param client клиент Supabase {@link SupabaseClient}
 * @returns Pseudouser, если псевдопользователь найден, null если псевдопользователь не найден
 */
export async function getPseudouser(
  id: string,
  client?: SupabaseClient
): Promise<Pseudouser | null> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('pseudousers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Ошибка получения псевдопользователя:', error);
    return null;
  }
  return mapToPseudouser(data);
}

export async function searchUser(
  id: string,
  client?: SupabaseClient
): Promise<User | null> {
  const [user, pseudouser] = await Promise.all([
    getProfile(id, client),
    getPseudouser(id, client),
  ]);
  return user
    ? createProfileUser(user)
    : pseudouser
      ? createPseudouserUser(pseudouser)
      : null;
}

export async function getUsers(client?: SupabaseClient): Promise<Profile[]> {
  const supabase = getClient(client);
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error('Ошибка получения пользователей:', error);
    return [];
  }
  return data.map(mapToProfile);
}

export async function getPseudousers(
  client?: SupabaseClient
): Promise<Pseudouser[]> {
  const supabase = getClient(client);
  const { data, error } = await supabase.from('pseudousers').select('*');
  if (error) {
    console.error('Ошибка получения псевдопользователей:', error);
    return [];
  }
  return data.map(mapToPseudouser);
}

export async function getEmail(
  id: string,
  client?: SupabaseClient
): Promise<string | null> {
  const supabase = getClient(client);
  const { data, error } = await supabase.rpc('get_user_email', {
    profile_id: id,
  });

  if (error) {
    console.error('Ошибка получения email:', error);
    return null;
  }
  return data;
}

export async function getSignature(
  id: string,
  type: SignatureType,
  client?: SupabaseClient
): Promise<Signature | null> {
  const signature =
    type === 'genuine'
      ? await getGenuineSignature(id, client)
      : await getForgedSignature(id, client);
  return signature ? mapToSignature(signature) : null;
}

export async function getGenuineSignature(
  id: string,
  client?: SupabaseClient
): Promise<SignatureGenuine | null> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('genuine_signatures')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[getGenuineSignature] error', error);
    return null;
  }
  return data ? mapToSignatureGenuine(data) : null;
}

export async function getForgedSignature(
  id: string,
  client?: SupabaseClient
): Promise<SignatureForged | null> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('forged_signatures')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[getForgedSignature] error', error);
    return null;
  }

  return data ? mapToSignatureForged(data) : null;
}

export async function searchSignature(
  id: string,
  client?: SupabaseClient
): Promise<Signature | null> {
  const supabase = getClient(client);
  const { data: genuine } = await supabase
    .from('genuine_signatures')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data: forged } = await supabase
    .from('forged_signatures')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (genuine) {
    return mapToSignature(genuine);
  }
  if (forged) {
    return mapToSignature(forged);
  }

  return null;
}

export async function getUserGenuineSignatures(
  id: string,
  userType: 'user' | 'pseudouser',
  client?: SupabaseClient,
  limit: number = 100
): Promise<SignatureGenuine[]> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('genuine_signatures')
    .select('*')
    .eq(userType === 'user' ? 'user_id' : 'pseudouser_id', id)
    .limit(limit);

  if (error) {
    console.error('Ошибка получения подписей:', error);
    return [];
  }
  return data.map(mapToSignatureGenuine);
}

export async function getUserForgedSignatures(
  id: string,
  userType: 'user' | 'pseudouser',
  client?: SupabaseClient,
  limit: number = 100
): Promise<SignatureForged[]> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('forged_signatures')
    .select('*')
    .eq(userType === 'user' ? 'user_id' : 'pseudouser_id', id)
    .limit(limit);

  if (error) {
    console.error('Ошибка получения подделок:', error);
    return [];
  }
  return data.map(mapToSignatureForged);
}

export async function getGenuineSignaturesAmount(
  client?: SupabaseClient,
  dateFrom?: Date,
  dateTo?: Date
): Promise<number> {
  const supabase = getClient(client);

  let query = supabase
    .from('genuine_signatures')
    .select('id', { count: 'exact', head: true });

  if (dateFrom) {
    query = query.gte('created_at', dateFrom.toISOString());
  }
  if (dateTo) {
    query = query.lte('created_at', dateTo.toISOString());
  }

  const { count, error } = await query;

  if (error) {
    console.error('Ошибка получения количества подписей:', error);
    return 0;
  }

  return count || 0;
}

export async function getForgedSignaturesAmount(
  client?: SupabaseClient,
  dateFrom?: Date,
  dateTo?: Date
): Promise<number> {
  const supabase = getClient(client);

  let query = supabase
    .from('forged_signatures')
    .select('id', { count: 'exact', head: true });

  if (dateFrom) {
    query = query.gte('created_at', dateFrom.toISOString());
  }
  if (dateTo) {
    query = query.lte('created_at', dateTo.toISOString());
  }

  const { count, error } = await query;

  if (error) {
    console.error('Ошибка получения количества подделок:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Получает статистику по типам ввода для всех подписей
 * Использует оптимизированную RPC функцию для подсчета в БД
 * @param client клиент Supabase
 * @param dateFrom опциональная дата начала периода
 * @param dateTo опциональная дата конца периода
 * @returns объект с количеством подписей по каждому типу ввода
 */
export async function getInputTypeStats(
  client?: SupabaseClient,
  dateFrom?: Date,
  dateTo?: Date
): Promise<{ mouse: number; touch: number; pen: number }> {
  const supabase = getClient(client);

  const { data, error } = await supabase.rpc('get_input_type_stats', {
    date_from: dateFrom?.toISOString() || null,
    date_to: dateTo?.toISOString() || null,
  });

  if (error) {
    console.error('Ошибка получения статистики по типам ввода:', error);
    return { mouse: 0, touch: 0, pen: 0 };
  }

  const stats = {
    mouse: 0,
    touch: 0,
    pen: 0,
  };

  // Преобразуем результат в нужный формат
  data?.forEach((row: { input_type: string; count: number }) => {
    if (row.input_type === 'mouse') stats.mouse = Number(row.count);
    else if (row.input_type === 'touch') stats.touch = Number(row.count);
    else if (row.input_type === 'pen') stats.pen = Number(row.count);
  });

  return stats;
}

// TODO: where profile/pseudouser, source for pseudouser
export async function getGenuineSignatures(
  client?: SupabaseClient,
  limit: number = 100,
  offset: number = 0,
  dateFrom?: Date,
  dateTo?: Date
): Promise<SignatureGenuine[]> {
  const supabase = getClient(client);

  let query = supabase
    .from('genuine_signatures')
    .select('*')
    .order('created_at', { ascending: false });

  if (dateFrom) {
    query = query.gte('created_at', dateFrom.toISOString());
  }
  if (dateTo) {
    query = query.lte('created_at', dateTo.toISOString());
  }

  const { data, error } = await query
    .limit(limit)
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Ошибка получения подписей:', error);
    return [];
  }
  return data.map(mapToSignatureGenuine);
}

export async function getForgedSignatures(
  client?: SupabaseClient,
  limit: number = 100,
  offset: number = 0,
  dateFrom?: Date,
  dateTo?: Date
): Promise<SignatureForged[]> {
  const supabase = getClient(client);

  let query = supabase
    .from('forged_signatures')
    .select('*')
    .order('created_at', { ascending: false });

  if (dateFrom) {
    query = query.gte('created_at', dateFrom.toISOString());
  }
  if (dateTo) {
    query = query.lte('created_at', dateTo.toISOString());
  }

  const { data, error } = await query
    .limit(limit)
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Ошибка получения подделок:', error);
    return [];
  }
  return data.map(mapToSignatureForged);
}

export async function profilesPrefixSearch(
  queryRaw: string,
  limit: number = 10,
  client?: SupabaseClient
): Promise<Profile[]> {
  const query = (queryRaw || '').trim();
  if (!query) return [];

  const supabase = getClient(client);
  const prefixPattern = `${query}%`;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, display_name, created_at, updated_at')
    .ilike('display_name', prefixPattern)
    .order('display_name', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Profiles prefix search error', error);
    return [];
  }
  return data.map(mapToProfile);
}

export async function pseudousersPrefixSearch(
  queryRaw: string,
  limit: number = 10,
  client?: SupabaseClient
): Promise<Pseudouser[]> {
  const query = (queryRaw || '').trim();
  if (!query) return [];

  const supabase = getClient(client);
  const prefixPattern = `${query}%`;

  const { data, error } = await supabase
    .from('pseudousers')
    .select('*')
    .ilike('name', prefixPattern)
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Pseudousers prefix search error', error);
    return [];
  }
  return data.map(mapToPseudouser);
}

export async function profilesSubstrSearch(
  queryRaw: string,
  limit: number = 10,
  client?: SupabaseClient
): Promise<Profile[]> {
  const query = (queryRaw || '').trim();
  if (!query) return [];

  const supabase = getClient(client);
  const prefixPattern = `${query}%`;
  const substrPattern = `%${query}%`;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, display_name, created_at, updated_at')
    .ilike('display_name', substrPattern)
    .not('display_name', 'ilike', prefixPattern)
    .order('display_name', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Profiles substr search error', error);
    return [];
  }
  return data.map(mapToProfile);
}

export async function pseudousersSubstrSearch(
  queryRaw: string,
  limit: number = 10,
  client?: SupabaseClient
): Promise<Pseudouser[]> {
  const query = (queryRaw || '').trim();
  if (!query) return [];

  const supabase = getClient(client);
  const prefixPattern = `${query}%`;
  const substrPattern = `%${query}%`;

  const { data, error } = await supabase
    .from('pseudousers')
    .select('*')
    .ilike('name', substrPattern)
    .not('name', 'ilike', prefixPattern)
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Pseudousers substr search error', error);
    return [];
  }
  return data.map(mapToPseudouser);
}

export async function getPseudouserByName(
  name: string,
  client?: SupabaseClient
): Promise<Pseudouser | null> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('pseudousers')
    .select('*')
    .eq('name', name)
    .maybeSingle();

  if (error) {
    console.error('Pseudouser by name search error', error);
    return null;
  }
  return data ? mapToPseudouser(data) : null;
}

// ========================================
// INSERTS
// ========================================

export async function insertGenuineSignature(
  signature: InsertGenuineSignatureData,
  client?: SupabaseClient
): Promise<SignatureGenuine | null> {
  if (
    signature.features_table.split('\n').slice(1).length <
    MIN_POINTS_FOR_SIGNATURE
  ) {
    throw new Error(
      `Минимальное количество точек для подписи - ${MIN_POINTS_FOR_SIGNATURE}`
    );
  }

  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('genuine_signatures')
    .insert(signature)
    .select('*')
    .single();

  if (error) {
    console.error('Insert genuine signature error', error);
    return null;
  }

  return data ? mapToSignatureGenuine(data) : null;
}

export async function insertForgedSignature(
  signature: InsertForgedSignatureData,
  client?: SupabaseClient
): Promise<SignatureForged | null> {
  if (
    signature.features_table.split('\n').slice(1).length <
    MIN_POINTS_FOR_SIGNATURE
  ) {
    throw new Error(
      `Минимальное количество точек для подписи - ${MIN_POINTS_FOR_SIGNATURE}`
    );
  }

  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('forged_signatures')
    .insert(signature)
    .select('*')
    .single();

  if (error) {
    console.error('Insert forged signature error', error);
    return null;
  }

  return data ? mapToSignatureForged(data) : null;
}

export async function insertPseudouser(
  pseudouser: { name: string; source: string },
  client?: SupabaseClient
): Promise<Pseudouser | null> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from('pseudousers')
    .insert({ name: pseudouser.name, source: pseudouser.source })
    .select('*')
    .single();

  if (error) {
    console.error('Insert pseudouser error', error);
    return null;
  }

  return mapToPseudouser(data);
}

// ========================================
// UPDATES
// ========================================

/**
 * Обновляет поле user_for_forgery подписи
 * @param signatureId id **настоящей** подписи
 * @param userForForgery true, если подпись предназначена для подделки
 * @param client клиент Supabase {@link SupabaseClient}
 * @returns true, если подпись успешно обновлена, false в противном случае
 */
export async function updateUserForForgery(
  signatureId: string,
  userForForgery: boolean,
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = getClient(client);
  const { error } = await supabase
    .from('genuine_signatures')
    .update({ user_for_forgery: userForForgery })
    .eq('id', signatureId);

  if (error) {
    console.error('Update user_for_forgery error', error);
    return false;
  }

  return true;
}

/**
 * Обновляет поле mod_for_forgery подписи
 * @param signatureId id **настоящей** подписи
 * @param modForForgery true, если подпись предназначена для подделки
 * @param client клиент Supabase {@link SupabaseClient}
 * @returns true, если подпись успешно обновлена, false в противном случае
 */
export async function updateModForForgery(
  signatureId: string,
  modForForgery: boolean,
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = getClient(client);
  const { error } = await supabase
    .from('genuine_signatures')
    .update({ mod_for_forgery: modForForgery })
    .eq('id', signatureId);

  if (error) {
    console.error('Update mod_for_forgery error', error);
    return false;
  }

  return true;
}

/**
 * Обновляет поле mod_for_dataset подписи
 * @param signatureId id подписи
 * @param modForDataset true, если подпись предназначена для датасета
 * @param signatureType тип подписи ('genuine' | 'forged')
 * @param client клиент Supabase {@link SupabaseClient}
 * @returns true, если подпись успешно обновлена, false в противном случае
 */
export async function updateModForDataset(
  signatureId: string,
  modForDataset: boolean,
  signatureType: 'genuine' | 'forged',
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = getClient(client);
  const { error } = await supabase
    .from(
      signatureType === 'genuine' ? 'genuine_signatures' : 'forged_signatures'
    )
    .update({ mod_for_dataset: modForDataset })
    .eq('id', signatureId);

  if (error) {
    console.error('Update mod_for_dataset error', error);
    return false;
  }

  return true;
}

/**
 * Обновляет поле user_for_forgery для всех подписей пользователя
 * @param userId id пользователя
 * @param userForForgery true, если подпись предназначена для подделки
 * @param userType тип пользователя ('user' | 'pseudouser')
 * @param client клиент Supabase {@link SupabaseClient}
 * @returns true, если подписи успешно обновлены, false в противном случае
 */
export async function updateAllUserForForgery(
  userId: string,
  userForForgery: boolean,
  userType: 'user' | 'pseudouser',
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = getClient(client);
  const { error } = await supabase
    .from('genuine_signatures')
    .update({ user_for_forgery: userForForgery })
    .eq(userType === 'user' ? 'user_id' : 'pseudouser_id', userId);

  if (error) {
    console.error('Update user_for_forgery error', error);
    return false;
  }

  return true;
}

export async function updateAllModForForgery(
  userId: string,
  modForForgery: boolean,
  userType: 'user' | 'pseudouser',
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = getClient(client);
  const { error } = await supabase
    .from('genuine_signatures')
    .update({ mod_for_forgery: modForForgery })
    .eq(userType === 'user' ? 'user_id' : 'pseudouser_id', userId);

  if (error) {
    console.error('Update mod_for_forgery error', error);
    return false;
  }

  return true;
}

/**
 * Обновляет поле mod_for_dataset для всех подписей пользователя
 * @param userId id пользователя
 * @param modForDataset true, если подпись предназначена для датасета
 * @param userType тип пользователя ('user' | 'pseudouser')
 * @param signatureType тип подписи ('genuine' | 'forged')
 * @param client клиент Supabase {@link SupabaseClient}
 * @returns true, если подписи успешно обновлены, false в противном случае
 */
export async function updateAllModForDataset(
  userId: string,
  modForDataset: boolean,
  userType: 'user' | 'pseudouser',
  signatureType: 'genuine' | 'forged',
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = getClient(client);
  const { error } = await supabase
    .from(
      signatureType === 'genuine' ? 'genuine_signatures' : 'forged_signatures'
    )
    .update({ mod_for_dataset: modForDataset })
    .eq(userType === 'user' ? 'user_id' : 'pseudouser_id', userId);

  if (error) {
    console.error('Update mod_for_dataset error', error);
    return false;
  }

  return true;
}

// ========================================
// DELETES
// ========================================

/**
 * Удаляет подпись
 * @param signatureId id подписи
 * @param signatureType тип подписи ('genuine' | 'forged')
 * @param client клиент Supabase {@link SupabaseClient}
 * @returns true, если подпись успешно удалена, false в противном случае
 */
export async function deleteSignature(
  signatureId: string,
  signatureType: SignatureType,
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = getClient(client);

  const { error } = await supabase
    .from(
      signatureType === 'genuine' ? 'genuine_signatures' : 'forged_signatures'
    )
    .delete()
    .eq('id', signatureId);

  if (error) {
    console.error('Delete signature error', error);
    return false;
  }

  return true;
}

// export async function getRecentSignatures(
//     client?: SupabaseClient,
//     limitPerType: number = 50,
// ): Promise<Signature[]> {
//     const genuine = await getGenuineSignatures(supabase, limitPerType, 0);
//     const forged = await getForgedSignatures(supabase, limitPerType, 0);
//     return [...genuine, ...forged];
// }
