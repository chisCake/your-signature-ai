import { createSupabaseClient } from './utils.js';

const supabase = createSupabaseClient();

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

// Функция для проверки существования пользователя
async function checkUserExists(email) {
  try {
    // Используем auth API вместо прямого обращения к таблице
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      throw new Error(`Ошибка получения списка пользователей: ${listError.message}`);
    }

    if (existingUsers?.users) {
      const userExists = existingUsers.users.find(user => user.email === email);
      return userExists !== undefined;
    }

    return false;
  } catch (error) {
    console.error('❌ Ошибка проверки существования пользователя:', error.message);
    return false;
  }
}

// Функция для диагностики проблем с БД
async function diagnoseDatabaseIssues() {
  try {
    console.log('🔍 Диагностика проблем с базой данных...');

    // Проверяем доступность таблицы user_data
    const { data: userDataCheck, error: userDataError } = await supabase
      .from('user_data')
      .select('count')
      .limit(1);

    if (userDataError) {
      console.error('❌ Проблема с таблицей user_data:', userDataError.message);
      return false;
    }

    // Проверяем доступность auth.users через RPC
    const { data: authCheck, error: authError } = await supabase
      .rpc('get_system_stats');

    if (authError) {
      console.error('❌ Проблема с доступом к auth.users:', authError.message);
      return false;
    }

    console.log('✅ Диагностика завершена успешно');
    return true;
  } catch (error) {
    console.error('❌ Ошибка диагностики:', error.message);
    return false;
  }
}

async function createUser(email, password, role) {
  try {
    console.log(`👤 Создание пользователя: ${email} с ролью ${role}`);

    // Проверяем подключение к БД
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      console.log('🔍 Запуск диагностики...');
      const diagnosisOk = await diagnoseDatabaseIssues();
      if (!diagnosisOk) {
        throw new Error('Не удалось подключиться к базе данных. Проверьте настройки Supabase.');
      }
    }

    // Проверяем, не существует ли уже пользователь
    const userExists = await checkUserExists(email);
    if (userExists) {
      throw new Error(`Пользователь с email ${email} уже существует`);
    }

    // Создаем пользователя в Supabase Auth через прямой HTTP запрос
    const authUrl = `${supabaseUrl}/auth/v1/admin/users`;
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        user_metadata: {
          role: role
        },
        email_confirm: true
      })
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      throw new Error(`Ошибка создания пользователя в Supabase Auth: ${authResponse.status} ${errorText}`);
    }

    const authData = await authResponse.json();

    // Auth API возвращает пользователя напрямую, а не в поле user
    const user = authData.user || authData;
    if (!user || !user.id) {
      throw new Error(`Ошибка создания пользователя в Supabase Auth: пользователь не создан`);
    }

    console.log('✅ Пользователь создан успешно в Supabase Auth');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Роль: ${role}`);

    // Создаем профиль в таблице profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        role: role,
        display_name: email.split('@')[0] // Используем часть email как display_name
      })
      .select()
      .single();

    if (profileError) {
      // Если профиль не создался, удаляем пользователя из Auth
      await supabase.auth.admin.deleteUser(user.id);
      throw new Error(`Ошибка создания профиля: ${profileError.message}`);
    }

    console.log('✅ Профиль пользователя создан успешно');

    return user;
  } catch (error) {
    console.error('❌ Ошибка создания пользователя:', error.message);
    process.exit(1);
  }
}

// Получаем аргументы командной строки
const args = process.argv.slice(2);

if (args.length !== 3) {
  console.log('Использование: node create-user.js <email> <password> <role>');
  console.log('Роли: user, admin, super_admin');
  console.log('');
  console.log('Переменные окружения:');
  console.log('  NEXT_PUBLIC_SUPABASE_URL - URL Supabase (по умолчанию: http://127.0.0.1:54321)');
  console.log('  SUPABASE_SERVICE_ROLE_KEY - Service Role Key Supabase');
  console.log('');
  console.log('Текущая конфигурация:');
  console.log(`  Supabase URL: ${supabaseUrl}`);
  console.log(`  Service Key: ${supabaseServiceKey.substring(0, 20)}...`);
  process.exit(1);
}

const [email, password, role] = args;

// Валидация email
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error(`❌ Неверный формат email: ${email}`);
  process.exit(1);
}

// Валидация пароля
if (password.length < 6) {
  console.error(`❌ Пароль должен содержать минимум 6 символов`);
  process.exit(1);
}

// Валидация роли
const validRoles = ['user', 'admin', 'super_admin'];
if (!validRoles.includes(role)) {
  console.error(`❌ Неверная роль: ${role}`);
  console.log(`Доступные роли: ${validRoles.join(', ')}`);
  process.exit(1);
}

// Показываем конфигурацию
console.log('🔧 Конфигурация:');
console.log(`   Supabase URL: ${supabaseUrl}`);
console.log(`   Service Key: ${supabaseServiceKey.substring(0, 20)}...`);
console.log('');

// Создаем пользователя
createUser(email, password, role);