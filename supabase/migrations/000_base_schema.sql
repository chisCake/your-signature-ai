-- Миграция 000: Базовая схема базы данных
-- Создание всех необходимых таблиц для системы верификации подписей
-- Интеграция с Supabase Auth, упрощенная архитектура без дублирования

-- Включаем необходимые расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ========================================
-- СОЗДАНИЕ ТАБЛИЦ
-- ========================================

-- Таблица дополнительной информации о пользователе
-- 1:1 с auth.users
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'mod', 'admin')),
    display_name VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица псевдопользователей для внешних подписей
CREATE TABLE pseudousers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(64) NOT NULL,
    source VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица информации о модели
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(20) NOT NULL,
    admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    metadata JSONB,
    description TEXT,
    is_active BOOLEAN DEFAULT false, -- активна ли модель на Inference сервере
    file_hash CHAR(64) NOT NULL, -- хэш файла .pth модели (SHA256)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица настоящих подписей
CREATE TABLE genuine_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    pseudouser_id UUID REFERENCES pseudousers(id) ON DELETE CASCADE,
    features_table TEXT NOT NULL, -- данные подписи в формате csv: 1 строка: "t,x,y,p[,...]", 2 - данные в формате csv: 1 строка: "t,x,y,p[,...]", 2 - данные
    input_type VARCHAR(20) CHECK (input_type IN ('mouse', 'touch', 'pen')), -- способ ввода подписи
    user_for_forgery BOOLEAN DEFAULT false, -- используется как экземпляр для подделок, устанавливается пользователем
    mod_for_forgery BOOLEAN DEFAULT true, -- используется как экземпляр для подделок, устанавливается модератором
    mod_for_dataset BOOLEAN DEFAULT true, -- используется в датасете обучения, устанавливается модератором
    name VARCHAR(128), -- название файла или что-нибудь еще
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_exactly_one_user_id CHECK (
        (user_id IS NOT NULL AND pseudouser_id IS NULL) OR
        (user_id IS NULL AND pseudouser_id IS NOT NULL)
    )
);

-- Таблица поддельных подписей
CREATE TABLE forged_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_signature_id UUID REFERENCES genuine_signatures(id) ON DELETE SET NULL, -- Оригинальная подпись
    original_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Владелец оригинальной подписи
    original_pseudouser_id UUID REFERENCES pseudousers(id) ON DELETE CASCADE, -- (Псевдо)владелец оригинальной подписи
    features_table TEXT NOT NULL, -- данные подписи в формате csv: 1 строка: "t,x,y,p[,...]", 2 - данные
    input_type VARCHAR(20) CHECK (input_type IN ('mouse', 'touch', 'pen')), -- способ ввода подписи
    mod_for_dataset BOOLEAN DEFAULT true, -- используется в датасете обучения, устанавливается модератором
    score NUMERIC(7, 4), -- качество подделки
    model_id UUID REFERENCES models(id) ON DELETE CASCADE, -- модель, использованная для оценки
    forger_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- кто создал подделку
    name VARCHAR(128), -- название файла или что-нибудь еще
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ограничение: либо настоящий пользователь, либо псевдопользователь
    CONSTRAINT check_exactly_one_user_id CHECK (
        (original_user_id IS NOT NULL AND original_pseudouser_id IS NULL) OR
        (original_user_id IS NULL AND original_pseudouser_id IS NOT NULL)
    )
);

-- Таблица эмбеддингов подписей (настоящие и поддельные)
-- Либо genuine_signature_id, либо forged_signature_id, но не обе
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    genuine_signature_id UUID REFERENCES genuine_signatures(id) ON DELETE CASCADE,
    forged_signature_id UUID REFERENCES forged_signatures(id) ON DELETE CASCADE,
    embedding_vector VECTOR(512) NOT NULL,
    dimension INTEGER NOT NULL,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ограничение: либо настоящая подпись, либо подделка
    CONSTRAINT check_exactly_one_signature_id CHECK (
        (genuine_signature_id IS NOT NULL AND forged_signature_id IS NULL) OR
        (genuine_signature_id IS NULL AND forged_signature_id IS NOT NULL)
    )
);

-- Таблица средних эмбеддингов пользователей
CREATE TABLE user_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    pseudouser_id UUID REFERENCES pseudousers(id) ON DELETE CASCADE,
    embedding_vector VECTOR(512) NOT NULL,
    dimension INTEGER NOT NULL,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ограничение: либо настоящий пользователь, либо псевдопользователь
    CONSTRAINT check_exactly_one_user_id CHECK (
        (user_id IS NOT NULL AND pseudouser_id IS NULL) OR
        (user_id IS NULL AND pseudouser_id IS NOT NULL)
    )
);

-- Таблица токенов админов для API доступа
CREATE TABLE admin_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL, -- SHA256 хэш токена
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- можно задать TTL
    revoked BOOLEAN DEFAULT FALSE
);

-- ========================================
-- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
-- ========================================

-- RPC функция для получения случайной подписи для подделки
CREATE OR REPLACE FUNCTION get_random_forgery_signature()
RETURNS TABLE(id UUID, features_table TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT gs.id, gs.features_table
    FROM genuine_signatures gs
    WHERE gs.user_for_forgery = true 
      AND gs.mod_for_forgery = true
    ORDER BY RANDOM()
    LIMIT 1;
END;
$$;

-- Функция для проверки роли администратора
-- Использует JWT claims вместо запросов к БД для избежания рекурсии в RLS политиках
CREATE OR REPLACE FUNCTION is_mod()
RETURNS BOOLEAN AS $$
BEGIN
  -- Проверяем роль из JWT claims
  RETURN (
    COALESCE(
      (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role',
      (auth.jwt() ->> 'raw_user_meta_data')::jsonb ->> 'role'
    ) IN ('mod', 'admin')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Функция для проверки роли супер-администратора
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Проверяем роль из JWT claims
  RETURN (
    COALESCE(
      (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role',
      (auth.jwt() ->> 'raw_user_meta_data')::jsonb ->> 'role'
    ) = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Функция для получения email пользователя по ID профиля
CREATE OR REPLACE FUNCTION get_user_email(profile_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Получаем email из auth.users для указанного профиля
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = profile_id;
    
    RETURN user_email;
END;
$$;

-- ========================================
-- RLS политики для таблиц
-- ========================================

-- RLS для таблицы profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Политика для пользователей: видимость только своего аккаунта
CREATE POLICY "users_can_view_own_profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Политика для админов: только просмотр всех профилей
CREATE POLICY "mods_can_view_all_profiles" ON profiles
    FOR SELECT USING (is_mod());

-- Политика для супер-админов и service_role: полный доступ к профилям
CREATE POLICY "admins_and_service_full_access_profiles" ON profiles
    FOR ALL USING (
        is_admin() OR auth.role() = 'service_role'
    );

-- RLS для таблицы models
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

-- Политика для всех аутентифицированных: чтение моделей
CREATE POLICY "authenticated_can_view_models" ON models
    FOR SELECT USING (auth.role() = 'authenticated');

-- Политика для супер-админов и service_role: полный доступ к моделям
CREATE POLICY "admins_and_service_can_manage_models" ON models
    FOR ALL USING (
        is_admin() OR auth.role() = 'service_role'
    );

-- RLS для таблицы genuine_signatures
ALTER TABLE genuine_signatures ENABLE ROW LEVEL SECURITY;

-- Политика для пользователей: только чтение своих подписей
CREATE POLICY "users_can_view_own_signatures" ON genuine_signatures
    FOR SELECT USING (auth.uid() = user_id);

-- Политика для service_role: полный доступ ко всем подписям
CREATE POLICY "service_role_full_access_genuine_signatures" ON genuine_signatures
    FOR ALL USING (auth.role() = 'service_role');

-- Политика для админов: полный доступ, исключая подписи других админов
CREATE POLICY "admins_access_genuine_signatures_except_other_admins" ON genuine_signatures
    FOR ALL USING (
        is_admin() AND (
            user_id IS NULL OR -- псевдопользователи доступны всем админам
            NOT EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = user_id 
                AND role = 'admin' 
                AND id != auth.uid()
            )
        )
    );

-- Политика для модераторов: полный доступ, исключая подписи других модераторов и админов
CREATE POLICY "mods_access_genuine_signatures_except_other_mods_admins" ON genuine_signatures
    FOR ALL USING (
        is_mod() AND NOT is_admin() AND (
            user_id IS NULL OR -- псевдопользователи доступны всем модераторам
            NOT EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = user_id 
                AND role IN ('mod', 'admin')
                AND id != auth.uid()
            )
        )
    );

-- RLS для таблицы forged_signatures
ALTER TABLE forged_signatures ENABLE ROW LEVEL SECURITY;

-- Политика для service_role: полный доступ ко всем подделкам
CREATE POLICY "service_role_full_access_forged_signatures" ON forged_signatures
    FOR ALL USING (auth.role() = 'service_role');

-- Политика для админов: полный доступ, исключая подписи других админов
CREATE POLICY "admins_access_forged_signatures_except_other_admins" ON forged_signatures
    FOR ALL USING (
        is_admin() AND (
            original_user_id IS NULL OR -- псевдопользователи доступны всем админам
            NOT EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = original_user_id 
                AND role = 'admin' 
                AND id != auth.uid()
            )
        )
    );

-- Политика для модераторов: полный доступ, исключая подписи других модераторов и админов
CREATE POLICY "mods_access_forged_signatures_except_other_mods_admins" ON forged_signatures
    FOR ALL USING (
        is_mod() AND NOT is_admin() AND (
            original_user_id IS NULL OR -- псевдопользователи доступны всем модераторам
            NOT EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = original_user_id 
                AND role IN ('mod', 'admin')
                AND id != auth.uid()
            )
        )
    );

-- RLS для таблицы embeddings
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Политика для пользователей: чтение только эмбеддингов своих подписей
CREATE POLICY "users_can_view_own_embeddings" ON embeddings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM genuine_signatures 
            WHERE id = genuine_signature_id 
            AND user_id = auth.uid()
        )
    );

-- Политика для админов и service_role: полный доступ к эмбеддингам
CREATE POLICY "mods_and_service_full_access_embeddings" ON embeddings
    FOR ALL USING (
        is_mod() OR auth.role() = 'service_role'
    );

-- RLS для таблицы user_embeddings
ALTER TABLE user_embeddings ENABLE ROW LEVEL SECURITY;

-- Политика для пользователей: чтение только своих эмбеддингов
CREATE POLICY "users_can_view_own_user_embeddings" ON user_embeddings
    FOR SELECT USING (auth.uid() = user_id);

-- Политика для админов и service_role: полный доступ к пользовательским эмбеддингам
CREATE POLICY "mods_and_service_full_access_user_embeddings" ON user_embeddings
    FOR ALL USING (
        is_mod() OR auth.role() = 'service_role'
    );

-- RLS для таблицы admin_tokens
ALTER TABLE admin_tokens ENABLE ROW LEVEL SECURITY;

-- Политика для админов: только просмотр своих токенов
CREATE POLICY "admins_can_view_own_tokens" ON admin_tokens
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        ) AND auth.uid() = admin_id
    );

-- Политика для service_role: полный доступ к токенам (управление токенами)
CREATE POLICY "service_role_full_access_tokens" ON admin_tokens
    FOR ALL USING (auth.role() = 'service_role');

-- RLS для таблицы pseudousers
ALTER TABLE pseudousers ENABLE ROW LEVEL SECURITY;

-- Политика для модераторов и админов: полный доступ к псевдопользователям
CREATE POLICY "mods_full_access_pseudousers" ON pseudousers
    FOR ALL USING (is_mod());

-- Политика для service_role: полный доступ к псевдопользователям
CREATE POLICY "service_role_full_access_pseudousers" ON pseudousers
    FOR ALL USING (auth.role() = 'service_role');

-- ========================================
-- ИНДЕКСЫ
-- ========================================

-- Индексы на внешние ключи
CREATE INDEX idx_models_admin_id ON models(admin_id);
CREATE INDEX idx_genuine_signatures_user_id ON genuine_signatures(user_id);
CREATE INDEX idx_forged_signatures_original_signature_id ON forged_signatures(original_signature_id);
CREATE INDEX idx_forged_signatures_model_id ON forged_signatures(model_id);
CREATE INDEX idx_forged_signatures_forger_id ON forged_signatures(forger_id);
CREATE INDEX idx_embeddings_genuine_signature_id ON embeddings(genuine_signature_id);
CREATE INDEX idx_embeddings_forged_signature_id ON embeddings(forged_signature_id);
CREATE INDEX idx_embeddings_model_id ON embeddings(model_id);
CREATE INDEX idx_user_embeddings_user_id ON user_embeddings(user_id);
CREATE INDEX idx_user_embeddings_model_id ON user_embeddings(model_id);
CREATE INDEX idx_admin_tokens_admin_id ON admin_tokens(admin_id);

-- ========================================
-- ТРИГГЕРЫ
-- ========================================

-- Функция для обновления пользовательских метаданных в JWT
CREATE OR REPLACE FUNCTION set_user_role_in_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем поле raw_user_meta_data в таблице auth.users
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
        coalesce(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(NEW.role)
    )
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер, который запускается после вставки или обновления в таблице profiles
CREATE TRIGGER on_profile_role_change
AFTER INSERT OR UPDATE OF role ON profiles
FOR EACH ROW EXECUTE FUNCTION set_user_role_in_metadata();

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION trigger_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для обновления updated_at
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_updated_at_column();

CREATE TRIGGER trg_models_updated_at
    BEFORE UPDATE ON models
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_updated_at_column();

CREATE TRIGGER trg_genuine_signatures_updated_at
    BEFORE UPDATE ON genuine_signatures
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_updated_at_column();

CREATE TRIGGER trg_forged_signatures_updated_at
    BEFORE UPDATE ON forged_signatures
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_updated_at_column();

CREATE TRIGGER trg_embeddings_updated_at
    BEFORE UPDATE ON embeddings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_updated_at_column();

CREATE TRIGGER trg_user_embeddings_updated_at
    BEFORE UPDATE ON user_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_updated_at_column();

