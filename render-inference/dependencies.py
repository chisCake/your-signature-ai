"""
Модуль зависимостей для FastAPI приложения
Содержит функции для внедрения зависимостей, которые используются в роутах
"""

from typing import Optional
from utils.supabase_client import SupabaseClient
from utils.model_loader import ModelLoader

# Глобальные переменные для хранения инициализированных компонентов
supabase_client: Optional[SupabaseClient] = None
model_loader: Optional[ModelLoader] = None


def set_supabase_client(client: SupabaseClient):
    """Установка Supabase клиента"""
    global supabase_client
    supabase_client = client


def set_model_loader(loader: ModelLoader):
    """Установка загрузчика модели"""
    global model_loader
    model_loader = loader


def get_supabase_client() -> SupabaseClient:
    """Получение Supabase клиента"""
    if supabase_client is None:
        raise RuntimeError("Supabase client not initialized")
    return supabase_client


def get_model_loader() -> ModelLoader:
    """Получение загрузчика модели"""
    if model_loader is None:
        raise RuntimeError("Model loader not initialized")
    return model_loader
