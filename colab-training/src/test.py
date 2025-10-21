# 🚀 Обучение
LMDB_PATH = r"C:\Users\Mi Air\Desktop\Курсовой\data\dataset\v1.lmdb"
OUTPUT_DIR = "/runs"

FEATURE_PIPELINE = [
    "x", "y", "p", "t",
    "vx", "vy", "ax", "ay", "prate", "path_tangent_angle", "abs_delta_pressure"
]

from config import DatasetConfig, ModelConfig, TrainingConfig
from training import TrainingRunner

# Dataset configuration
ds_cfg = DatasetConfig(
    lmdb_path = LMDB_PATH,
    feature_pipeline = FEATURE_PIPELINE,
    dataset_sample_ratio = 0.1
)

# Model configuration
model_cfg = ModelConfig(

)

# Training configuration
train_cfg = TrainingConfig(
  output_dir = OUTPUT_DIR,
)

print("🚀 Starting Hybrid Model Training\n")

try:
    runner = TrainingRunner(
        dataset_cfg=ds_cfg, model_cfg=model_cfg, train_cfg=train_cfg
    )
    runner.run()

    print("\n" + "=" * 80)
    print("✅ Training completed successfully!")
    print("=" * 80)

except KeyboardInterrupt:
    print("\n⚠️ Training interrupted by user")

except Exception as e:
    print("\n" + "=" * 80)
    print("❌ Training failed with error:")
    print("=" * 80)
    print(f"\n{type(e).__name__}: {e}\n")
    import traceback

    traceback.print_exc()
    exit(1)