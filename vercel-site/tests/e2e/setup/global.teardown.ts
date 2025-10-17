/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createClient } from '@supabase/supabase-js';

export default async function globalTeardown() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_SECRET!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // читаем список созданных пользователей
  const fs = await import('fs/promises');
  const path = await import('path');
  const createdUsersPath = path.join(__dirname, '../storage', 'created-users.json');

  try {
    const content = await fs.readFile(createdUsersPath, 'utf-8');
    const ids: string[] = JSON.parse(content);

    for (const id of ids) {
      // сначала удаляем профиль, чтобы не нарушить FK
      await supabase.from('profiles').delete().eq('id', id);
      // затем пользователь auth
      await supabase.auth.admin.deleteUser(id);
    }

    // удаляем файл
    await fs.unlink(createdUsersPath);
  } catch {
    // файл может не существовать, пропускаем
    console.warn('No created-users.json found, nothing to teardown');
  }
}
