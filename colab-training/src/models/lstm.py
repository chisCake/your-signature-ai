import torch
from torch import nn

from .base import SignatureModelBase


class SignatureLSTM(SignatureModelBase):
    """Bidirectional LSTM over sequence, take last hidden state."""

    def __init__(self, in_channels: int, embedding_dim: int, hidden_size: int = 128, num_layers: int = 2):
        super().__init__(embedding_dim)
        self.lstm = nn.LSTM(
            input_size=in_channels,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
        )
        self.proj = nn.Linear(hidden_size * 2, embedding_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, T, C]
        _, (h_n, _) = self.lstm(x)
        # h_n: [num_layers*2, B, H], take last layer
        h_last = h_n[-2:].transpose(0, 1).contiguous().view(x.size(0), -1)
        emb = self.proj(h_last)
        return emb
