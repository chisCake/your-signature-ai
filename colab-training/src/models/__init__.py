from typing import Dict

from .cnn import SignatureCNN
from .lstm import SignatureLSTM
from .gru import SignatureGRU
from .hybrid import SignatureHybrid

MODEL_REGISTRY: Dict[str, type] = {
    "cnn": SignatureCNN,
    "lstm": SignatureLSTM,
    "gru": SignatureGRU,
    "hybrid": SignatureHybrid,
}


def create_model(name: str, *, in_channels: int, embedding_dim: int, **kwargs):
    name = name.lower()
    if name not in MODEL_REGISTRY:
        raise ValueError(f"Unknown model type '{name}'. Available: {list(MODEL_REGISTRY.keys())}")
    return MODEL_REGISTRY[name](in_channels=in_channels, embedding_dim=embedding_dim, **kwargs)


