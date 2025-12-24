/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { testUsers } from './fixtures.mts';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const verbose = process.env.PLAYWRIGHT_VERBOSE === '1';
const log = (...args: unknown[]) => {
  if (verbose) console.log(...args);
};

// Путь для хранения временных данных (storageState + созданные пользователи)
const storageDir = path.join(__dirname, '../storage');
const createdUsersPath = path.join(storageDir, 'created-users.json');

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

// Флаг для предотвращения повторного выполнения
let setupPromise: Promise<void> | null = null;

export default async function globalSetup(_: FullConfig) {
  // Если setup уже выполняется, ждём его завершения
  if (setupPromise) {
    log('Global setup already in progress, waiting...');
    await setupPromise;
    return;
  }

  // Создаём промис для текущего выполнения
  setupPromise = (async () => {
    try {
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
        let userId: string | undefined;

        // Сначала пытаемся найти существующего пользователя
        const { data: usersList, error: listErr } =
          await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (listErr) throw listErr;

        const found = usersList.users.find(
          u => u.email?.toLowerCase() === user.email.toLowerCase()
        );

        if (found) {
          // Пользователь уже существует - используем его ID
          userId = found.id;
          log(
            `User ${user.email} already exists, using existing ID: ${userId}`
          );
        } else {
          // Пользователь не найден - создаём нового
          const { data: created, error: createErr } =
            await supabase.auth.admin.createUser({
              email: user.email,
              password: user.password,
              email_confirm: true,
              user_metadata: { role: user.role },
            });

          if (createErr) {
            // Если ошибка создания, пытаемся найти пользователя ещё раз (на случай race condition)
            const { data: usersListRetry } =
              await supabase.auth.admin.listUsers({ perPage: 1000 });
            const foundRetry = usersListRetry?.users.find(
              u => u.email?.toLowerCase() === user.email.toLowerCase()
            );
            if (foundRetry) {
              userId = foundRetry.id;
              log(
                `User ${user.email} was created by another process, using ID: ${userId}`
              );
            } else {
              throw new Error(
                `Failed to create user ${user.email}: ${createErr.message}`
              );
            }
          } else {
            userId = created?.user?.id;
            log(`Created new user ${user.email} with ID: ${userId}`);
          }
        }

        if (!userId) {
          throw new Error(`Could not obtain id for ${user.email}`);
        }

        // Проверяем, есть ли профиль; если нет, вставляем (игнорируем ошибку если уже существует)
        const { data: profileExists } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .single();

        if (!profileExists) {
          const { error: profileErr } = await supabase.from('profiles').insert({
            id: userId,
            role: user.role,
            display_name: user.email.split('@')[0],
          });

          // Игнорируем ошибку дубликата ключа (23505) - профиль уже существует
          if (profileErr && profileErr.code !== '23505') {
            throw new Error(
              `Failed to create profile for ${user.email}: ${profileErr.message}`
            );
          } else if (profileErr && profileErr.code === '23505') {
            log(`Profile for ${user.email} already exists, skipping creation`);
          }
        }

        // В любом случае добавляем userId в список для teardown
        createdUserIds.push(userId);
      }

      // Сохраняем созданные id для teardown
      await fs.writeFile(
        createdUsersPath,
        JSON.stringify(createdUserIds, null, 2)
      );

      log('Global setup completed successfully');
    } catch (error) {
      throw error;
    }
  })();

  await setupPromise;
}

// Прямой запуск файла (только если файл запущен напрямую через tsx/node, а не импортирован Playwright)
// Проверяем, что файл является точкой входа процесса, сравнивая нормализованные абсолютные пути
const currentFilePath = fileURLToPath(import.meta.url);
const mainModulePath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule =
  mainModulePath && path.resolve(currentFilePath) === mainModulePath;

if (isMainModule) {
  globalSetup({} as FullConfig)
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      process.exit(1);
    });
}
