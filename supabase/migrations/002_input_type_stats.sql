-- Миграция 002: Функция для получения статистики по типам ввода подписей
-- Оптимизированный подсчет количества подписей по типам ввода (mouse, touch, pen)

-- RPC функция для получения статистики по типам ввода
CREATE OR REPLACE FUNCTION get_input_type_stats(
  date_from TIMESTAMPTZ DEFAULT NULL,
  date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  input_type TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    combined.input_type::TEXT,
    COUNT(*)::BIGINT
  FROM (
    SELECT gs.input_type 
    FROM genuine_signatures gs
    WHERE (date_from IS NULL OR gs.created_at >= date_from)
      AND (date_to IS NULL OR gs.created_at <= date_to)
      AND gs.input_type IS NOT NULL
    
    UNION ALL
    
    SELECT fs.input_type 
    FROM forged_signatures fs
    WHERE (date_from IS NULL OR fs.created_at >= date_from)
      AND (date_to IS NULL OR fs.created_at <= date_to)
      AND fs.input_type IS NOT NULL
  ) AS combined
  GROUP BY combined.input_type;
END;
$$;

