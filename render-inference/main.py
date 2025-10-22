"""
FastAPI Inference Server для анализа подписей
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional

# Загрузка переменных окружения из .env файла
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from utils.supabase_client import SupabaseClient
from utils.model_loader import ModelLoader
from dependencies import set_supabase_client, set_model_loader
from routes.health import router as health_router
from routes.forgery_by_id import router as forgery_by_id_router
from routes.forgery_by_data import router as forgery_by_data_router

# Настройка логирования
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Глобальные переменные для хранения инициализированных компонентов
supabase_client: SupabaseClient = None
model_loader: ModelLoader = None


def check_environment_variables() -> Dict[str, str]:
    """Проверка наличия необходимых переменных окружения"""
    required_vars = {
        "SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        "MODEL_PATH": os.getenv("MODEL_PATH"),
    }

    missing_vars = [var for var, value in required_vars.items() if not value]

    if missing_vars:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing_vars)}"
        )

    logger.info("All required environment variables are set")
    return required_vars


def initialize_supabase_client() -> SupabaseClient:
    """Инициализация Supabase клиента и проверка подключения"""
    try:
        client = SupabaseClient()

        # Проверка подключения через простой запрос
        # Можно использовать любой простой запрос для проверки
        logger.info("Supabase client initialized successfully")
        return client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        raise


def initialize_model() -> ModelLoader:
    """Инициализация модели с автоматической конфигурацией"""
    try:
        model_path = os.getenv("MODEL_PATH")
        # Используем автоматическую конфигурацию ленивой загрузки
        loader = ModelLoader(model_path, lazy_load=None)
        logger.info(f"Model loader initialized for {model_path}")
        return loader
    except Exception as e:
        logger.error(f"Failed to initialize model: {e}")
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    global supabase_client, model_loader

    logger.info("Starting inference server...")

    try:
        # Проверка переменных окружения
        env_vars = check_environment_variables()

        # Инициализация Supabase клиента
        supabase_client = initialize_supabase_client()
        set_supabase_client(supabase_client)

        # Инициализация модели
        model_loader = initialize_model()
        set_model_loader(model_loader)

        logger.info("Inference server started successfully")

    except Exception as e:
        logger.error(f"Failed to start inference server: {e}")
        raise

    yield

    # Cleanup при завершении работы
    logger.info("Shutting down inference server...")


# Функции-зависимости теперь находятся в dependencies.py

# Создание FastAPI приложения
app = FastAPI(
    title="Signature Inference Server",
    description="FastAPI сервер для анализа подписей с использованием ML модели",
    version="1.0.0",
    lifespan=lifespan,
)

# Настройка CORS
frontend_urls = os.getenv("FRONTEND_URL", "http://localhost:3000").split(",")
# Убираем пробелы и пустые строки
frontend_urls = [url.strip() for url in frontend_urls if url.strip()]

# Добавляем дополнительные домены для разработки и продакшена
additional_origins = [
    "http://localhost:3000",  # Next.js dev server
    "http://127.0.0.1:3000",   # Alternative localhost
    "https://localhost:3000", # HTTPS localhost
]

# Объединяем все разрешенные домены
all_origins = list(set(frontend_urls + additional_origins))

logger.info(f"CORS allowed origins: {all_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=all_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(health_router)
app.include_router(forgery_by_id_router)
app.include_router(forgery_by_data_router)


if __name__ == "__main__":
    import uvicorn

    # Получение параметров из переменных окружения
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,  # В продакшене лучше отключить
        log_level="info",
    )
