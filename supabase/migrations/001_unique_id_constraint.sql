-- Миграция 001: Гарантия уникальности ID между profiles и pseudousers
-- Предотвращает создание записей с одинаковыми ID в таблицах profiles и pseudousers

-- Создаем функцию для проверки уникальности ID между таблицами
CREATE OR REPLACE FUNCTION check_unique_id_across_tables()
RETURNS TRIGGER AS $$
BEGIN
    -- Проверяем, существует ли такой ID в другой таблице
    IF TG_TABLE_NAME = 'profiles' THEN
        -- Проверяем при вставке/обновлении в profiles
        IF EXISTS (SELECT 1 FROM pseudousers WHERE id = NEW.id) THEN
            RAISE EXCEPTION 'ID % уже существует в таблице pseudousers', NEW.id;
        END IF;
    ELSIF TG_TABLE_NAME = 'pseudousers' THEN
        -- Проверяем при вставке/обновлении в pseudousers
        IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.id) THEN
            RAISE EXCEPTION 'ID % уже существует в таблице profiles', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггеры для проверки уникальности
CREATE TRIGGER trg_profiles_unique_id_check
    BEFORE INSERT OR UPDATE OF id ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION check_unique_id_across_tables();

CREATE TRIGGER trg_pseudousers_unique_id_check
    BEFORE INSERT OR UPDATE OF id ON pseudousers
    FOR EACH ROW
    EXECUTE FUNCTION check_unique_id_across_tables();
