import { createBrowserClient } from '@/lib/supabase/client';
import { hasRole } from '@/lib/utils/auth-utils';
import { getProfile, getGenuineSignature } from '@/lib/supabase/queries';
import { SignatureGenuine, Profile } from '@/lib/types';
import { User } from '@supabase/supabase-js';

// Константы для кэширования
const PROFILE_CACHE_KEY = 'user_profile_cache';
const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 минут в миллисекундах

// Интерфейс для кэшированных данных
interface CachedProfile {
  profile: Profile;
  timestamp: number;
  userId: string;
}

// Функции для работы с кэшем
function getCachedProfile(userId: string): Profile | null {
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) return null;

    const cachedData: CachedProfile = JSON.parse(cached);

    // Проверяем, что кэш принадлежит текущему пользователю
    if (cachedData.userId !== userId) {
      localStorage.removeItem(PROFILE_CACHE_KEY);
      return null;
    }

    // Проверяем, не истек ли кэш
    const now = Date.now();
    if (now - cachedData.timestamp > CACHE_EXPIRY_TIME) {
      localStorage.removeItem(PROFILE_CACHE_KEY);
      return null;
    }

    return cachedData.profile;
  } catch (error) {
    console.error('Ошибка при чтении кэша профиля:', error);
    localStorage.removeItem(PROFILE_CACHE_KEY);
    return null;
  }
}

function setCachedProfile(profile: Profile, userId: string): void {
  try {
    const cachedData: CachedProfile = {
      profile,
      timestamp: Date.now(),
      userId,
    };
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cachedData));
  } catch (error) {
    console.error('Ошибка при сохранении кэша профиля:', error);
  }
}

function clearProfileCache(): void {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch (error) {
    console.error('Ошибка при очистке кэша профиля:', error);
  }
}

export async function getUser(): Promise<User | null> {
  const supabase = createBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData?.session?.user;
  if (!sessionUser) return null;
  // console.log("getUser (client):", sessionUser);
  return sessionUser;
}

export async function getUserProfile(): Promise<Profile | null> {
  try {
    const client = createBrowserClient();
    const { data } = await client.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) {
      return null;
    }

    const cachedProfile = getCachedProfile(userId);
    if (cachedProfile) {
      return cachedProfile;
    }

    const profile = await getProfile(userId, client);
    if (!profile) {
      throw new Error('Profile not found');
    }

    profile.email = data?.claims?.email || null;
    if (profile) {
      setCachedProfile(profile, userId);
    }

    return profile;
  } catch (error) {
    console.error('Error getting profile:', error);
    throw error;
  }
}

// Экспортируемая функция для очистки кэша профиля
// Используйте эту функцию при обновлении профиля пользователя
export function invalidateProfileCache(): void {
  clearProfileCache();
}

export async function isMod(user: User | null = null): Promise<boolean> {
  return hasRole(user || (await getUser()), 'mod');
}

export async function isAdmin(user: User | null = null): Promise<boolean> {
  return hasRole(user || (await getUser()), 'admin');
}

export async function canEditSignature(
  signature: SignatureGenuine | null = null,
  signatureId: string | null = null
): Promise<boolean> {
  let targetSignature = signature;

  if (!signatureId && !signature) {
    console.error('Neither signatureId nor signature provided');
    return false;
  }

  if (signatureId) {
    targetSignature = await getGenuineSignature(signatureId);
  }
  // else signature is already provided

  if (!targetSignature) {
    console.error(`Signature not found ${signatureId}`);
    return false;
  }

  if (!targetSignature.user_id) {
    console.error(`Signature has no user_id ${signatureId}`);
    return false;
  }

  const user = await getUser();

  // For owner
  if (user?.id === targetSignature.user_id) return true;

  const targetUser = await getProfile(targetSignature.user_id);
  const targetUserRole = targetUser?.role;

  // For admin
  if (await isAdmin(user)) {
    return targetUserRole !== 'admin';
  }

  // For mod
  if (await isMod(user)) {
    return targetUserRole !== 'mod' && targetUserRole !== 'admin';
  }

  console.warn(
    `Unpredicted situation: user ${user?.id} cannot edit signature ${signatureId}`
  );
  return false;
}
