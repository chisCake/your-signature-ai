"""
Модуль для загрузки и управления PyTorch моделью SignatureEncoder
"""

import os
import logging
import gc
import psutil
from typing import Optional, Any, Dict
import torch
import torch.nn as nn
import torch.nn.functional as F

# Импорт конфигурации памяти
from memory_config import MemoryConfig

logger = logging.getLogger(__name__)

# Импорт конфигурации модели
from model_config import get_active_model_config

# Динамический импорт модели на основе конфигурации
def _import_model_class():
    """Динамический импорт класса модели на основе конфигурации"""
    try:
        model_config = get_active_model_config()
        module_name = model_config["module"]
        class_name = model_config["class_name"]
        
        # Импортируем модуль
        module = __import__(module_name, fromlist=[class_name])
        model_class = getattr(module, class_name)
        
        logger.info(f"Successfully imported {class_name} from {module_name}")
        return model_class
    except Exception as e:
        logger.error(f"Could not import model class: {e}")
        return None

# Получаем класс модели
SignatureEncoder = _import_model_class()


class ModelLoader:
    """Класс для загрузки и управления SignatureEncoder моделью с оптимизацией памяти"""
    
    def __init__(self, model_path: str = None):
        """
        Инициализация загрузчика модели
        
        Args:
            model_path: Путь к файлу модели (.pt). Если не указан, берется из конфигурации
        """
        # Применяем настройки PyTorch для экономии памяти
        MemoryConfig.apply_torch_settings()
        
        # Получаем конфигурацию активной модели
        model_config = get_active_model_config()
        
        # Используем переданный путь или путь из конфигурации
        self.model_path = model_path or model_config["checkpoint_path"]
        self.model_config_info = model_config
        
        self.model: Optional[SignatureEncoder] = None
        self.device = self._get_device()
        self.is_model_loaded = False
        self.model_config: Optional[Dict] = None
            
        self.checkpoint_cache: Optional[Dict] = None
        
        logger.info(f"ModelLoader initialized with path: {self.model_path}")
        logger.info(f"Using device: {self.device}")
        logger.info(f"Model class: {model_config['class_name']} from {model_config['module']}")
        
        if SignatureEncoder is None:
            raise ImportError(f"Model class {model_config['class_name']} not available from {model_config['module']}")
        
        # Всегда загружаем модель сразу
        self.load_model()
    
    def _get_device(self) -> torch.device:
        """Определение устройства для работы модели"""
        if torch.cuda.is_available():
            device = torch.device("cuda")
            logger.info(f"CUDA available: {torch.cuda.get_device_name()}")
        elif torch.backends.mps.is_available():
            device = torch.device("mps")  # Apple Silicon
            logger.info("MPS (Apple Silicon) available")
        else:
            device = torch.device("cpu")
            logger.info("Using CPU")
        
        return device
    
    def _log_memory_usage(self, stage: str) -> None:
        """Логирование использования памяти"""
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            memory_mb = memory_info.rss / 1024 / 1024
            
            # Получение информации о GPU памяти если доступно
            gpu_info = ""
            if torch.cuda.is_available():
                gpu_memory = torch.cuda.memory_allocated() / 1024 / 1024
                gpu_max = torch.cuda.max_memory_allocated() / 1024 / 1024
                gpu_info = f", GPU: {gpu_memory:.1f}MB (max: {gpu_max:.1f}MB)"
            
            logger.info(f"Memory usage at {stage}: {memory_mb:.1f}MB{gpu_info}")
        except Exception as e:
            logger.warning(f"Could not get memory info: {e}")
    
    def _ensure_model_loaded(self) -> None:
        """Проверяет, что модель загружена"""
        if not self.is_model_loaded:
            raise RuntimeError("Model should be loaded at initialization. This indicates a bug.")
    
    def load_model(self) -> None:
        """Загрузка модели SignatureEncoder из checkpoint файла с оптимизацией памяти"""
        try:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model file not found: {self.model_path}")
            
            self._log_memory_usage("before_model_load")
            logger.info(f"Loading SignatureEncoder from {self.model_path}...")
            
            # Загрузка checkpoint с оптимизацией памяти
            loading_kwargs = MemoryConfig.get_model_loading_kwargs()
            loading_kwargs["map_location"] = self.device
            
            # Убираем неподдерживаемые параметры
            safe_kwargs = {}
            for key, value in loading_kwargs.items():
                if key in ["map_location", "weights_only"]:
                    safe_kwargs[key] = value
            
            checkpoint = torch.load(self.model_path, **safe_kwargs)
            
            # Извлечение конфигурации модели из checkpoint
            if isinstance(checkpoint, dict) and 'config' in checkpoint:
                config = checkpoint['config']
                self.model_config = config.get('model', {})
                logger.info(f"Found model config in checkpoint: {self.model_config}")
            else:
                # Конфигурация по умолчанию в зависимости от версии модели
                model_name = self.model_config_info.get("module", "").split(".")[-1] if "." in self.model_config_info.get("module", "") else "v1"
                
                if model_name == "v2":
                    # Конфигурация для v2
                    self.model_config = {
                        'in_features': 21,  # 21 признак для v2
                        'conv_channels': (64, 128, 256),  # 3 слоя CNN для v2
                        'gru_hidden': 256,
                        'gru_layers': 3,
                        'embedding_dim': 256,
                        'dropout': 0.3
                    }
                else:
                    # Конфигурация для v1 (по умолчанию)
                    self.model_config = {
                        'in_features': 11,  # 11 признаков для v1
                        'conv_channels': (64, 128),
                        'gru_hidden': 256,
                        'gru_layers': 3,
                        'embedding_dim': 256,
                        'dropout': 0.2
                    }
                logger.warning(f"No model config found in checkpoint, using defaults for {model_name}")
            
            self._log_memory_usage("after_checkpoint_load")
            
            # Определение значений по умолчанию в зависимости от версии модели
            model_name = self.model_config_info.get("module", "").split(".")[-1] if "." in self.model_config_info.get("module", "") else "v1"
            
            if model_name == "v2":
                default_in_features = 21
                default_conv_channels = (64, 128, 256)
                default_dropout = 0.3
            else:
                default_in_features = 11
                default_conv_channels = (64, 128)
                default_dropout = 0.2
            
            # Создание модели с правильной архитектурой
            self.model = SignatureEncoder(
                in_features=self.model_config.get('in_features', default_in_features),
                conv_channels=self.model_config.get('conv_channels', default_conv_channels),
                gru_hidden=self.model_config.get('gru_hidden', 256),
                gru_layers=self.model_config.get('gru_layers', 3),
                emb_dim=self.model_config.get('embedding_dim', 256),
                dropout=self.model_config.get('dropout', default_dropout)
            )
            
            # Загрузка весов модели
            if isinstance(checkpoint, dict) and 'model' in checkpoint:
                # Загрузка state_dict из checkpoint
                self.model.load_state_dict(checkpoint['model'])
                logger.info("Model weights loaded from checkpoint['model']")
            elif isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
                # Альтернативный ключ для state_dict
                self.model.load_state_dict(checkpoint['model_state_dict'])
                logger.info("Model weights loaded from checkpoint['model_state_dict']")
            else:
                # Если checkpoint содержит саму модель
                if hasattr(checkpoint, 'state_dict'):
                    self.model.load_state_dict(checkpoint.state_dict())
                    logger.info("Model weights loaded from checkpoint.state_dict()")
                else:
                    raise ValueError("Could not find model weights in checkpoint")
            
            # Перемещение модели на нужное устройство
            self.model = self.model.to(self.device)
            
            # Установка режима оценки
            self.model.eval()
            
            # Очистка кэша checkpoint для экономии памяти
            self.checkpoint_cache = checkpoint
            del checkpoint
            gc.collect()
            
            self.is_model_loaded = True
            self._log_memory_usage("after_model_load")
            logger.info("SignatureEncoder loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load SignatureEncoder: {e}")
            self.is_model_loaded = False
            raise
    
    def is_loaded(self) -> bool:
        """Проверка, загружена ли модель"""
        return self.is_model_loaded and self.model is not None
    
    def get_model(self) -> Optional[SignatureEncoder]:
        """Получение загруженной модели SignatureEncoder"""
        if not self.is_loaded():
            logger.warning("Model is not loaded")
            return None
        return self.model
    
    def encode_signature(self, signature_data: torch.Tensor, mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        """
        Кодирование подписи в эмбеддинг с автоматической загрузкой модели
        
        Args:
            signature_data: Тензор с данными подписи (B, T, F)
            mask: Маска для валидных позиций (B, T), опционально
            
        Returns:
            L2-нормализованные эмбеддинги (B, embedding_dim)
        """
        # Обеспечиваем загрузку модели при необходимости
        self._ensure_model_loaded()
        
        if not self.is_loaded():
            raise RuntimeError("Model is not loaded")
        
        try:
            with torch.no_grad():
                # Перемещение данных на нужное устройство
                signature_data = signature_data.to(self.device)
                if mask is not None:
                    mask = mask.to(self.device)
                
                # Получение эмбеддингов
                embeddings = self.model(signature_data, mask)
                
                # Проверка на валидность эмбеддингов
                if torch.isnan(embeddings).any() or torch.isinf(embeddings).any():
                    raise RuntimeError("Invalid embeddings detected (NaN/Inf)")
                
                logger.debug(f"Generated embeddings shape: {embeddings.shape}")
                return embeddings
                
        except Exception as e:
            logger.error(f"Signature encoding failed: {e}")
            raise
    
    def get_model_info(self) -> dict:
        """Получение информации о модели SignatureEncoder"""
        if not self.is_loaded():
            return {"status": "not_loaded"}
        
        info = {
            "path": self.model_path,
            "device": str(self.device),
            "loaded": self.is_model_loaded,
            "model_type": self.model_config_info["class_name"],
            "module": self.model_config_info["module"],
            "file_path": self.model_config_info["file_path"],
            "architecture": "CNN(1D) -> BiGRU -> Attention -> FC -> L2-normalized embedding"
        }
        
        # Добавление конфигурации модели
        if self.model_config:
            info["model_config"] = self.model_config
        
        # Добавление информации о параметрах модели
        if hasattr(self.model, 'parameters'):
            total_params = sum(p.numel() for p in self.model.parameters())
            trainable_params = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
            info.update({
                "total_parameters": total_params,
                "trainable_parameters": trainable_params
            })
        
        return info
    
    def unload_model(self) -> None:
        """Выгрузка модели из памяти для экономии ресурсов"""
        if self.is_model_loaded:
            logger.info("Unloading model from memory...")
            self._log_memory_usage("before_unload")
            
            # Очистка модели
            if self.model is not None:
                del self.model
                self.model = None
            
            # Очистка кэша checkpoint
            if self.checkpoint_cache is not None:
                del self.checkpoint_cache
                self.checkpoint_cache = None
            
            # Принудительная очистка памяти
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            self.is_model_loaded = False
            self._log_memory_usage("after_unload")
            logger.info("Model unloaded successfully")
    
    def get_memory_info(self) -> dict:
        """Получение информации об использовании памяти"""
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            
            info = {
                "rss_mb": memory_info.rss / 1024 / 1024,
                "vms_mb": memory_info.vms / 1024 / 1024,
                "model_loaded": self.is_model_loaded
            }
            
            if torch.cuda.is_available():
                info.update({
                    "gpu_allocated_mb": torch.cuda.memory_allocated() / 1024 / 1024,
                    "gpu_cached_mb": torch.cuda.memory_reserved() / 1024 / 1024,
                    "gpu_max_allocated_mb": torch.cuda.max_memory_allocated() / 1024 / 1024
                })
            
            return info
        except Exception as e:
            logger.warning(f"Could not get memory info: {e}")
            return {"error": str(e)}
