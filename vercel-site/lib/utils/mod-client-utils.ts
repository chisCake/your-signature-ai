'use client';

import { createBrowserClient } from '@/lib/supabase/client';
import {
  getProfile as getProfileQuery,
  getPseudouser,
  getPseudouserByName,
  getPseudousers as getPseudousersQuery,
  getUserGenuineSignatures as getUserGenuineSignaturesQuery,
  getUsers as getUsersQuery,
  insertPseudouser,
  profilesPrefixSearch,
  profilesSubstrSearch,
  pseudousersPrefixSearch,
  pseudousersSubstrSearch,
} from '@/lib/supabase/queries';
import {
  Profile,
  Pseudouser,
  Signature,
  SignatureGenuine,
  User,
  UserType,
  createProfileUser,
  createPseudouserUser,
  getUserName,
  isSignatureGenuine,
} from '@/lib/types';

export function formatModSearchLabel(item: User): string {
  return getUserName(item);
}

/**
 * Поиск пользователей и псевдопользователей
 * @param queryRaw строка запроса для поиска
 * @param limit максимальное количество результатов
 * @returns User[] - список найденных пользователей и псевдопользователей
 */
export async function searchUsersAndPseudousers(
  queryRaw: string,
  limit: number = 10
) {
  const client = createBrowserClient();

  const [profilesPrefix, pseudousersPrefix, profilesSubstr, pseudousersSubstr] =
    await Promise.all([
      profilesPrefixSearch(queryRaw, limit, client),
      pseudousersPrefixSearch(queryRaw, limit, client),
      profilesSubstrSearch(queryRaw, limit, client),
      pseudousersSubstrSearch(queryRaw, limit, client),
    ]);

  const listA: User[] =
    (profilesPrefix || []).map((p: Profile) => createProfileUser(p)) || [];
  const listB: User[] =
    (pseudousersPrefix || []).map((p: Pseudouser) => createPseudouserUser(p)) ||
    [];
  const listC: User[] =
    (profilesSubstr || []).map((p: Profile) => createProfileUser(p)) || [];
  const listD: User[] =
    (pseudousersSubstr || []).map((p: Pseudouser) => createPseudouserUser(p)) ||
    [];

  const combined: User[] = [];
  for (const bucket of [listA, listB, listC, listD]) {
    for (const item of bucket) {
      combined.push(item);
      if (combined.length >= limit) {
        return combined;
      }
    }
  }

  return combined;
}

/**
 * Получает все настоящие подписи пользователя
 * @param userId id пользователя для которого следует получить настоящие подписи
 * @param userType тип пользователя: 'user' - пользователь, 'pseudouser' - псевдопользователь
 * @returns SignatureGenuine[] - список всех настоящих подписей пользователя
 */
export async function getUserGenuineSignatures(
  userId: string,
  userType: UserType = 'user'
): Promise<SignatureGenuine[]> {
  const client = createBrowserClient();
  const signatures = await getUserGenuineSignaturesQuery(
    userId,
    client,
    userType
  );
  return signatures;
}

/**
 * Создает псевдопользователя, если он не существует
 * @param name имя псевдопользователя
 * @param source источник псевдопользователя
 * @returns { pseudouser: Pseudouser; created: boolean } - псевдопользователь и флаг, создан ли он
 */
export async function ensurePseudouser(
  name: string,
  source: string
): Promise<{ pseudouser: Pseudouser; created: boolean }> {
  const client = createBrowserClient();
  let pseudouser = await getPseudouserByName(name, client);
  let created = false;
  if (!pseudouser) {
    pseudouser = await insertPseudouser({ name, source }, client);
    created = true;
  }
  if (!pseudouser) {
    throw new Error('Failed to create pseudouser');
  }
  return { pseudouser, created };
}

/**
 * Получает всех пользователей
 * @returns Profile[] - список всех пользователей
 */
export async function getUsers(): Promise<Profile[]> {
  const client = createBrowserClient();
  const users = await getUsersQuery(client);
  return users;
}

/**
 * Получает всех псевдопользователей
 * @returns Pseudouser[] - список всех псевдопользователей
 */
export async function getPseudousers(): Promise<Pseudouser[]> {
  const client = createBrowserClient();
  const pseudousers = await getPseudousersQuery(client);
  return pseudousers;
}

export async function getUserData(userId: string): Promise<Profile | null> {
  const response = await fetch(`/api/users/${userId}`);
  const json = await response.json();
  return { ...json.profile, email: json.email };
}

/**
 * Получает профиль пользователя
 * @param userId id пользователя для которого следует получить профиль
 * @returns Профиль {@link Profile} пользователя или null, если пользователь не найден
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const client = createBrowserClient();
  const profile = await getProfileQuery(userId, client);
  return profile;
}

/**
 * Получает владельца подписи
 * @param signature подпись из которой следует получить владельца
 * @returns Владельца {@link User} подписи или null, если подпись из внешнего датасета/источника
 */
export async function getSignatureOwner(signature: Signature): Promise<User | null> {
  const client = createBrowserClient();
  if (isSignatureGenuine(signature)) {
      const ownerId = signature.user_id;
      if (!ownerId) {
        // Подпись из внешнего датасета
        return null;
      }
      const ownerProfile = await getProfileQuery(ownerId, client);
      return ownerProfile ? createProfileUser(ownerProfile) : null;
    }
    else {
      const ownerId = signature.forger_id;
      if (!ownerId) {
        // Подпись из внешнего датасета
        return null;
      }
      const ownerPseudouser = await getPseudouser(ownerId, client);
      return ownerPseudouser ? createPseudouserUser(ownerPseudouser) : null;
    }
}