'use client';

import { createBrowserClient } from '@/lib/supabase/client';
import { Profile, Signature } from '@/lib/types';
import {
  getUserGenuineSignatures,
  getProfile as getProfileQuery,
} from '@/lib/supabase/queries';

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

export async function getSignatures(): Promise<Signature[]> {
  try {
    const client = createBrowserClient();
    const { data } = await client.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) {
      throw new Error('User ID not found');
    }

    const signatures = await getUserGenuineSignatures(userId, client, 'user');
    return signatures;
  } catch (error) {
    console.error('Error getting signatures:', error);
    throw error;
  }
}

export async function getProfile(): Promise<Profile | null> {
  try {
    const client = createBrowserClient();
    const { data } = await client.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) {
      console.trace();
      throw new Error('User ID not found');
    }

      const cachedProfile = getCachedProfile(userId);
    if (cachedProfile) {
      return cachedProfile;
    }

    const profile = await getProfileQuery(userId, client);
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
