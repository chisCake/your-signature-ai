"""
Модуль зависимостей для FastAPI приложения
Содержит функции для внедрения зависимостей, которые используются в роутах
"""

from typing import Optional
from utils.supabase_client import SupabaseClient
from utils.model_loader import ModelLoader
from utils.model_manager import ModelManager

# Глобальные переменные для хранения инициализированных компонентов
supabase_client: Optional[SupabaseClient] = None
model_loader: Optional[ModelLoader] = None
model_manager: Optional[ModelManager] = None


def set_supabase_client(client: SupabaseClient):
    """Установка Supabase клиента"""
    global supabase_client
    supabase_client = client


def set_model_loader(loader: ModelLoader):
    """Установка загрузчика модели (для обратной совместимости)"""
    global model_loader
    model_loader = loader


def set_model_manager(manager: ModelManager):
    """Установка менеджера моделей"""
    global model_manager
    model_manager = manager


def get_supabase_client() -> SupabaseClient:
    """Получение Supabase клиента"""
    if supabase_client is None:
        raise RuntimeError("Supabase client not initialized")
    return supabase_client


def get_model_loader() -> ModelLoader:
    """Получение загрузчика модели (для обратной совместимости)"""
    # Пытаемся получить из менеджера моделей
    if model_manager is not None:
        active_model = model_manager.get_active_model()
        if active_model is not None:
            return active_model
    
    # Fallback к старому способу
    if model_loader is None:
        raise RuntimeError("Model loader not initialized")
    return model_loader


def get_model_manager() -> ModelManager:
    """Получение менеджера моделей"""
    if model_manager is None:
        raise RuntimeError("Model manager not initialized")
    return model_manager
