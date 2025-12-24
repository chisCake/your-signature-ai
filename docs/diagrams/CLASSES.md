# Class диаграммы

## Обзор

Class диаграммы описывают структуру классов и их взаимосвязи в различных компонентах системы.

## Backend: Model Manager и связанные классы

```mermaid
classDiagram
    class ModelManager {
        -Dict[str, ModelInstance] models
        -Optional[str] active_model_name
        -RLock lock
        -str environment
        -Optional[BlobClient] blob_client
        -Dict[str, StorageInfo] storage_registry
        -Path models_dir
        +get_active_model() ModelLoader
        +upload_model(name, pt_content, py_content, strategy) Dict
        +delete_model(name) Dict
        +get_model_info() Dict
        -_hotswap_model(name, strategy, storage_info) Dict
        -_zero_downtime_swap(new, old) Dict
        -_sequential_swap(new, old) Dict
        -_ensure_local_storage(instance) None
        -_sync_blob_registry() None
    }
    
    class ModelInstance {
        -str model_name
        -str model_path
        -str py_file_path
        -Optional[ModelLoader] loader
        -ModelState state
        -Optional[str] error
        -float created_at
        -float last_used
        -StorageInfo storage
        +is_ready() bool
        +is_active() bool
        +can_serve_requests() bool
        +update_last_used() None
    }
    
    class ModelLoader {
        -Optional[torch.nn.Module] model
        -str model_path
        -str py_file_path
        -torch.device device
        -Dict model_info
        +load_model() None
        +encode_signature(tensor) Tensor
        +get_model_info() Dict
        +is_loaded() bool
        +unload_model() None
    }
    
    class BlobClient {
        -str token
        +upload_bytes(pathname, content, content_type) Dict
        +list(prefix, cursor) Dict
        +delete(pathnames) None
        +ensure_local_copy(blob_path, local_path, download_url) Optional[str]
    }
    
    class SwapStrategy {
        <<enumeration>>
        ZERO_DOWNTIME
        SEQUENTIAL
    }
    
    class ModelState {
        <<enumeration>>
        LOADING
        READY
        ACTIVE
        UNLOADING
        ERROR
    }
    
    class StorageInfo {
        +str type
        +str py_blob_path
        +str pt_blob_path
        +str py_download_url
        +str pt_download_url
        +float synced_at
        +int py_size
        +int pt_size
    }
    
    ModelManager "1" *-- "*" ModelInstance : manages
    ModelManager --> BlobClient : uses
    ModelInstance "1" --> "0..1" ModelLoader : contains
    ModelInstance --> ModelState : has
    ModelInstance --> StorageInfo : has
    ModelManager --> SwapStrategy : uses
```

## Backend: Supabase Client и Preprocessing

```mermaid
classDiagram
    class SupabaseClient {
        -Client client
        -str url
        -str service_role_key
        +get_signature_data(id, type) Optional[str]
        +get_user_embeddings(user_id) List[Dict]
        +create_embedding(signature_id, embedding, model_id) Dict
        -_get_table_name(type) str
    }
    
    class PreprocessingModule {
        +preprocess_signature_data(data, model_version) np.ndarray
        +_parse_csv_data(csv_string) np.ndarray
        +_normalize_features(features) np.ndarray
        +_extract_features(points) np.ndarray
    }
    
    class SignatureEncoder {
        <<PyTorch Model>>
        -nn.Module cnn_layers
        -nn.GRU gru
        -nn.Linear attention
        -nn.Linear fc
        +forward(x) Tensor
        +encode(signature) Tensor
    }
    
    SupabaseClient --> PreprocessingModule : provides data
    PreprocessingModule --> SignatureEncoder : prepares data
```

## Frontend: Signature Components

```mermaid
classDiagram
    class Canvas {
        -RefObject canvasRef
        -RefObject containerRef
        -RefObject isDrawingRef
        -RefObject lastPointRef
        -RefObject signatureDataRef
        -RefObject startTimeRef
        -RefObject inputTypeRef
        -State currentInputType
        +clear() void
        +getImageData() string
        +getCanvas() HTMLCanvasElement
        +getSignatureData() SignaturePoint[]
        +getInputType() InputType
        -handleMouseDown(event) void
        -handleMouseMove(event) void
        -handleMouseUp(event) void
        -handleTouchStart(event) void
        -handleTouchMove(event) void
        -handleTouchEnd(event) void
        -detectInputType(event) InputType
    }
    
    class SignatureModal {
        -State signature
        -State isOpen
        -State isLoading
        +open(signature) void
        +close() void
        +save() Promise
        -handleSave() Promise
    }
    
    class SignatureList {
        -State signatures
        -State isLoading
        -State filters
        +loadSignatures() Promise
        +filterSignatures() Signature[]
        +deleteSignature(id) Promise
    }
    
    class SignatureView {
        -Prop signature
        -State comparisonResult
        +compareWithOriginal() Promise
        +saveAsForgery() Promise
    }
    
    class SignaturePoint {
        +number timestamp
        +number x
        +number y
        +number pressure
        +number? tilt
        +number? azimuth
        +Acceleration? acceleration
        +Velocity? velocity
    }
    
    Canvas --> SignaturePoint : generates
    SignatureModal --> Canvas : uses
    SignatureList --> SignatureModal : opens
    SignatureView --> SignatureModal : uses
```

## Frontend: API Clients и Hooks

```mermaid
classDiagram
    class InferenceServerClient {
        -InferenceServerConfig config
        +analyzeForgeryById(originalId, forgeryId) Promise
        +analyzeForgeryByData(originalId, forgeryData) Promise
        +checkHealth() Promise
        +getServerInfo() Promise
    }
    
    class SupabaseClient {
        -Client client
        +getSignatures(userId) Promise
        +getSignature(id) Promise
        +createSignature(data) Promise
        +updateSignature(id, data) Promise
        +deleteSignature(id) Promise
    }
    
    class useInferenceServer {
        -State isLoading
        -State error
        +analyzeForgeryById() Promise
        +analyzeForgeryByData() Promise
        +checkHealth() Promise
    }
    
    class useSignatures {
        -State signatures
        -State isLoading
        -State error
        +loadSignatures() Promise
        +createSignature() Promise
        +deleteSignature() Promise
    }
    
    InferenceServerClient --> useInferenceServer : used by
    SupabaseClient --> useSignatures : used by
```

## Database: TypeScript Types

```mermaid
classDiagram
    class Profile {
        +string id
        +UserRole role
        +string display_name
        +string created_at
        +string updated_at
        +string? email
    }
    
    class SignatureGenuine {
        +string id
        +string? user_id
        +string? pseudouser_id
        +string features_table
        +InputType? input_type
        +boolean user_for_forgery
        +boolean mod_for_forgery
        +boolean mod_for_dataset
        +string? name
        +string created_at
        +string updated_at
    }
    
    class SignatureForged {
        +string id
        +string? original_signature_id
        +string? original_user_id
        +string? original_pseudouser_id
        +string features_table
        +InputType? input_type
        +boolean mod_for_dataset
        +number? score
        +string? model_id
        +string? forger_id
        +string? name
        +string created_at
        +string updated_at
    }
    
    class Embedding {
        +string id
        +string? genuine_signature_id
        +string? forged_signature_id
        +number[] embedding_vector
        +number dimension
        +string model_id
        +string created_at
        +string updated_at
    }
    
    class Model {
        +string id
        +string version
        +string? admin_id
        +Record metadata
        +string? description
        +boolean is_active
        +string file_hash
        +string created_at
        +string updated_at
    }
    
    class UserRole {
        <<enumeration>>
        user
        mod
        admin
    }
    
    class InputType {
        <<enumeration>>
        mouse
        touch
        pen
    }
    
    Profile "1" --> "*" SignatureGenuine : has
    Profile "1" --> "*" SignatureForged : creates
    SignatureGenuine "1" --> "*" SignatureForged : original_of
    SignatureGenuine "1" --> "*" Embedding : has
    SignatureForged "1" --> "*" Embedding : has
    Model "1" --> "*" Embedding : generates
    Profile --> UserRole : has
    SignatureGenuine --> InputType : has
    SignatureForged --> InputType : has
```

## Training: Model Architecture

```mermaid
classDiagram
    class SignatureEncoder {
        <<nn.Module>>
        -nn.ModuleList cnn_layers
        -nn.GRU gru
        -nn.Linear attention
        -nn.Linear fc
        -int embedding_dim
        +forward(x) Tensor
        +encode(signature) Tensor
    }
    
    class ModelConfig {
        +str name
        +int embedding_dim
        +tuple cnn_channels
        +int gru_hidden
        +int gru_layers
        +float dropout
    }
    
    class DatasetConfig {
        +str lmdb_path
        +int num_workers
        +int batch_size
        +bool augment
        +AugmentationConfig augmentation
        +int max_sequence_length
        +List[str] feature_pipeline
    }
    
    class TrainingConfig {
        +int epochs
        +float learning_rate
        +float weight_decay
        +bool mixed_precision
        +int seed
        +str loss_type
        +float triplet_margin
        +str miner_type
        +int pk_p
        +int pk_k
    }
    
    class ExperimentConfig {
        +DatasetConfig dataset
        +ModelConfig model
        +TrainingConfig training
    }
    
    SignatureEncoder --> ModelConfig : uses
    ExperimentConfig --> DatasetConfig : contains
    ExperimentConfig --> ModelConfig : contains
    ExperimentConfig --> TrainingConfig : contains
```

## Training: Data Loading

```mermaid
classDiagram
    class LMDBDataset {
        -str lmdb_path
        -Dict mapping
        -bool augment
        -AugmentationConfig aug_config
        +__len__() int
        +__getitem__(idx) Tuple[Tensor, Tensor, str]
        -_load_signature(key) np.ndarray
        -_augment(signature) np.ndarray
    }
    
    class DataLoader {
        -Dataset dataset
        -int batch_size
        -int num_workers
        -bool shuffle
        +__iter__() Iterator
    }
    
    class PKSampler {
        -Dict user_to_indices
        -int p
        -int k
        -bool use_all_data
        +__iter__() Iterator
        -_generate_batches() List[List[int]]
    }
    
    class AugmentationConfig {
        +float time_warp_prob
        +float time_warp_sigma
        +float noise_prob
        +float noise_sigma
        +float rotation_prob
        +float rotation_range
        +float scale_prob
        +List[float] scale_range
        +float dropout_prob
        +float dropout_rate
    }
    
    LMDBDataset --> AugmentationConfig : uses
    DataLoader --> LMDBDataset : loads from
    DataLoader --> PKSampler : uses
```

## Training: Loss Functions

```mermaid
classDiagram
    class TripletLoss {
        -float margin
        -str mining_type
        +forward(embeddings, labels) Tensor
        -_batch_all_triplets(embeddings, labels) Tensor
        -_hard_triplets(embeddings, labels) Tensor
        -_semi_hard_triplets(embeddings, labels) Tensor
    }
    
    class ContrastiveLoss {
        -float margin
        +forward(embeddings, labels) Tensor
    }
    
    class AdaptiveMiner {
        -int stagnation_threshold
        -int min_epochs_per_phase
        -str current_phase
        +select_triplets(embeddings, labels) Tuple
        +update_phase(metrics) None
    }
    
    TripletLoss --> AdaptiveMiner : uses
```

## FastAPI: Routes и Dependencies

```mermaid
classDiagram
    class FastAPIApp {
        -List[APIRouter] routers
        -CORSMiddleware cors
        +include_router(router) None
    }
    
    class ForgeryByIdRouter {
        +POST /forgery-by-id/ analyze_forgery_by_id()
    }
    
    class ForgeryByDataRouter {
        +POST /forgery-by-data/ analyze_forgery_by_data()
    }
    
    class HealthRouter {
        +GET /health check_health()
    }
    
    class ModelRouter {
        +GET /model/info get_model_info()
        +POST /model/activate activate_model()
    }
    
    class ModelUploadRouter {
        +POST /model/upload upload_model()
        +DELETE /model/delete delete_model()
    }
    
    class Dependencies {
        +get_supabase_client() SupabaseClient
        +get_model_loader() ModelLoader
        +get_model_manager() ModelManager
    }
    
    FastAPIApp --> ForgeryByIdRouter : includes
    FastAPIApp --> ForgeryByDataRouter : includes
    FastAPIApp --> HealthRouter : includes
    FastAPIApp --> ModelRouter : includes
    FastAPIApp --> ModelUploadRouter : includes
    ForgeryByIdRouter --> Dependencies : uses
    ForgeryByDataRouter --> Dependencies : uses
    ModelRouter --> Dependencies : uses
    ModelUploadRouter --> Dependencies : uses
```

## Взаимосвязи между компонентами

### Backend → Frontend
- `InferenceServerClient` взаимодействует с FastAPI endpoints
- `SupabaseClient` взаимодействует с Supabase через REST API

### Backend → Database
- `SupabaseClient` выполняет SQL запросы через Supabase Python client
- RLS политики применяются автоматически на уровне БД

### Training → Database
- Training notebook загружает данные через Supabase client
- Создает LMDB датасет для эффективной загрузки

### Model Management
- `ModelManager` управляет жизненным циклом моделей
- `ModelLoader` загружает и выполняет inference
- `BlobClient` синхронизирует модели между storage и сервером

