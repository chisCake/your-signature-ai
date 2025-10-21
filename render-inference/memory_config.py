"""
Конфигурация для оптимизации использования памяти
"""

import os
import torch

class MemoryConfig:
    """Конфигурация для управления памятью"""
    
    # Настройки PyTorch для экономии памяти
    TORCH_MEMORY_SETTINGS = {
        "torch.backends.cudnn.benchmark": False,  # Отключаем для стабильности
        "torch.backends.cudnn.deterministic": True,  # Детерминизм для воспроизводимости
    }
    
    # Настройки для загрузки модели
    MODEL_LOADING_SETTINGS = {
        "weights_only": True,  # Загружаем только веса
        "map_location": "cpu",  # Загружаем на CPU сначала
    }
    
    # Лимиты памяти (в MB)
    MEMORY_LIMITS = {
        "max_model_memory_mb": 200,  # Максимальная память для модели
        "warning_threshold_mb": 400,  # Порог предупреждения
        "critical_threshold_mb": 500,  # Критический порог
    }
    
    @classmethod
    def apply_torch_settings(cls):
        """Применение настроек PyTorch для экономии памяти"""
        for setting, value in cls.TORCH_MEMORY_SETTINGS.items():
            try:
                # Динамически устанавливаем настройки PyTorch
                if hasattr(torch.backends.cudnn, setting.split('.')[-1]):
                    setattr(torch.backends.cudnn, setting.split('.')[-1], value)
            except Exception as e:
                print(f"Warning: Could not set {setting}: {e}")
    
    @classmethod
    def get_model_loading_kwargs(cls):
        """Получение параметров для загрузки модели"""
        kwargs = cls.MODEL_LOADING_SETTINGS.copy()
        
        # Определяем устройство
        if torch.cuda.is_available():
            kwargs["map_location"] = "cuda"
        elif torch.backends.mps.is_available():
            kwargs["map_location"] = "mps"
        else:
            kwargs["map_location"] = "cpu"
        
        return kwargs
    
    @classmethod
    def should_use_lazy_loading(cls):
        """Определяет, нужно ли использовать ленивую загрузку"""
        # Используем ленивую загрузку в продакшене или при ограниченной памяти
        return os.getenv("ENVIRONMENT", "development") == "production" or \
               os.getenv("LAZY_LOADING", "true").lower() == "true"
    
    @classmethod
    def get_memory_warning_level(cls, memory_mb: float) -> str:
        """Определяет уровень предупреждения по использованию памяти"""
        if memory_mb >= cls.MEMORY_LIMITS["critical_threshold_mb"]:
            return "critical"
        elif memory_mb >= cls.MEMORY_LIMITS["warning_threshold_mb"]:
            return "warning"
        else:
            return "ok"
