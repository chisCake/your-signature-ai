"""
Модуль для загрузки и управления PyTorch моделью SignatureEncoder
"""

import os
import logging
from typing import Optional, Any, Dict
import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger(__name__)

# Импорт архитектуры модели из локальной копии
try:
    from models.v1 import SignatureEncoder
except ImportError:
    logger.error("Could not import SignatureEncoder from models.v1")
    SignatureEncoder = None


class ModelLoader:
    """Класс для загрузки и управления SignatureEncoder моделью"""
    
    def __init__(self, model_path: str):
        """
        Инициализация загрузчика модели
        
        Args:
            model_path: Путь к файлу модели (.pt)
        """
        self.model_path = model_path
        self.model: Optional[SignatureEncoder] = None
        self.device = self._get_device()
        self.is_model_loaded = False
        self.model_config: Optional[Dict] = None
        
        logger.info(f"ModelLoader initialized with path: {model_path}")
        logger.info(f"Using device: {self.device}")
        
        if SignatureEncoder is None:
            raise ImportError("SignatureEncoder class not available. Check colab-training/src path.")
    
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
    
    def load_model(self) -> None:
        """Загрузка модели SignatureEncoder из checkpoint файла"""
        try:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model file not found: {self.model_path}")
            
            logger.info(f"Loading SignatureEncoder from {self.model_path}...")
            
            # Загрузка checkpoint
            checkpoint = torch.load(self.model_path, map_location=self.device)
            
            # Извлечение конфигурации модели из checkpoint
            if isinstance(checkpoint, dict) and 'config' in checkpoint:
                config = checkpoint['config']
                self.model_config = config.get('model', {})
                logger.info(f"Found model config in checkpoint: {self.model_config}")
            else:
                # Конфигурация по умолчанию, если не найдена в checkpoint
                self.model_config = {
                    'in_features': 11,  # Исправлено: 11 признаков как в обучении
                    'conv_channels': (64, 128),
                    'gru_hidden': 256,
                    'gru_layers': 3,    # Исправлено: 3 слоя как в обучении
                    'embedding_dim': 256, # Исправлено: 256 как в обучении
                    'dropout': 0.2      # Исправлено: 0.2 как в обучении
                }
                logger.warning("No model config found in checkpoint, using defaults")
            
            # Создание модели с правильной архитектурой
            self.model = SignatureEncoder(
                in_features=self.model_config.get('in_features', 11),
                conv_channels=self.model_config.get('conv_channels', (64, 128)),
                gru_hidden=self.model_config.get('gru_hidden', 256),
                gru_layers=self.model_config.get('gru_layers', 3),
                emb_dim=self.model_config.get('embedding_dim', 256),
                dropout=self.model_config.get('dropout', 0.2)
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
            
            self.is_model_loaded = True
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
        Кодирование подписи в эмбеддинг
        
        Args:
            signature_data: Тензор с данными подписи (B, T, F)
            mask: Маска для валидных позиций (B, T), опционально
            
        Returns:
            L2-нормализованные эмбеддинги (B, embedding_dim)
        """
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
            "model_type": "SignatureEncoder",
            "architecture": "CNN(1D) -> BiGRU -> Attention -> FC -> L2-normalized embedding"
        }
        
        # Добавление конфигурации модели
        if self.model_config:
            info["config"] = self.model_config
        
        # Добавление информации о параметрах модели
        if hasattr(self.model, 'parameters'):
            total_params = sum(p.numel() for p in self.model.parameters())
            trainable_params = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
            info.update({
                "total_parameters": total_params,
                "trainable_parameters": trainable_params
            })
        
        return info
