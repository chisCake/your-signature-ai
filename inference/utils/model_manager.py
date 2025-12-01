"""
Менеджер моделей с поддержкой hotswap
Позволяет загружать и переключать модели без перезагрузки сервера
"""

import os
import logging
import threading
import time
from typing import Optional, Dict, Any, Literal, TypedDict
from enum import Enum
from pathlib import Path

from utils.model_loader import ModelLoader
from utils.blob_client import BlobClient

logger = logging.getLogger(__name__)


class SwapStrategy(Enum):
    """Стратегии замены моделей"""

    ZERO_DOWNTIME = (
        "zero_downtime"  # 1 работает → 2 запускается → 2 запущен → 1 отключается
    )
    SEQUENTIAL = (
        "sequential"  # 1 работает → 1 останавливается → 2 запускается → 2 работает
    )


class ModelState(Enum):
    """Состояния модели"""

    LOADING = "loading"
    READY = "ready"
    ACTIVE = "active"
    UNLOADING = "unloading"
    ERROR = "error"


class StorageInfo(TypedDict, total=False):
    type: Literal["local", "blob"]
    py_blob_path: str
    pt_blob_path: str
    py_download_url: str
    pt_download_url: str
    synced_at: float
    py_size: int
    pt_size: int


class ModelInstance:
    """Экземпляр модели с метаданными"""

    def __init__(
        self,
        model_name: str,
        model_path: str,
        py_file_path: str,
        storage: Optional[StorageInfo] = None,
    ):
        self.model_name = model_name
        self.model_path = model_path
        self.py_file_path = py_file_path
        self.loader: Optional[ModelLoader] = None
        self.state = ModelState.LOADING
        self.error: Optional[str] = None
        self.created_at = time.time()
        self.last_used = time.time()
        self.storage: StorageInfo = storage or {
            "type": "local",
            "py_blob_path": "",
            "pt_blob_path": "",
            "synced_at": time.time(),
        }

    def is_ready(self) -> bool:
        """Проверка готовности модели"""
        return (
            self.state == ModelState.READY
            and self.loader is not None
            and self.loader.is_loaded()
        )

    def is_active(self) -> bool:
        """Проверка активности модели"""
        return self.state == ModelState.ACTIVE

    def can_serve_requests(self) -> bool:
        """Проверка, может ли модель обрабатывать запросы (READY или ACTIVE)"""
        return (
            self.state in (ModelState.READY, ModelState.ACTIVE)
            and self.loader is not None
            and self.loader.is_loaded()
        )

    def update_last_used(self):
        """Обновление времени последнего использования"""
        self.last_used = time.time()


class ModelManager:
    """Менеджер моделей с поддержкой hotswap"""

    def __init__(
        self,
        initial_model_path: Optional[str] = None,
        blob_client: Optional[BlobClient] = None,
        environment: str = "development",
    ):
        """
        Инициализация менеджера моделей

        Args:
            initial_model_path: Путь к начальной модели (опционально)
            blob_client: Клиент для работы с Vercel Blob (опционально)
            environment: Текущее окружение (development | production)
        """
        self.models: Dict[str, ModelInstance] = {}
        self.active_model_name: Optional[str] = None
        self.lock = threading.RLock()  # Reentrant lock для вложенных вызовов
        self.environment = environment.lower()
        self.blob_client = blob_client
        self.storage_registry: Dict[str, StorageInfo] = {}
        self.models_dir = Path("models")
        self.models_dir.mkdir(exist_ok=True)

        if self._should_use_blob_storage():
            try:
                self._sync_blob_registry()
            except Exception as sync_error:
                logger.error("Failed to synchronize blob storage: %s", sync_error)
                raise

        # Сканируем папку models и регистрируем все найденные модели
        self._scan_models_directory()

        # Загружаем начальную модель если указана
        if initial_model_path:
            try:
                model_name = Path(initial_model_path).stem
                self._load_initial_model(model_name, initial_model_path)
            except Exception as e:
                logger.error(f"Failed to load initial model: {e}")
                raise

    def _load_initial_model(self, model_name: str, model_path: str):
        """Загрузка начальной модели при старте"""
        py_file_path = self._resolve_py_path(model_name, model_path)

        # Используем существующий экземпляр, если он уже зарегистрирован
        if model_name in self.models:
            instance = self.models[model_name]
            # Обновляем пути на случай, если они изменились
            instance.model_path = model_path
            instance.py_file_path = py_file_path
        else:
            storage = self.storage_registry.get(
                model_name,
                {
                    "type": "blob" if self._should_use_blob_storage() else "local",
                    "py_blob_path": f"models/{model_name}.py",
                    "pt_blob_path": f"models/{model_name}.pt",
                    "synced_at": time.time(),
                },
            )
            instance = ModelInstance(
                model_name, model_path, py_file_path, storage=storage
            )
            self.models[model_name] = instance

        self._ensure_local_storage(instance)

        try:
            logger.info(f"Loading initial model: {model_name}")
            loader = ModelLoader(model_path=model_path, py_file_path=py_file_path)
            instance.loader = loader
            instance.state = ModelState.READY

            self.active_model_name = model_name
            instance.state = ModelState.ACTIVE

            logger.info(f"Initial model {model_name} loaded and activated")
        except Exception as e:
            instance.state = ModelState.ERROR
            instance.error = str(e)
            logger.error(f"Failed to load initial model {model_name}: {e}")
            raise

    def _resolve_py_path(self, model_name: str, model_path: str) -> str:
        py_file_path = model_path.replace(".pt", ".py")
        if not os.path.exists(py_file_path):
            py_file_path = str(self.models_dir / f"{model_name}.py")
        if not os.path.exists(py_file_path):
            raise FileNotFoundError(f"Python model file not found for {model_name}")
        return py_file_path

    def _scan_models_directory(self) -> None:
        """Сканирует папку models и регистрирует все найденные модели"""
        if not self.models_dir.exists():
            logger.info("Models directory does not exist, skipping scan")
            return

        # Находим все пары .pt и .py файлов
        pt_files = list(self.models_dir.glob("*.pt"))
        found_models = set()

        for pt_file in pt_files:
            model_name = pt_file.stem
            py_file = self.models_dir / f"{model_name}.py"

            # Проверяем наличие соответствующего .py файла
            if py_file.exists():
                found_models.add(model_name)

                # Регистрируем модель, если её ещё нет
                if model_name not in self.models:
                    storage = self.storage_registry.get(
                        model_name,
                        {
                            "type": (
                                "blob" if self._should_use_blob_storage() else "local"
                            ),
                            "py_blob_path": f"models/{model_name}.py",
                            "pt_blob_path": f"models/{model_name}.pt",
                            "synced_at": time.time(),
                        },
                    )

                    instance = ModelInstance(
                        model_name,
                        str(pt_file),
                        str(py_file),
                        storage=storage,
                    )
                    # Модель не загружена, только зарегистрирована
                    # Состояние READY, но loader = None, поэтому is_ready() вернет False
                    # Это позволит отображать модель в списке, но показывать, что она не загружена
                    instance.state = ModelState.READY
                    # loader остается None - модель не загружена в память
                    self.models[model_name] = instance
                    self._record_storage_info(model_name, instance.storage)
                    logger.info(
                        f"Registered model {model_name} from directory scan (not loaded)"
                    )

        if found_models:
            logger.info(
                f"Found {len(found_models)} models in directory: {', '.join(sorted(found_models))}"
            )
        else:
            logger.info("No models found in models directory")

    def _should_use_blob_storage(self) -> bool:
        return self.environment == "production" and self.blob_client is not None

    def _record_storage_info(self, model_name: str, storage: StorageInfo) -> None:
        storage["synced_at"] = time.time()
        self.storage_registry[model_name] = storage

    def _format_model_error(self, error: Exception) -> str:
        """Форматирование ошибки модели в понятное сообщение"""
        error_str = str(error)

        # Проверяем на несоответствие архитектуры
        if "size mismatch" in error_str:
            return (
                "Несоответствие архитектуры: файл весов (.pt) не совместим с кодом модели (.py). "
                "Убедитесь, что загружаете правильную пару файлов."
            )

        if "Error(s) in loading state_dict" in error_str:
            return (
                "Ошибка загрузки весов: структура модели в .py файле не соответствует "
                "сохранённым весам в .pt файле. Проверьте совместимость файлов."
            )

        if "SignatureEncoder" in error_str and "has no attribute" in error_str:
            return (
                "Ошибка в коде модели: класс SignatureEncoder в .py файле имеет неверную структуру. "
                "Проверьте, что .py файл содержит корректное определение класса SignatureEncoder."
            )

        if "No module named" in error_str or "ModuleNotFoundError" in error_str:
            if "config" in error_str:
                return (
                    "Ошибка загрузки модели: модель была сохранена с использованием модуля 'config' из training, "
                    "который не доступен в inference. Убедитесь, что модель сохранена корректно."
                )
            return "Отсутствует зависимость: код модели требует модуль, который не установлен на сервере."

        if "Weights only load failed" in error_str or "Unsupported global" in error_str:
            return (
                "Ошибка загрузки модели: файл содержит кастомные классы, которые не могут быть загружены "
                "в безопасном режиме. Убедитесь, что модель сохранена корректно."
            )

        if "tuple index out of range" in error_str or "IndexError" in error_str:
            if "conv_channels" in error_str or "cnn_channels" in error_str:
                return (
                    "Ошибка конфигурации модели: количество слоёв CNN в конфигурации не соответствует "
                    "архитектуре модели. Проверьте, что конфигурация в checkpoint соответствует коду модели."
                )
            return (
                "Ошибка индексации: модель пытается обратиться к несуществующему элементу. "
                "Проверьте совместимость конфигурации и кода модели."
            )

        # Возвращаем оригинальную ошибку, если не распознали
        return error_str

    def _ensure_local_storage(self, instance: ModelInstance) -> None:
        if instance.storage.get("type") != "blob" or not self.blob_client:
            return

        pt_blob_path = instance.storage.get("pt_blob_path")
        py_blob_path = instance.storage.get("py_blob_path")

        if pt_blob_path:
            resolved = self.blob_client.ensure_local_copy(
                pt_blob_path,
                Path(instance.model_path),
                download_url=instance.storage.get("pt_download_url"),
            )
            if resolved:
                instance.storage["pt_download_url"] = resolved
        if py_blob_path:
            resolved = self.blob_client.ensure_local_copy(
                py_blob_path,
                Path(instance.py_file_path),
                download_url=instance.storage.get("py_download_url"),
            )
            if resolved:
                instance.storage["py_download_url"] = resolved

    def _upload_files_to_blob(
        self,
        model_name: str,
        py_content: bytes,
        pt_content: bytes,
    ) -> StorageInfo:
        if not self.blob_client:
            raise RuntimeError("Blob client is not configured")

        py_pathname = f"models/{model_name}.py"
        pt_pathname = f"models/{model_name}.pt"

        py_result = self.blob_client.upload_bytes(
            py_pathname,
            py_content,
            content_type="text/x-python",
        )
        pt_result = self.blob_client.upload_bytes(
            pt_pathname,
            pt_content,
            content_type="application/octet-stream",
        )

        storage: StorageInfo = {
            "type": "blob",
            "py_blob_path": py_result.get("pathname", py_pathname),
            "pt_blob_path": pt_result.get("pathname", pt_pathname),
            "py_download_url": py_result.get("downloadUrl") or py_result.get("url"),
            "pt_download_url": pt_result.get("downloadUrl") or pt_result.get("url"),
            "synced_at": time.time(),
        }
        self._record_storage_info(model_name, storage)
        return storage

    def _sync_blob_registry(self) -> None:
        if not self.blob_client:
            return

        logger.info("Synchronizing local cache with Blob storage …")
        cursor: Optional[str] = None
        combined: Dict[str, StorageInfo] = {}

        while True:
            listing = self.blob_client.list(prefix="models/", cursor=cursor)
            for blob in listing.get("blobs", []):
                pathname = blob.get("pathname")
                if not pathname:
                    continue
                suffix = Path(pathname).suffix
                if suffix not in (".pt", ".py"):
                    continue
                model_name = Path(pathname).stem
                entry = combined.setdefault(
                    model_name,
                    {"type": "blob", "synced_at": time.time()},
                )
                entry["synced_at"] = time.time()
                if suffix == ".pt":
                    entry["pt_blob_path"] = pathname
                    entry["pt_download_url"] = blob.get("downloadUrl") or blob.get(
                        "url"
                    )
                    entry["pt_size"] = blob.get("size", 0)
                else:
                    entry["py_blob_path"] = pathname
                    entry["py_download_url"] = blob.get("downloadUrl") or blob.get(
                        "url"
                    )
                    entry["py_size"] = blob.get("size", 0)

            if not listing.get("hasMore") or not listing.get("cursor"):
                break
            cursor = listing.get("cursor")

        self.storage_registry = combined

        for model_name, storage in combined.items():
            instance_stub = ModelInstance(
                model_name=model_name,
                model_path=str(self.models_dir / f"{model_name}.pt"),
                py_file_path=str(self.models_dir / f"{model_name}.py"),
                storage=storage,
            )
            self._ensure_local_storage(instance_stub)

    def get_active_model(self) -> Optional[ModelLoader]:
        """Получение активной модели"""
        with self.lock:
            if self.active_model_name and self.active_model_name in self.models:
                instance = self.models[self.active_model_name]
                if instance.is_ready() or instance.is_active():
                    instance.update_last_used()
                    return instance.loader
            return None

    def upload_model(
        self,
        model_name: str,
        pt_content: bytes,
        py_content: bytes,
        swap_strategy: SwapStrategy = SwapStrategy.ZERO_DOWNTIME,
    ) -> Dict[str, Any]:
        """
        Загрузка новой модели

        Args:
            model_name: Имя модели
            pt_content: Содержимое .pt файла
            py_content: Содержимое .py файла
            swap_strategy: Стратегия замены

        Returns:
            Информация о результате загрузки
        """
        with self.lock:
            # Проверяем, что модель с таким именем не загружается
            if model_name in self.models:
                instance = self.models[model_name]
                if instance.state in [ModelState.LOADING, ModelState.UNLOADING]:
                    raise ValueError(
                        f"Model {model_name} is currently {instance.state.value}"
                    )

            pt_path = self.models_dir / f"{model_name}.pt"
            py_path = self.models_dir / f"{model_name}.py"
            storage_info: StorageInfo = {
                "type": "local",
                "pt_blob_path": str(pt_path),
                "py_blob_path": str(py_path),
                "synced_at": time.time(),
            }

            try:
                with open(pt_path, "wb") as f:
                    f.write(pt_content)
                with open(py_path, "wb") as f:
                    f.write(py_content)
                logger.info("Model files saved locally for %s", model_name)

                if self._should_use_blob_storage():
                    storage_info = self._upload_files_to_blob(
                        model_name=model_name,
                        py_content=py_content,
                        pt_content=pt_content,
                    )

                result = self._hotswap_model(
                    model_name,
                    swap_strategy,
                    storage_info=storage_info,
                )
                return result
            except Exception as e:
                logger.error(f"Failed to upload model {model_name}: {e}")
                if pt_path.exists():
                    pt_path.unlink()
                if py_path.exists():
                    py_path.unlink()
                raise

    def _hotswap_model(
        self,
        new_model_name: str,
        strategy: SwapStrategy,
        storage_info: Optional[StorageInfo] = None,
    ) -> Dict[str, Any]:
        """
        Выполнение hotswap модели

        Args:
            new_model_name: Имя новой модели
            strategy: Стратегия замены

        Returns:
            Информация о результате замены
        """
        with self.lock:
            pt_path = self.models_dir / f"{new_model_name}.pt"
            py_path = self.models_dir / f"{new_model_name}.py"

            if not pt_path.exists() or not py_path.exists():
                raise FileNotFoundError(f"Model files not found for {new_model_name}")

            old_model_name = self.active_model_name
            old_instance = self.models.get(old_model_name) if old_model_name else None

            # Используем существующий экземпляр, если он уже зарегистрирован
            if new_model_name in self.models:
                new_instance = self.models[new_model_name]
                # Обновляем пути на случай, если они изменились
                new_instance.model_path = str(pt_path)
                new_instance.py_file_path = str(py_path)
                # Обновляем storage, если передан новый
                if storage_info:
                    new_instance.storage = storage_info
                    self._record_storage_info(new_model_name, storage_info)
            else:
                # Создаем новый экземпляр
                storage = storage_info or self.storage_registry.get(
                    new_model_name,
                    {
                        "type": "blob" if self._should_use_blob_storage() else "local",
                        "py_blob_path": f"models/{new_model_name}.py",
                        "pt_blob_path": f"models/{new_model_name}.pt",
                        "synced_at": time.time(),
                    },
                )
                new_instance = ModelInstance(
                    new_model_name,
                    str(pt_path),
                    str(py_path),
                    storage=storage,
                )
                self.models[new_model_name] = new_instance
                self._record_storage_info(new_model_name, new_instance.storage)

            new_instance.state = ModelState.LOADING
            self._ensure_local_storage(new_instance)

            try:
                if strategy == SwapStrategy.ZERO_DOWNTIME:
                    return self._zero_downtime_swap(new_instance, old_instance)
                else:
                    return self._sequential_swap(new_instance, old_instance)
            except Exception as e:
                new_instance.state = ModelState.ERROR
                new_instance.error = str(e)
                logger.error(f"Hotswap failed for {new_model_name}: {e}")
                raise

    def _zero_downtime_swap(
        self, new_instance: ModelInstance, old_instance: Optional[ModelInstance]
    ) -> Dict[str, Any]:
        """
        Zero-downtime замена: 1 работает → 2 запускается → 2 запущен → 1 отключается
        """
        logger.info(f"Starting zero-downtime swap to {new_instance.model_name}")

        # Шаг 1: Загружаем новую модель (старая продолжает работать)
        try:
            logger.info(
                f"Loading new model {new_instance.model_name} (old model still active)"
            )
            new_loader = ModelLoader(
                model_path=new_instance.model_path,
                py_file_path=new_instance.py_file_path,
            )
            new_instance.loader = new_loader
            new_instance.state = ModelState.READY

            # Шаг 2: Активируем новую модель
            logger.info(f"Activating new model {new_instance.model_name}")
            self.active_model_name = new_instance.model_name
            new_instance.state = ModelState.ACTIVE

            # Шаг 3: Отключаем старую модель
            if old_instance:
                logger.info(f"Unloading old model {old_instance.model_name}")
                old_instance.state = ModelState.UNLOADING
                if old_instance.loader:
                    old_instance.loader.unload_model()
                old_instance.state = (
                    ModelState.READY
                )  # Готова к удалению, но не удаляем

            logger.info(
                f"Zero-downtime swap completed: {new_instance.model_name} is now active"
            )

            return {
                "success": True,
                "strategy": "zero_downtime",
                "new_model": new_instance.model_name,
                "old_model": old_instance.model_name if old_instance else None,
                "message": f"Model {new_instance.model_name} activated successfully",
                "storage": new_instance.storage,
            }

        except Exception as e:
            new_instance.state = ModelState.ERROR
            new_instance.error = self._format_model_error(e)
            # Восстанавливаем старую модель если она была и может обрабатывать запросы
            if old_instance and old_instance.can_serve_requests():
                self.active_model_name = old_instance.model_name
                old_instance.state = ModelState.ACTIVE
                logger.info(
                    f"Restored old model {old_instance.model_name} after failed swap"
                )
            raise

    def _sequential_swap(
        self, new_instance: ModelInstance, old_instance: Optional[ModelInstance]
    ) -> Dict[str, Any]:
        """
        Sequential замена: 1 работает → 1 останавливается → 2 запускается → 2 работает
        """
        logger.info(f"Starting sequential swap to {new_instance.model_name}")

        # Шаг 1: Останавливаем старую модель
        if old_instance:
            logger.info(f"Stopping old model {old_instance.model_name}")
            old_instance.state = ModelState.UNLOADING
            if old_instance.loader:
                old_instance.loader.unload_model()
            old_instance.state = ModelState.READY
            self.active_model_name = None

        # Шаг 2: Загружаем новую модель
        try:
            logger.info(f"Loading new model {new_instance.model_name}")
            new_loader = ModelLoader(
                model_path=new_instance.model_path,
                py_file_path=new_instance.py_file_path,
            )
            new_instance.loader = new_loader
            new_instance.state = ModelState.READY

            # Шаг 3: Активируем новую модель
            logger.info(f"Activating new model {new_instance.model_name}")
            self.active_model_name = new_instance.model_name
            new_instance.state = ModelState.ACTIVE

            logger.info(
                f"Sequential swap completed: {new_instance.model_name} is now active"
            )

            return {
                "success": True,
                "strategy": "sequential",
                "new_model": new_instance.model_name,
                "old_model": old_instance.model_name if old_instance else None,
                "message": f"Model {new_instance.model_name} activated successfully",
                "storage": new_instance.storage,
            }

        except Exception as e:
            new_instance.state = ModelState.ERROR
            new_instance.error = self._format_model_error(e)
            # Пытаемся восстановить старую модель
            if old_instance:
                try:
                    logger.warning(
                        f"Trying to restore old model {old_instance.model_name}"
                    )
                    old_loader = ModelLoader(
                        model_path=old_instance.model_path,
                        py_file_path=old_instance.py_file_path,
                    )
                    old_instance.loader = old_loader
                    old_instance.state = ModelState.ACTIVE
                    self.active_model_name = old_instance.model_name
                    logger.info(
                        f"Restored old model {old_instance.model_name} after failed swap"
                    )
                except Exception as restore_error:
                    logger.error(f"Failed to restore old model: {restore_error}")
            raise

    def get_model_info(self) -> Dict[str, Any]:
        """Получение информации о всех моделях"""
        with self.lock:
            models_info = {}
            for name, instance in self.models.items():
                models_info[name] = {
                    "name": name,
                    "state": instance.state.value,
                    "is_active": instance.is_active(),
                    "is_ready": instance.is_ready(),
                    "error": instance.error,
                    "created_at": instance.created_at,
                    "last_used": instance.last_used,
                    "storage": instance.storage,
                }

                if instance.loader:
                    try:
                        models_info[name][
                            "model_info"
                        ] = instance.loader.get_model_info()
                    except Exception as e:
                        models_info[name]["model_info_error"] = str(e)

            return {
                "active_model": self.active_model_name,
                "models": models_info,
                "total_models": len(self.models),
                "storage_registry": self.storage_registry,
            }

    def delete_model(self, model_name: str) -> Dict[str, Any]:
        """
        Удаление модели

        Args:
            model_name: Имя модели для удаления

        Returns:
            Информация о результате удаления
        """
        with self.lock:
            if model_name not in self.models:
                raise ValueError(f"Model {model_name} not found")

            instance = self.models[model_name]

            # Нельзя удалить активную модель
            if instance.is_active():
                raise ValueError(
                    f"Cannot delete active model {model_name}. Switch to another model first."
                )

            # Выгружаем модель если загружена
            if instance.loader:
                try:
                    instance.loader.unload_model()
                except Exception as e:
                    logger.warning(f"Error unloading model {model_name}: {e}")

            # Удаляем файлы
            pt_path = self.models_dir / f"{model_name}.pt"
            py_path = self.models_dir / f"{model_name}.py"

            deleted_files = []
            if pt_path.exists():
                pt_path.unlink()
                deleted_files.append(str(pt_path))
            if py_path.exists():
                py_path.unlink()
                deleted_files.append(str(py_path))

            # Удаляем из словаря
            del self.models[model_name]

            if self._should_use_blob_storage():
                storage = self.storage_registry.get(model_name) or instance.storage
                if storage.get("type") == "blob" and self.blob_client:
                    blob_targets = [
                        storage.get("pt_blob_path"),
                        storage.get("py_blob_path"),
                    ]
                    try:
                        self.blob_client.delete(
                            [target for target in blob_targets if target]
                        )
                    except Exception as blob_error:
                        logger.warning(
                            "Failed to delete blob resources for %s: %s",
                            model_name,
                            blob_error,
                        )
            self.storage_registry.pop(model_name, None)

            return {
                "success": True,
                "model_name": model_name,
                "deleted_files": deleted_files,
                "message": f"Model {model_name} deleted successfully",
            }
