import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomBytes } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let supabaseUrl = '';
let supabaseServiceKey = '';

// Загружаем переменные окружения из .env файлов
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

// Функция для генерации токена
function generateToken() {
    return randomBytes(32).toString('hex');
}

// Функция для хэширования токена
function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

// Функция для создания токена админа
async function createAdminToken(adminEmail, description = '', expiresInDays = null) {
    try {
        // Находим админа по email
        const { data: adminData, error: adminError } = await supabase
            .from('profiles')
            .select('id, role, display_name')
            .eq('id', (
                await supabase.auth.admin.listUsers()
            ).data.users.find(u => u.email === adminEmail)?.id);

        if (adminError) {
            console.error('Ошибка поиска админа:', adminError);
            return;
        }

        if (!adminData || adminData.length === 0) {
            console.error('Админ не найден:', adminEmail);
            return;
        }

        const admin = adminData[0];

        // Проверяем, что пользователь является админом
        if (!['admin', 'super_admin'].includes(admin.role)) {
            console.error('Пользователь не является админом:', adminEmail);
            return;
        }

        // Генерируем токен
        const token = generateToken();
        const tokenHash = hashToken(token);

        // Вычисляем дату истечения
        let expiresAt = null;
        if (expiresInDays) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        }

        // Сохраняем токен в базу данных
        const { data: tokenData, error: tokenError } = await supabase
            .from('admin_tokens')
            .insert({
                admin_id: admin.id,
                token_hash: tokenHash,
                description: description,
                expires_at: expiresAt
            })
            .select()
            .single();

        if (tokenError) {
            console.error('Ошибка создания токена:', tokenError);
            return;
        }

        console.log('✅ Токен успешно создан!');
        console.log('📧 Админ:', adminEmail);
        console.log('👤 Имя:', admin.display_name);
        console.log('🔑 Токен:', token);
        console.log('📝 Описание:', description || 'Не указано');
        console.log('⏰ Истекает:', expiresAt ? expiresAt.toISOString() : 'Никогда');
        console.log('🆔 ID токена:', tokenData.id);
        console.log('');
        console.log('⚠️  ВАЖНО: Сохраните токен сейчас! Он больше не будет показан.');

        return { token, tokenData };

    } catch (error) {
        console.error('Ошибка создания токена:', error);
    }
}

// Функция для отображения справки
function showHelp() {
    console.log('🔑 Создание токенов для админов');
    console.log('');
    console.log('Использование:');
    console.log('  node create-admin-token.js <admin_email> [description] [expires_in_days]');
    console.log('');
    console.log('Параметры:');
    console.log('  admin_email     - Email админа (обязательно)');
    console.log('  description     - Описание токена (опционально)');
    console.log('  expires_in_days - Срок действия в днях (опционально)');
    console.log('');
    console.log('Примеры:');
    console.log('  node create-admin-token.js admin@example.com');
    console.log('  node create-admin-token.js admin@example.com "API для ML сервера"');
    console.log('  node create-admin-token.js admin@example.com "Временный доступ" 30');
    console.log('');
}

// Основная функция
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        showHelp();
        return;
    }

    const adminEmail = args[0];
    const description = args[1] || '';
    const expiresInDays = args[2] ? parseInt(args[2]) : null;

    if (!adminEmail) {
        console.error('❌ Ошибка: Укажите email админа');
        showHelp();
        return;
    }

    if (expiresInDays && (isNaN(expiresInDays) || expiresInDays <= 0)) {
        console.error('❌ Ошибка: Срок действия должен быть положительным числом');
        return;
    }

    await createAdminToken(adminEmail, description, expiresInDays);
}

// Запуск скрипта
main().catch(console.error);
