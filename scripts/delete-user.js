import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let supabaseUrl = '';
let supabaseServiceKey = '';

for (const env of ['.env', '.env.local']) {
    const envPath = join(__dirname, env);
    if (existsSync(envPath)) {
        const envContent = readFileSync(envPath, 'utf8');
        const envLines = envContent.split('\n');
        envLines.forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
                    supabaseUrl = value;
                }
                if (key === 'SERVICE_ROLE_SECRET') {
                    supabaseServiceKey = value;
                }
                process.env[key] = value;
            }
        });
    }
}

const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey
);

// Функция для проверки подключения к БД
async function checkDatabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      throw new Error(`Ошибка подключения к БД: ${error.message}`);
    }
    
    console.log('✅ Подключение к базе данных успешно');
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
    return false;
  }
}

// Функция для поиска пользователя по email
async function findUserByEmail(email) {
  try {
    // Используем auth API для поиска пользователя
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      throw new Error(`Ошибка получения списка пользователей: ${listError.message}`);
    }
    
    if (existingUsers?.users) {
      const user = existingUsers.users.find(user => user.email === email);
      return user || null;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Ошибка поиска пользователя:', error.message);
    return null;
  }
}

// Функция для удаления пользователя
async function deleteUser(email) {
  try {
    console.log(`🗑️  Удаление пользователя: ${email}`);

    // Проверяем подключение к БД
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Не удалось подключиться к базе данных');
    }

    // Ищем пользователя
    const user = await findUserByEmail(email);
    if (!user) {
      throw new Error(`Пользователь с email ${email} не найден`);
    }

    console.log(`   Найден пользователь: ${user.email} (ID: ${user.id})`);
    console.log(`   Роль: ${user.user_metadata?.role || 'не указана'}`);

    // Удаляем пользователя через Auth API
    const deleteUrl = `${supabaseUrl}/auth/v1/admin/users/${user.id}`;
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      throw new Error(`Ошибка удаления пользователя: ${deleteResponse.status} ${errorText}`);
    }

    console.log('✅ Пользователь успешно удален из Supabase Auth');
    console.log(`   Email: ${email}`);
    console.log(`   ID: ${user.id}`);

    // Проверяем, что запись в user_data тоже удалена (должна удалиться автоматически через CASCADE)
    await new Promise(resolve => setTimeout(resolve, 1000)); // Ждем выполнения CASCADE
    
    const { data: userData, error: userDataError } = await supabase
      .from('user_data')
      .select('id')
      .eq('id', user.id)
      .single();

    if (userDataError && userDataError.code === 'PGRST116') {
      console.log('✅ Запись в user_data удалена автоматически через CASCADE');
    } else if (userData) {
      console.warn('⚠️  Предупреждение: запись в user_data не удалена автоматически');
    }

    return user;
  } catch (error) {
    console.error('❌ Ошибка удаления пользователя:', error.message);
    process.exit(1);
  }
}

// Получаем аргументы командной строки
const args = process.argv.slice(2);

if (args.length !== 1) {
  console.log('Использование: node delete-user.js <email>');
  console.log('');
  console.log('Переменные окружения:');
  console.log('  NEXT_PUBLIC_SUPABASE_URL - URL Supabase (по умолчанию: http://127.0.0.1:54321)');
  console.log('  SUPABASE_SERVICE_ROLE_SECRET - Service Role Secret Supabase');
  console.log('');
  console.log('Текущая конфигурация:');
  console.log(`  Supabase URL: ${supabaseUrl}`);
  console.log(`  Service Key: ${supabaseServiceKey.substring(0, 20)}...`);
  process.exit(1);
}

const [email] = args;

// Валидация email
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error(`❌ Неверный формат email: ${email}`);
  process.exit(1);
}

// Показываем конфигурацию
console.log('🔧 Конфигурация:');
console.log(`   Supabase URL: ${supabaseUrl}`);
console.log(`   Service Key: ${supabaseServiceKey.substring(0, 20)}...`);
console.log('');

// Удаляем пользователя
deleteUser(email);
