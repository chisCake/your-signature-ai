"""
Center Loss implementation for better intra-class compactness.
Helps create tighter clusters for each user's signatures.
"""
import torch
import torch.nn as nn
from typing import Dict


class CenterLoss(nn.Module):
    """
    Center Loss for better intra-class compactness.
    
    This loss encourages embeddings of the same class to be close to their class center,
    improving the separation between different users' signatures.
    """
    
    def __init__(self, num_classes: int, feat_dim: int, device: torch.device, lambda_c: float = 0.003):
        """
        Args:
            num_classes: Number of users (330 in our case)
            feat_dim: Embedding dimension (256)
            device: Device to place centers on
            lambda_c: Weight for center loss (small value to not dominate triplet loss)
        """
        super().__init__()
        self.num_classes = num_classes
        self.feat_dim = feat_dim
        self.lambda_c = lambda_c
        
        # Initialize class centers as learnable parameters
        # {ДОБАВЛЕНО: learnable centers}/{центры классов должны адаптироваться к данным}/{лучшее разделение пользователей}
        self.centers = nn.Parameter(torch.randn(num_classes, feat_dim).to(device))
        
        # Initialize centers with small random values
        nn.init.normal_(self.centers, mean=0, std=0.1)
    
    def forward(self, embeddings: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        """
        Compute center loss.
        
        Args:
            embeddings: [B, D] - batch of embeddings
            labels: [B] - user IDs as integers (0 to num_classes-1)
            
        Returns:
            Center loss scalar
        """
        batch_size = embeddings.size(0)
        
        # Get centers for current batch
        centers_batch = self.centers[labels]  # [B, D]
        
        # Compute center loss: mean squared distance from embeddings to their centers
        # {ДОБАВЛЕНО: center loss}/{поощрять компактность внутри класса}/{лучшее разделение между пользователями}
        center_loss = torch.nn.functional.mse_loss(embeddings, centers_batch)
        
        return self.lambda_c * center_loss
    
    def update_centers(self, embeddings: torch.Tensor, labels: torch.Tensor, alpha: float = 0.5):
        """
        Update class centers using exponential moving average.
        
        Args:
            embeddings: [B, D] - batch of embeddings
            labels: [B] - user IDs
            alpha: Update rate (0.5 means 50% new, 50% old)
        """
        with torch.no_grad():
            # Compute mean embeddings for each class in this batch
            for label in torch.unique(labels):
                mask = labels == label
                if mask.sum() > 0:
                    class_embeddings = embeddings[mask]
                    class_mean = class_embeddings.mean(dim=0)
                    
                    # Update center using exponential moving average
                    # {ДОБАВЛЕНО: EMA update}/{плавное обновление центров}/{стабильное обучение центров}
                    self.centers[label] = alpha * class_mean + (1 - alpha) * self.centers[label]


def create_user_id_mapping(user_codes: list) -> Dict[str, int]:
    """
    Create mapping from user codes to integer IDs for center loss.
    
    Args:
        user_codes: List of user code strings
        
    Returns:
        Dictionary mapping user_code -> integer_id
    """
    unique_users = sorted(list(set(user_codes)))
    # {ДОБАВЛЕНО: user mapping}/{преобразование строковых ID в числовые}/{совместимость с center loss}
    return {user_code: idx for idx, user_code in enumerate(unique_users)}
