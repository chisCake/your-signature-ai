import torch
from torch import nn

from .base import SignatureModelBase


class SignatureCNN(SignatureModelBase):
    """Simple 1-D CNN -> global pooling -> linear to embedding."""

    def __init__(self, in_channels: int, embedding_dim: int, hidden_channels: int = 64):
        super().__init__(embedding_dim=embedding_dim)
        self.conv = nn.Sequential(
            nn.Conv1d(in_channels, hidden_channels, kernel_size=5, padding=2),
            nn.BatchNorm1d(hidden_channels),
            nn.ReLU(inplace=True),
            nn.Conv1d(hidden_channels, hidden_channels, kernel_size=3, padding=1),
            nn.BatchNorm1d(hidden_channels),
            nn.ReLU(inplace=True),
        )
        self.global_pool = nn.AdaptiveAvgPool1d(1)
        self.fc = nn.Linear(hidden_channels, embedding_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, T, C] -> conv expects [B, C, T]
        x = x.permute(0, 2, 1)
        h = self.conv(x)
        h = self.global_pool(h).squeeze(-1)
        emb = self.fc(h)
        return emb
