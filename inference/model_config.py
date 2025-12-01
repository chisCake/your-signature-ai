"""
Конфигурация модели для централизованного управления
Использует переменную окружения MODEL_NAME для автоматической генерации конфигурации
"""

import os
import glob

# Получаем имя модели из переменной окружения
MODEL_NAME = os.getenv("MODEL_NAME", "v1")

def get_active_model_config():
    """Автоматическая генерация конфигурации на основе MODEL_NAME"""
    return {
        "module": f"models.{MODEL_NAME}",
        "class_name": "SignatureEncoder",
        "file_path": f"models/{MODEL_NAME}.py",
        "checkpoint_path": f"models/{MODEL_NAME}.pt",
    }

def get_available_models():
    """Сканирует папку models/ и возвращает доступные модели"""
    try:
        import os
        models_dir = "models"
        if not os.path.exists(models_dir):
            return ["v1"]  # Fallback
        
        available = []
        for filename in os.listdir(models_dir):
            if filename.endswith(".py") and filename != "__init__.py":
                model_name = filename.replace(".py", "")
                # Проверяем, что есть соответствующий .pt файл
                pt_file = os.path.join(models_dir, f"{model_name}.pt")
                if os.path.exists(pt_file):
                    available.append(model_name)
        return available if available else ["v1"]  # Fallback
    except Exception:
        return ["v1"]  # Fallback

def get_model_config(model_name: str = None):
    """Получение конфигурации модели по имени"""
    if model_name is None:
        return get_active_model_config()
    
    available = get_available_models()
    if model_name not in available:
        raise ValueError(f"Model '{model_name}' not found. Available models: {available}")
    
    return {
        "module": f"models.{model_name}",
        "class_name": "SignatureEncoder",
        "file_path": f"models/{model_name}.py",
        "checkpoint_path": f"models/{model_name}.pt",
    }

def switch_model(model_name: str):
    """Переключение активной модели (только для разработки)"""
    global MODEL_NAME
    
    available = get_available_models()
    if model_name not in available:
        raise ValueError(f"Model '{model_name}' not found. Available models: {available}")
    
    MODEL_NAME = model_name
    return get_active_model_config()
