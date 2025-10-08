import { createSupabaseClient } from './utils.js';

const supabase = createSupabaseClient();

async function createTestUsers() {
    const users = [
        { email: 'user@example.com', password: 'user123', role: 'user' },
        { email: 'mod@example.com', password: 'mod123', role: 'mod' },
        { email: 'admin@example.com', password: 'admin123', role: 'admin' },
    ];

    for (const u of users) {
        const displayName = u.email.split('@')[0];

        const { data, error } = await supabase.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
        });

        if (error) {
            console.error('Ошибка создания пользователя:', displayName, error.code);
            continue;
        }

        const userId = data.user?.id || data.id;
        console.log('Создан пользователь:', displayName);

        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                role: u.role,
                display_name: displayName,
            });

        if (profileError) console.error('Ошибка создания профиля:', profileError);
    }
}

createTestUsers();
