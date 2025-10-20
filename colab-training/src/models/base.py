from abc import ABC, abstractmethod
import torch
from torch import nn


class SignatureModelBase(nn.Module, ABC):
    """Base class for signature embedding models."""

    def __init__(self, embedding_dim: int) -> None:
        super().__init__()
        self.embedding_dim = embedding_dim

    @abstractmethod
    def forward(self, x: torch.Tensor) -> torch.Tensor:  # returns embeddings [B, D]
        raise NotImplementedError


