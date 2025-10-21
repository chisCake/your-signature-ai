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
    """CNN(1D) -> BiGRU -> Attention -> FC -> L2-normalized embedding"""
    def __init__(self,
                 in_features: int = 10,
                 conv_channels=(64, 128),
                 gru_hidden: int = 256,
                 gru_layers: int = 2,
                 emb_dim: int = 128,
                 dropout: float = 0.3):
        super().__init__()
        # conv stack: input shape (B, F, T)
        self.conv1 = nn.Sequential(
            nn.Conv1d(in_features, conv_channels[0], kernel_size=5, padding=2),
            nn.BatchNorm1d(conv_channels[0]),
            nn.ReLU(inplace=True),
            nn.MaxPool1d(kernel_size=2)
        )
        self.conv2 = nn.Sequential(
            nn.Conv1d(conv_channels[0], conv_channels[1], kernel_size=5, padding=2),
            nn.BatchNorm1d(conv_channels[1]),
            nn.ReLU(inplace=True),
            nn.MaxPool1d(kernel_size=2)
        )

        # GRU expects input (B, T', C)
        self.bigru = nn.GRU(
            input_size=conv_channels[1],
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
        
        # Initialize weights properly
        self.apply(self._init_weights)

    def forward(self, x, mask=None):
        """
        x: (B, T, F)
        mask: (B, T) boolean mask where True denotes valid token
        returns: (B, emb_dim) L2-normalized embeddings
        """
        # Permute for Conv1d: (B, F, T)
        x = x.permute(0, 2, 1)
        x = self.conv1(x)
        x = self.conv2(x)
        # Now x shape (B, C, T')
        x = x.permute(0, 2, 1)  # (B, T', C)

        # If mask provided, we need to downsample mask similarly (pooling by 4)
        if mask is not None:
            # reduce mask by factor 4 due to two MaxPool(2)
            mask = mask.float().unsqueeze(1)  # (B,1,T)
            mask = F.max_pool1d(mask, kernel_size=2, stride=2)
            mask = F.max_pool1d(mask, kernel_size=2, stride=2)
            mask = mask.squeeze(1).bool()  # (B, T')

        # RNN
        # flatten_parameters for speed/compatibility
        self.bigru.flatten_parameters()
        out, _ = self.bigru(x)  # (B, T', 2*gru_hidden)

        pooled, attn_weights = self.attn(out, mask=mask)  # (B, 2*gru_hidden)
        emb = self.fc(pooled)  # (B, emb_dim)
        
        # Check for NaN/Inf - should not happen with proper feature preprocessing
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