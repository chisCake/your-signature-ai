/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { testUsers } from './fixtures';

// Путь для хранения временных данных (storageState + созданные пользователи)
const storageDir = path.join(__dirname, '../storage');
const createdUsersPath = path.join(storageDir, 'created-users.json');

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

export default async function globalSetup(_: FullConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_SECRET!;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase env vars not set');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // создаём директорию storage
  await ensureDir(storageDir);

  const createdUserIds: string[] = [];

  // Создание пользователей и профилей
  for (const user of Object.values(testUsers)) {
    // Пытаемся создать пользователя; если уже существует, Supabase вернёт ошибку 400
    let userId: string | undefined;
    const { data: created } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { role: user.role },
    });

    userId = created?.user?.id;

    if (!userId) {
      // Пользователь, возможно, уже существует. Находим его через listUsers
      const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) throw listErr;
      const found = usersList.users.find(u => u.email?.toLowerCase() === user.email.toLowerCase());
      if (found) userId = found.id;
    }

    if (!userId) throw new Error(`Could not obtain id for ${user.email}`);

    // Проверяем, есть ли профиль; если нет, вставляем
    const { data: profileExists } = await supabase.from('profiles').select('id').eq('id', userId).single();
    if (!profileExists) {
      const { error: profileErr } = await supabase.from('profiles').insert({
        id: userId,
        role: user.role,
        display_name: user.email.split('@')[0],
      });
      if (profileErr) throw profileErr;
    }

    if (userId) createdUserIds.push(userId);
  }

  // Сохраняем созданные id для teardown
  await fs.writeFile(createdUsersPath, JSON.stringify(createdUserIds, null, 2));
}