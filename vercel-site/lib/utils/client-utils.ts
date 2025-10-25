import { getProfile as getProfileQuery, getPseudouser } from '@/lib/supabase/queries';
import { createProfileUser, createPseudouserUser, isSignatureGenuine, Profile, Signature, User } from '@/lib/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Получает профиль пользователя
 * @param userId id пользователя для которого следует получить профиль
 * @param client клиент Supabase
 * @returns Профиль {@link Profile} пользователя или null, если пользователь не найден
 */
export async function getProfile(userId: string, client: SupabaseClient): Promise<Profile | null> {
  return await getProfileQuery(userId, client);
}

/**
 * Получает владельца подписи
 * @param signature подпись из которой следует получить владельца
 * @param client клиент Supabase
 * @returns Владельца {@link User} подписи или null, если подпись из внешнего датасета/источника
 */
export async function getSignatureOwner(signature: Signature, client: SupabaseClient): Promise<User | null> {
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