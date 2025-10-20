import torch
from torch import nn

from .base import SignatureModelBase


class SignatureGRU(SignatureModelBase):
    """Bidirectional GRU embedding model."""

    def __init__(self, in_channels: int, embedding_dim: int, hidden_size: int = 128, num_layers: int = 2):
        super().__init__(embedding_dim)
        self.gru = nn.GRU(
            input_size=in_channels,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
        )
        self.proj = nn.Linear(hidden_size * 2, embedding_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        _, h_n = self.gru(x)
        h_last = h_n[-2:].transpose(0, 1).contiguous().view(x.size(0), -1)
        return self.proj(h_last)
