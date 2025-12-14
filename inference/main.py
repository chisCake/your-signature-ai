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
from utils.model_manager import ModelManager
from utils.blob_client import BlobClient
from dependencies import set_supabase_client, set_model_loader, set_model_manager
from routes.health import router as health_router
from routes.forgery_by_id import router as forgery_by_id_router
from routes.forgery_by_data import router as forgery_by_data_router
from routes.model import router as model_router
from routes.model_upload import router as model_upload_router

# Настройка логирования
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Настройка access logger для uvicorn (логирование всех HTTP запросов)
uvicorn_access_logger = logging.getLogger("uvicorn.access")
uvicorn_access_logger.setLevel(logging.INFO)

# Глобальные переменные для хранения инициализированных компонентов
supabase_client: SupabaseClient = None
model_loader: ModelLoader = None
model_manager: ModelManager = None


def check_environment_variables() -> Dict[str, str]:
    """Проверка наличия необходимых переменных окружения"""
    required_vars = {
        "SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
    }

    # Опциональные переменные
    optional_vars = {
        "MODEL_NAME": os.getenv("MODEL_NAME", "v1"),
        "MODEL_PATH": os.getenv("MODEL_PATH"),  # Для обратной совместимости
        "ENVIRONMENT": os.getenv("ENVIRONMENT", "development"),
    }

    missing_vars = [var for var, value in required_vars.items() if not value]

    if missing_vars:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing_vars)}"
        )

    environment = optional_vars["ENVIRONMENT"].lower()
    logger.info("All required environment variables are set (env=%s)", environment)
    logger.info(f"Using model: {optional_vars['MODEL_NAME']}")
    if environment == "production" and not os.getenv("BLOB_READ_WRITE_TOKEN"):
        raise ValueError(
            "BLOB_READ_WRITE_TOKEN must be set when ENVIRONMENT=production"
        )

    # Объединяем обязательные и опциональные переменные
    all_vars = {**required_vars, **optional_vars}
    return all_vars


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
    """Инициализация модели с немедленной загрузкой (для обратной совместимости)"""
    try:
        # Получаем путь к модели из переменной окружения или используем конфигурацию
        model_path = os.getenv("MODEL_PATH")
        model_name = os.getenv("MODEL_NAME", "v1")

        # Модель загружается сразу при создании ModelLoader
        # Если MODEL_PATH не задан, ModelLoader использует путь из конфигурации
        loader = ModelLoader(model_path)

        if model_path:
            logger.info(f"Model loader initialized and model loaded for {model_path}")
        else:
            logger.info(f"Model loader initialized using MODEL_NAME={model_name}")

        return loader
    except Exception as e:
        logger.error(f"Failed to initialize model: {e}")
        raise


def initialize_model_manager() -> ModelManager:
    """Инициализация менеджера моделей"""
    try:
        # Получаем путь к начальной модели
        model_path = os.getenv("MODEL_PATH")
        model_name = os.getenv("MODEL_NAME", "v1")
        environment = os.getenv("ENVIRONMENT", "development").lower()

        # Если MODEL_PATH не задан, формируем путь из MODEL_NAME
        if not model_path:
            model_path = f"models/{model_name}.pt"

        blob_client = None
        if environment == "production":
            blob_token = os.getenv("BLOB_READ_WRITE_TOKEN")
            if not blob_token:
                raise ValueError("BLOB_READ_WRITE_TOKEN is required in production")
            blob_client = BlobClient(blob_token)
            logger.info("Blob storage enabled for production environment")

        logger.info(f"Initializing ModelManager with initial model: {model_path}")
        manager = ModelManager(
            initial_model_path=model_path,
            blob_client=blob_client,
            environment=environment,
        )

        logger.info("ModelManager initialized successfully")
        return manager
    except Exception as e:
        logger.error(f"Failed to initialize ModelManager: {e}")
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    global supabase_client, model_loader, model_manager

    logger.info("Starting inference server...")

    try:
        # Проверка переменных окружения
        env_vars = check_environment_variables()

        # Инициализация Supabase клиента
        supabase_client = initialize_supabase_client()
        set_supabase_client(supabase_client)

        # Инициализация менеджера моделей (новый способ)
        model_manager = initialize_model_manager()
        set_model_manager(model_manager)

        # Для обратной совместимости также устанавливаем model_loader
        # Получаем активную модель из менеджера
        active_model = model_manager.get_active_model()
        if active_model:
            model_loader = active_model
            set_model_loader(model_loader)
        else:
            # Fallback к старому способу
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
    "http://127.0.0.1:3000",  # Alternative localhost
    "https://localhost:3000",  # HTTPS localhost
]

# Объединяем все разрешенные домены
all_origins = list(set(frontend_urls + additional_origins))

logger.info(f"CORS allowed origins: {all_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=all_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(health_router)
app.include_router(forgery_by_id_router)
app.include_router(forgery_by_data_router)
app.include_router(model_router)
app.include_router(model_upload_router)


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
        access_log=True,  # Явно включаем access log для всех запросов
    )
