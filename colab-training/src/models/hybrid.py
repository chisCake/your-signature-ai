# import torch
# from torch import nn

# from .base import SignatureModelBase


# # -----------------------------------------------------------------------------
# # Multi-Head Self-Attention wrapper (uses PyTorch nn.MultiheadAttention)
# # -----------------------------------------------------------------------------


# class MHAttention(nn.Module):
#     """Batched Multi-Head Self-Attention for sequence [B, T, H]."""

#     def __init__(self, hidden_dim: int, num_heads: int = 4, attn_dropout: float = 0.1):
#         super().__init__()
#         self.mha = nn.MultiheadAttention(
#             embed_dim=hidden_dim,
#             num_heads=num_heads,
#             batch_first=True,
#             dropout=attn_dropout,
#         )
#         self.ln = nn.LayerNorm(hidden_dim)

#     def forward(self, x: torch.Tensor) -> torch.Tensor:  # [B, T, H]
#         attn_out, _ = self.mha(x, x, x, need_weights=False)
#         return self.ln(x + attn_out)


# class SignatureHybrid(SignatureModelBase):
#     """CNN feature extractor -> BiLSTM -> Self-Attention -> pooling -> embedding."""

#     def __init__(
#         self,
#         in_channels: int,
#         embedding_dim: int,
#         cnn_channels: int = 64,
#         lstm_hidden: int = 128,
#         lstm_layers: int = 1,
#         attn_heads: int = 4,
#         dropout: float = 0.1,
#     ):
#         super().__init__(embedding_dim)
#         self.conv1 = nn.Conv1d(in_channels, cnn_channels, kernel_size=5, padding=2)
#         self.conv2 = nn.Conv1d(cnn_channels, cnn_channels, kernel_size=3, padding=1)
#         self.act = nn.ReLU(inplace=True)
#         self.lstm = nn.LSTM(
#             input_size=cnn_channels,
#             hidden_size=lstm_hidden,
#             num_layers=lstm_layers,
#             batch_first=True,
#             bidirectional=True,
#             dropout=dropout if lstm_layers > 1 else 0.0,
#         )
#         self.attn = MHAttention(lstm_hidden * 2, num_heads=attn_heads, attn_dropout=dropout)

#         stat_pool_dim = lstm_hidden * 2 * 2  # mean + std
#         self.proj = nn.Sequential(
#             nn.Linear(stat_pool_dim, embedding_dim),
#             nn.LayerNorm(embedding_dim),
#         )

#     def forward(self, x: torch.Tensor) -> torch.Tensor:
#         # x: [B, T, C] -> CNN expects [B, C, T]
#         y = self.act(self.conv1(x.permute(0, 2, 1)))
#         y = self.act(self.conv2(y))
        
#         # Only apply residual if input channels match CNN output channels
#         if x.size(-1) == self.conv1.out_channels:
#             h = (y + x.permute(0, 2, 1))  # residual
#         else:
#             h = y  # no residual if channel mismatch
            
#         h = h.permute(0, 2, 1)  # [B, T, C]
#         h, _ = self.lstm(h)
#         h = self.attn(h)

#         # Stat pooling
#         mean = h.mean(dim=1)
#         std = h.std(dim=1)
#         pooled = torch.cat([mean, std], dim=-1)

#         emb = self.proj(pooled)
#         return emb

from typing import Optional
import torch
from torch import nn

from .base import SignatureModelBase


# -----------------------------------------------------------------------------
# Squeeze-and-Excitation Block for better feature attention
# -----------------------------------------------------------------------------

class SEBlock(nn.Module):
    """Squeeze-and-Excitation block for channel attention."""
    
    def __init__(self, channels: int, reduction: int = 16):
        super().__init__()
        self.fc = nn.Sequential(
            nn.Linear(channels, channels // reduction),
            nn.ReLU(inplace=True),
            nn.Linear(channels // reduction, channels),
            nn.Sigmoid()
        )
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, T, C]
        b, t, c = x.shape
        # Global average pooling across time dimension with stability
        y = x.mean(dim=1)  # [B, C]
        y = torch.nan_to_num(y, nan=0.0, posinf=1.0, neginf=-1.0)  # Stabilize
        y = self.fc(y)  # [B, C]
        y = torch.nan_to_num(y, nan=0.0, posinf=1.0, neginf=-1.0)  # Stabilize
        return x * y.unsqueeze(1)  # [B, T, C]


# -----------------------------------------------------------------------------
# Multi-Head Self-Attention wrapper (uses PyTorch nn.MultiheadAttention)
# -----------------------------------------------------------------------------


class MHAttention(nn.Module):
    """Batched Multi-Head Self-Attention for sequence [B, T, H]."""

    def __init__(self, hidden_dim: int, num_heads: int = 4, attn_dropout: float = 0.1):
        super().__init__()
        self.mha = nn.MultiheadAttention(
            embed_dim=hidden_dim,
            num_heads=num_heads,
            batch_first=True,
            dropout=attn_dropout,
        )
        self.ln = nn.LayerNorm(hidden_dim)

    def forward(self, x: torch.Tensor, key_padding_mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        """
        Forward pass for Multi-Head Attention.
        Args:
            x: Input tensor [B, T, H]
            key_padding_mask: Boolean mask [B, T] where True indicates a padded value.
        """
        attn_out, _ = self.mha(x, x, x, key_padding_mask=key_padding_mask, need_weights=False)
        return self.ln(x + attn_out)


class SignatureHybrid(SignatureModelBase):
    """CNN feature extractor -> BiLSTM -> Self-Attention -> pooling -> embedding."""

    def __init__(
        self,
        in_channels: int,
        embedding_dim: int,
        cnn_channels: int = 64,
        lstm_hidden: int = 128,
        lstm_layers: int = 1,
        attn_heads: int = 4,
        dropout: float = 0.1,
        attn_downsample: int = 8,
    ):
        super().__init__(embedding_dim)
        self.conv1 = nn.Conv1d(in_channels, cnn_channels, kernel_size=5, padding=2)
        self.conv2 = nn.Conv1d(cnn_channels, cnn_channels, kernel_size=3, padding=1)
        self.act = nn.ReLU(inplace=True)
        self.lstm = nn.LSTM(
            input_size=cnn_channels,
            hidden_size=lstm_hidden,
            num_layers=lstm_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if lstm_layers > 1 else 0.0,
        )
        self.attn = MHAttention(lstm_hidden * 2, num_heads=attn_heads, attn_dropout=dropout)
        self.attn_downsample = max(1, int(attn_downsample))
        
        # {ДОБАВЛЕНО: SE Block}/{улучшить внимание к важным признакам}/{более эффективное использование информации из эмбеддингов}
        self.se_block = SEBlock(lstm_hidden * 2, reduction=16)
        
        # {ДОБАВЛЕНО: дополнительный dropout}/{предотвращение переобучения на низкоуровневых признаках}/{лучшая регуляризация после CNN слоев}
        self.dropout_cnn = nn.Dropout(dropout * 0.5)

        stat_pool_dim = lstm_hidden * 2 * 2  # mean + std
        self.proj = nn.Sequential(
            nn.Linear(stat_pool_dim, embedding_dim),
            nn.LayerNorm(embedding_dim),
        )

    def forward(self, x: torch.Tensor, mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        # x: [B, T, C], mask: [B, T]
        
        # --- CNN Feature Extraction ---
        y = self.act(self.conv1(x.permute(0, 2, 1)))
        y = self.act(self.conv2(y))
        
        if x.size(-1) == self.conv1.out_channels:
            h = y + x.permute(0, 2, 1)  # residual
        else:
            h = y  # no residual
            
        h = h.permute(0, 2, 1)  # [B, T, C]
        
        # Apply additional dropout for regularization
        h = self.dropout_cnn(h)
        # {ДОБАВЛЕНО: стабилизация}/{предотвращение NaN после dropout}/{стабильное обучение без коллапса градиентов}
        h = torch.nan_to_num(h, nan=0.0, posinf=1.0, neginf=-1.0)

        # --- LSTM with Packed Sequence ---
        if mask is not None:
            # Calculate sequence lengths from mask
            lengths = mask.sum(dim=1).cpu()
            h = torch.nn.utils.rnn.pack_padded_sequence(
                h, lengths, batch_first=True, enforce_sorted=False
            )
        
        h, _ = self.lstm(h)

        if mask is not None:
            h, _ = torch.nn.utils.rnn.pad_packed_sequence(h, batch_first=True)
            # Align mask to the actual sequence length after packing/padding
            T_actual = h.size(1)
            if mask.size(1) != T_actual:
                mask = mask[:, :T_actual]

        # --- Temporal downsampling before attention to reduce memory ---
        if self.attn_downsample > 1:
            h = h[:, ::self.attn_downsample, :]
            if mask is not None:
                mask = mask[:, ::self.attn_downsample]

        # --- Attention with Masking ---
        # MHA expects key_padding_mask where True means pad
        key_padding_mask = ~mask if mask is not None else None
        h = self.attn(h, key_padding_mask=key_padding_mask)
        
        # Apply SE block for better feature attention
        h = self.se_block(h)
        # {ДОБАВЛЕНО: стабилизация}/{предотвращение NaN после SE Block}/{стабильная работа attention механизма}
        h = torch.nan_to_num(h, nan=0.0, posinf=1.0, neginf=-1.0)

        # --- Masked Statistical Pooling ---
        if mask is not None:
            # Expand mask to match tensor dimensions for element-wise multiplication
            # mask: [B, T] -> [B, T, 1]
            mask_expanded = mask.unsqueeze(-1).float()
            
            # Mask the tensor by setting padded values to 0
            h_masked = h * mask_expanded
            
            # Compute mean and std only over non-padded elements
            seq_lengths = mask.sum(dim=1, keepdim=True)
            seq_lengths = torch.clamp(seq_lengths, min=1) # Avoid division by zero
            
            mean = h_masked.sum(dim=1) / seq_lengths
            
            # Variance = E[X^2] - (E[X])^2
            mean_of_squares = (h_masked**2).sum(dim=1) / seq_lengths
            var = mean_of_squares - mean**2
            # Clamp variance to be non-negative for stability
            std = torch.sqrt(torch.clamp(var, min=1e-6))
        else:
            # Original unmasked pooling
            mean = h.mean(dim=1)
            std = h.std(dim=1)

        pooled = torch.cat([mean, std], dim=-1)

        emb = self.proj(pooled)
        return emb
