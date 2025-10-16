import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

// Функция для отображения всех токенов админа
async function listAdminTokens(adminEmail) {
    try {
        // Находим админа по email
        const { data: users } = await supabase.auth.admin.listUsers();
        const adminUser = users.users.find(u => u.email === adminEmail);
        
        if (!adminUser) {
            console.error('❌ Админ не найден:', adminEmail);
            return;
        }

        // Получаем профиль админа
        const { data: adminData, error: adminError } = await supabase
            .from('profiles')
            .select('id, role, display_name')
            .eq('id', adminUser.id)
            .single();

        if (adminError) {
            console.error('Ошибка получения профиля админа:', adminError);
            return;
        }

        // Получаем токены админа
        const { data: tokens, error: tokensError } = await supabase
            .from('admin_tokens')
            .select('*')
            .eq('admin_id', adminData.id)
            .order('created_at', { ascending: false });

        if (tokensError) {
            console.error('Ошибка получения токенов:', tokensError);
            return;
        }

        console.log(`🔑 Токены админа: ${adminData.display_name} (${adminEmail})`);
        console.log('');

        if (tokens.length === 0) {
            console.log('📭 Токены не найдены');
            return;
        }

        tokens.forEach((token, index) => {
            const status = token.revoked ? '❌ Отозван' : 
                          (token.expires_at && new Date(token.expires_at) < new Date()) ? '⏰ Истек' : '✅ Активен';
            
            console.log(`${index + 1}. ID: ${token.id}`);
            console.log(`   Статус: ${status}`);
            console.log(`   Описание: ${token.description || 'Не указано'}`);
            console.log(`   Создан: ${new Date(token.created_at).toLocaleString()}`);
            console.log(`   Истекает: ${token.expires_at ? new Date(token.expires_at).toLocaleString() : 'Никогда'}`);
            console.log('');
        });

    } catch (error) {
        console.error('Ошибка получения токенов:', error);
    }
}

// Функция для отзыва токена
async function revokeToken(tokenId) {
    try {
        const { error } = await supabase
            .from('admin_tokens')
            .update({ revoked: true })
            .eq('id', tokenId);

        if (error) {
            console.error('Ошибка отзыва токена:', error);
            return;
        }

        console.log('✅ Токен успешно отозван:', tokenId);

    } catch (error) {
        console.error('Ошибка отзыва токена:', error);
    }
}

// Функция для удаления токена
async function deleteToken(tokenId) {
    try {
        const { error } = await supabase
            .from('admin_tokens')
            .delete()
            .eq('id', tokenId);

        if (error) {
            console.error('Ошибка удаления токена:', error);
            return;
        }

        console.log('✅ Токен успешно удален:', tokenId);

    } catch (error) {
        console.error('Ошибка удаления токена:', error);
    }
}

// Функция для отображения справки
function showHelp() {
    console.log('🔧 Управление токенами админов');
    console.log('');
    console.log('Использование:');
    console.log('  node manage-admin-tokens.js list <admin_email>');
    console.log('  node manage-admin-tokens.js revoke <token_id>');
    console.log('  node manage-admin-tokens.js delete <token_id>');
    console.log('');
    console.log('Команды:');
    console.log('  list <admin_email>  - Показать все токены админа');
    console.log('  revoke <token_id>   - Отозвать токен (пометить как недействительный)');
    console.log('  delete <token_id>   - Удалить токен из базы данных');
    console.log('');
    console.log('Примеры:');
    console.log('  node manage-admin-tokens.js list admin@example.com');
    console.log('  node manage-admin-tokens.js revoke 123e4567-e89b-12d3-a456-426614174000');
    console.log('  node manage-admin-tokens.js delete 123e4567-e89b-12d3-a456-426614174000');
    console.log('');
}

// Основная функция
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        showHelp();
        return;
    }

    const command = args[0];

    switch (command) {
        case 'list':
            if (args.length < 2) {
                console.error('❌ Ошибка: Укажите email админа');
                showHelp();
                return;
            }
            await listAdminTokens(args[1]);
            break;

        case 'revoke':
            if (args.length < 2) {
                console.error('❌ Ошибка: Укажите ID токена');
                showHelp();
                return;
            }
            await revokeToken(args[1]);
            break;

        case 'delete':
            if (args.length < 2) {
                console.error('❌ Ошибка: Укажите ID токена');
                showHelp();
                return;
            }
            await deleteToken(args[1]);
            break;

        default:
            console.error('❌ Неизвестная команда:', command);
            showHelp();
    }
}

// Запуск скрипта
main().catch(console.error);
