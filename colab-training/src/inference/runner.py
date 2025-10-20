from typing import Tuple
import torch
from ..models import DeltaNet, SignatureModelBase
from ..config import ModelConfig


class InferenceRunner:
    def __init__(self, model_cfg: ModelConfig, checkpoint_path: str | None = None) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model: SignatureModelBase = DeltaNet(embedding_dim=model_cfg.embedding_dim)
        self.model.to(self.device).eval()
        if checkpoint_path:
            self.model.load_state_dict(torch.load(checkpoint_path, map_location=self.device))

    @torch.inference_mode()
    def embed(self, image_tensor: torch.Tensor) -> torch.Tensor:
        return self.model(image_tensor.to(self.device).unsqueeze(0)).squeeze(0)

    @torch.inference_mode()
    def similarity(self, a: torch.Tensor, b: torch.Tensor) -> float:
        a = self.embed(a)
        b = self.embed(b)
        sim = torch.nn.functional.cosine_similarity(a, b, dim=0).item()
        return float(sim)


