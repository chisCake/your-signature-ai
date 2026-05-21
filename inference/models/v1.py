# src/models/hybrid.py
import torch
import torch.nn as nn
import torch.nn.functional as F


class AttentionPool(nn.Module):
    """Temporal attention pooling for variable-length sequences.
       Input: (B, T, D) -> Output: (B, D)"""
    def __init__(self, in_dim):
        super().__init__()
        self.attn = nn.Sequential(
            nn.Linear(in_dim, max(in_dim // 2, 16)),
            nn.Tanh(),
            nn.Linear(max(in_dim // 2, 16), 1)
        )

    def forward(self, x, mask=None):
        # x: (B, T, D)
        scores = self.attn(x).squeeze(-1)  # (B, T)
        if mask is not None:
            # mask: BoolTensor (B, T) True for valid positions
            # Use smaller value for Half precision compatibility
            scores = scores.masked_fill(~mask, -1e4)
        weights = F.softmax(scores, dim=-1)  # (B, T)
        pooled = (x * weights.unsqueeze(-1)).sum(dim=1)  # (B, D)
        return pooled, weights


class SignatureEncoder(nn.Module):
    """CNN(1D) -> BiGRU -> Attention -> FC -> L2-normalized embedding.

    Supports a variable number of CNN layers determined by len(conv_channels).
    Conv layers are registered as self.conv1, self.conv2, ... so that state_dict
    keys match checkpoints produced by the training codebase.
    Each block uses kernel_size=3 with same-padding followed by MaxPool1d(2),
    giving a total temporal downsampling factor of 2^len(conv_channels).
    """
    def __init__(self,
                 in_features: int = 10,
                 conv_channels=(64, 128, 256),
                 gru_hidden: int = 256,
                 gru_layers: int = 3,
                 emb_dim: int = 256,
                 dropout: float = 0.3):
        super().__init__()

        # Build conv blocks as named attributes (conv1, conv2, conv3, ...)
        # so that state_dict keys are conv1.*, conv2.*, conv3.* — matching training checkpoints.
        self._conv_names = []
        in_ch = in_features
        for i, out_ch in enumerate(conv_channels):
            name = f"conv{i + 1}"
            layer = nn.Sequential(
                nn.Conv1d(in_ch, out_ch, kernel_size=3, padding=1),
                nn.BatchNorm1d(out_ch),
                nn.ReLU(inplace=True),
                nn.MaxPool1d(kernel_size=2)
            )
            setattr(self, name, layer)
            self._conv_names.append(name)
            in_ch = out_ch

        # GRU expects input (B, T', C) where C is the last conv channel
        self.bigru = nn.GRU(
            input_size=conv_channels[-1],
            hidden_size=gru_hidden,
            num_layers=gru_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if gru_layers > 1 else 0.0
        )

        self.attn = AttentionPool(gru_hidden * 2)
        self.fc = nn.Sequential(
            nn.Linear(gru_hidden * 2, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(512, emb_dim)
        )

        self.apply(self._init_weights)

    def forward(self, x, mask=None):
        """
        x: (B, T, F)
        mask: (B, T) boolean mask where True denotes valid token
        returns: (B, emb_dim) L2-normalized embeddings
        """
        # Permute for Conv1d: (B, F, T)
        x = x.permute(0, 2, 1)
        for name in self._conv_names:
            x = getattr(self, name)(x)
        # Now x shape (B, C, T')
        x = x.permute(0, 2, 1)  # (B, T', C)

        # Downsample mask by 2^n_layers (one MaxPool2 per conv block)
        if mask is not None:
            m = mask.float().unsqueeze(1)  # (B, 1, T)
            for _ in self._conv_names:
                m = F.max_pool1d(m, kernel_size=2, stride=2)
            mask = m.squeeze(1).bool()  # (B, T')

        self.bigru.flatten_parameters()
        out, _ = self.bigru(x)  # (B, T', 2*gru_hidden)

        pooled, attn_weights = self.attn(out, mask=mask)  # (B, 2*gru_hidden)
        emb = self.fc(pooled)  # (B, emb_dim)

        if torch.isnan(emb).any() or torch.isinf(emb).any():
            raise RuntimeError("NaN/Inf detected in embeddings. This indicates a problem in feature preprocessing.")

        emb = F.normalize(emb, p=2, dim=-1)  # L2 normalize
        return emb

    def _init_weights(self, module):
        """Initialize weights properly to avoid NaN/Inf issues."""
        if isinstance(module, nn.Linear):
            nn.init.xavier_uniform_(module.weight)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Conv1d):
            nn.init.kaiming_normal_(module.weight, mode='fan_out', nonlinearity='relu')
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.GRU):
            for name, param in module.named_parameters():
                if 'weight' in name:
                    nn.init.xavier_uniform_(param)
                elif 'bias' in name:
                    nn.init.zeros_(param)
