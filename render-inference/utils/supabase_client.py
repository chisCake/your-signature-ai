"""
Утилиты для работы с Supabase сервером
Использует service_role ключ для административного доступа
"""

import os
from supabase import create_client, Client
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class SupabaseClient:
    """Клиент для работы с Supabase с service_role правами"""

    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not self.url or not self.service_role_key:
            raise ValueError(
                "Missing required environment variables: "
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
            )

        self.client: Client = create_client(self.url, self.service_role_key)
        logger.info("Supabase client initialized with service_role")

    def get_client(self) -> Client:
        """Возвращает клиент Supabase"""
        return self.client

    def get_signature_data(self, signature_id: str) -> Optional[list]:
        """
        Получает данные подписи по ID
        
        Args:
            signature_id: ID подписи
            
        Returns:
            Список точек подписи или None если не найдена
        """
        try:
            logger.info(f"Getting signature data for ID: {signature_id}")
            
            # Сначала пробуем найти в genuine_signatures
            try:
                result = self.client.table('genuine_signatures').select('features_table').eq('id', signature_id).single().execute()
                
                if result.data:
                    # Парсим CSV данные
                    csv_data = result.data['features_table']
                    logger.info(f"Found CSV data in genuine_signatures, length: {len(csv_data)}")
                    parsed_data = self._parse_csv_signature_data(csv_data)
                    logger.info(f"Parsed data length: {len(parsed_data)}")
                    return parsed_data
            except Exception as e:
                logger.info(f"Not found in genuine_signatures: {str(e)}")
            
            # Если не найдено в genuine_signatures, пробуем forged_signatures
            logger.info("Trying forged_signatures")
            try:
                result = self.client.table('forged_signatures').select('features_table').eq('id', signature_id).single().execute()
                
                if result.data:
                    # Парсим CSV данные
                    csv_data = result.data['features_table']
                    logger.info(f"Found CSV data in forged_signatures, length: {len(csv_data)}")
                    parsed_data = self._parse_csv_signature_data(csv_data)
                    logger.info(f"Parsed data length: {len(parsed_data)}")
                    return parsed_data
            except Exception as e:
                logger.info(f"Not found in forged_signatures: {str(e)}")
            
            logger.warning(f"Signature {signature_id} not found in any table")
            return None
            
        except Exception as e:
            logger.error(f"Error getting signature data for {signature_id}: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def _parse_csv_signature_data(self, csv_data: str) -> list:
        """
        Парсит CSV данные подписи в список точек
        
        Args:
            csv_data: CSV строка с данными подписи
            
        Returns:
            Список точек [t, x, y, p]
        """
        try:
            lines = csv_data.strip().split('\n')
            points = []
            
            for line in lines[1:]:  # Пропускаем заголовок
                if line.strip():
                    parts = line.split(',')
                    if len(parts) >= 4:
                        points.append([
                            float(parts[0]),  # t
                            float(parts[1]),  # x
                            float(parts[2]),  # y
                            float(parts[3])   # p
                        ])
            
            return points
            
        except Exception as e:
            logger.error(f"Error parsing CSV signature data: {str(e)}")
            return []

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Получить пользователя по ID"""
        try:
            response = self.client.auth.admin.get_user_by_id(user_id)
            return response.user.model_dump() if response.user else None
        except Exception as e:
            logger.error(f"Error getting user {user_id}: {e}")
            return None

    def get_signature_embeddings(self, user_id: str) -> list:
        """Получить эмбеддинги подписей пользователя"""
        try:
            response = (
                self.client.table("signature_embeddings")
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )
            return response.data
        except Exception as e:
            logger.error(f"Error getting embeddings for user {user_id}: {e}")
            return []

    def save_signature_embedding(
        self, user_id: str, embedding: list, signature_type: str = "reference"
    ) -> bool:
        """Сохранить эмбеддинг подписи"""
        try:
            data = {
                "user_id": user_id,
                "embedding": embedding,
                "signature_type": signature_type,
            }

            response = self.client.table("signature_embeddings").insert(data).execute()
            return len(response.data) > 0
        except Exception as e:
            logger.error(f"Error saving embedding for user {user_id}: {e}")
            return False

    def update_signature_embedding(self, embedding_id: str, embedding: list) -> bool:
        """Обновить существующий эмбеддинг"""
        try:
            data = {"embedding": embedding, "updated_at": "now()"}
            response = (
                self.client.table("signature_embeddings")
                .update(data)
                .eq("id", embedding_id)
                .execute()
            )
            return len(response.data) > 0
        except Exception as e:
            logger.error(f"Error updating embedding {embedding_id}: {e}")
            return False

    def delete_signature_embedding(self, embedding_id: str) -> bool:
        """Удалить эмбеддинг подписи"""
        try:
            response = (
                self.client.table("signature_embeddings")
                .delete()
                .eq("id", embedding_id)
                .execute()
            )
            return True
        except Exception as e:
            logger.error(f"Error deleting embedding {embedding_id}: {e}")
            return False


# Глобальный экземпляр клиента
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """Получить глобальный экземпляр Supabase клиента"""
    global _supabase_client
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL")
        service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not url or not service_role_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

        _supabase_client = create_client(url, service_role_key)
    return _supabase_client


def init_supabase_client() -> SupabaseClient:
    """Инициализировать Supabase клиент"""
    return get_supabase_client()
