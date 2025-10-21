from typing import Dict

from .hybrid import SignatureEncoder

MODEL_REGISTRY: Dict[str, type] = {
    "hybrid": SignatureEncoder,
}


def create_model(name: str, *, in_features: int, embedding_dim: int, **kwargs):
    name = name.lower()
    if name not in MODEL_REGISTRY:
        raise ValueError(f"Unknown model type '{name}'. Available: {list(MODEL_REGISTRY.keys())}")
    return MODEL_REGISTRY[name](in_features=in_features, embedding_dim=embedding_dim, **kwargs)


