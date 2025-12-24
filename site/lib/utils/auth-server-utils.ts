import { getProfile } from '@/lib/supabase/queries';
import { createServerClient } from '@/lib/supabase/server';
import { Profile } from '@/lib/types';
import { hasRole } from '@/lib/utils/auth-utils';
import { JwtPayload } from '@supabase/auth-js';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Получает информацию о текущем авторизованном пользователе
 * @param client клиент Supabase {@link SupabaseClient}
 * @returns Информация {@link JwtPayload} о пользователе или null, если пользователь не авторизован
 */
export async function getUser(
  client?: SupabaseClient
): Promise<JwtPayload | null> {
  const supabase = client || (await createServerClient());
  const { data, error } = await supabase.auth.getClaims();

  if (error) {
    console.warn('[getUser] Error getting user claims:', error);
    return null;
  }

  if (!data?.claims) {
    return null;
  }

  return data.claims;
}

/**
 * Получает профиль текущего авторизованного пользователя
 * @param client клиент Supabase {@link SupabaseClient}
 * @returns Профиль {@link Profile} пользователя или null, если пользователь не авторизован
 */
export async function getUserProfile(
  client?: SupabaseClient
): Promise<Profile | null> {
  try {
    const supabase = client || (await createServerClient());
    const user = await getUser(supabase);
    if (!user?.sub) {
      return null;
    }

    const profile = await getProfile(user.sub, supabase);

    if (!profile) {
      return null;
    }

    profile.email = user.email || null;

    return profile;
  } catch (error) {
    console.warn('[getUserProfile] Error getting user profile:', error);
    return null;
  }
}

export async function isMod(user: unknown = null) {
  const userToCheck = user || (await getUser());
  const result = hasRole(userToCheck, 'mod');
  return result;
}

export async function isAdmin(user: unknown = null) {
  const userToCheck = user || (await getUser());
  const result = hasRole(userToCheck, 'admin');
  return result;
}
