/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const verbose = process.env.PLAYWRIGHT_VERBOSE === '1';
const log = (...args: unknown[]) => {
  if (verbose) console.log(...args);
};
const warn = (...args: unknown[]) => {
  if (verbose) console.warn(...args);
};

export default async function globalTeardown() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_SECRET!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // читаем список созданных пользователей
  // Используем тот же путь, что и в global.setup.mts
  const storageDir = path.join(__dirname, '../storage');
  const createdUsersPath = path.join(storageDir, 'created-users.json');

  try {
    // Проверяем существование файла перед чтением
    await fs.access(createdUsersPath);
    const content = await fs.readFile(createdUsersPath, 'utf-8');
    const ids: string[] = JSON.parse(content);

    if (ids.length > 0) {
      for (const id of ids) {
        try {
          // сначала удаляем профиль, чтобы не нарушить FK
          await supabase.from('profiles').delete().eq('id', id);
          // затем пользователь auth
          await supabase.auth.admin.deleteUser(id);
        } catch (error) {
          // Игнорируем ошибки удаления отдельных пользователей
          warn(`Failed to delete user ${id}:`, error);
        }
      }

      // удаляем файл только после успешного удаления всех пользователей
      await fs.unlink(createdUsersPath);
      log(`Successfully cleaned up ${ids.length} test users`);
    } else {
      // Файл существует, но пустой - удаляем его
      await fs.unlink(createdUsersPath);
    }
  } catch (error: any) {
    // Файл может не существовать (ENOENT) - это нормально
    if (error.code === 'ENOENT') {
      // Файл не существует - это нормально, возможно тесты не создали пользователей
      // Не выводим предупреждение, так как это может быть нормальным сценарием
    } else {
      // Другая ошибка - выводим предупреждение
      warn('Error during teardown:', error.message);
    }
  }
}

// Прямой запуск файла (только если файл запущен напрямую через tsx/node, а не импортирован Playwright)
// Проверяем, что файл является точкой входа процесса, сравнивая нормализованные абсолютные пути
const currentFilePath = fileURLToPath(import.meta.url);
const mainModulePath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule =
  mainModulePath && path.resolve(currentFilePath) === mainModulePath;

if (isMainModule) {
  globalTeardown()
    .then(() => {
      log('Global teardown completed successfully');
      process.exit(0);
    })
    .catch(error => {
      process.exit(1);
    });
}
