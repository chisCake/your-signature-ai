'use client';

import { createBrowserClient } from '@/lib/supabase/client';
import {
  User,
  createProfileUser,
  createPseudouserUser,
  getUserName,
  Profile,
  Pseudouser,
  SignatureGenuine,
} from '@/lib/types';
import {
  profilesPrefixSearch,
  pseudousersPrefixSearch,
  profilesSubstrSearch,
  pseudousersSubstrSearch,
  getUserGenuineSignatures as getUserGenuineSignaturesQuery,
  getPseudouserByName,
  insertPseudouser,
  getUsers as getUsersQuery,
  getPseudousers as getPseudousersQuery,
} from '@/lib/supabase/queries';

export function formatModSearchLabel(item: User): string {
  return getUserName(item);
}

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

export async function getUserGenuineSignatures(
  userId: string,
  userType: 'user' | 'pseudouser' = 'user'
): Promise<SignatureGenuine[]> {
  const client = createBrowserClient();
  const signatures = await getUserGenuineSignaturesQuery(
    userId,
    client,
    userType
  );
  return signatures;
}

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

export async function getUsers(): Promise<Profile[]> {
  const client = createBrowserClient();
  const users = await getUsersQuery(client);
  return users;
}

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
