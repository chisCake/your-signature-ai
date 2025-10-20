from typing import Dict, Tuple, List, Any
import os
import json
import lmdb
import csv
import numpy as np
from tqdm import tqdm
import logging

from utils.supabase_io import create_client_with_login, fetch_all

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def _ensure_dir(path: str) -> None:
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)


def _normalize_coordinates(csv_text: str) -> str:
    """
    Normalize x,y,p coordinates to [0,1] range while preserving aspect ratio for x,y.
    
    Args:
        csv_text: CSV text with header "t,x,y,p,..." and data rows
        
    Returns:
        Normalized CSV text with x,y,p in [0,1]
    """
    if not csv_text.strip():
        return csv_text
    
    lines = csv_text.strip().split('\n')
    if len(lines) < 2:
        return csv_text
    
    # Parse CSV
    reader = csv.reader(lines)
    rows = list(reader)
    
    if len(rows) < 2:
        return csv_text
    
    header = rows[0]
    data_rows = rows[1:]
    
    # Find x,y,p column indices
    try:
        x_idx = header.index('x')
        y_idx = header.index('y')
        p_idx = header.index('p')
    except ValueError:
        return csv_text  # No x,y,p columns found
    
    # Extract x,y,p coordinates
    x_coords = []
    y_coords = []
    p_coords = []
    valid_rows = []
    
    for row in data_rows:
        if len(row) > max(x_idx, y_idx, p_idx):
            try:
                x = float(row[x_idx])
                y = float(row[y_idx])
                p = float(row[p_idx])
                x_coords.append(x)
                y_coords.append(y)
                p_coords.append(p)
                valid_rows.append(row)
            except (ValueError, IndexError):
                continue
    
    if not x_coords:
        return csv_text
    
    # Calculate normalization parameters
    x_min, x_max = min(x_coords), max(x_coords)
    y_min, y_max = min(y_coords), max(y_coords)
    p_min, p_max = min(p_coords), max(p_coords)
    
    # Calculate ranges for x,y (preserve aspect ratio)
    x_range = x_max - x_min
    y_range = y_max - y_min
    
    # Use the larger range to preserve aspect ratio
    max_range = max(x_range, y_range)
    
    if max_range == 0:
        max_range = 1.0  # Avoid division by zero
    
    # Calculate range for p (independent normalization)
    p_range = p_max - p_min
    if p_range == 0:
        p_range = 1.0  # Avoid division by zero
    
    # Normalize coordinates
    normalized_rows = []
    for row in valid_rows:
        normalized_row = row.copy()
        try:
            x = float(row[x_idx])
            y = float(row[y_idx])
            p = float(row[p_idx])
            
            # Normalize x,y to [0,1] preserving aspect ratio
            normalized_x = (x - x_min) / max_range
            normalized_y = (y - y_min) / max_range
            
            # Normalize p to [0,1] independently
            normalized_p = (p - p_min) / p_range
            
            normalized_row[x_idx] = str(normalized_x)
            normalized_row[y_idx] = str(normalized_y)
            normalized_row[p_idx] = str(normalized_p)
        except (ValueError, IndexError):
            pass
        
        normalized_rows.append(normalized_row)
    
    # Reconstruct CSV
    result_lines = [','.join(header)]
    result_lines.extend(','.join(row) for row in normalized_rows)
    
    return '\n'.join(result_lines)


def _process_signature_batch(
    rows: List[Dict[str, Any]],
    txn: lmdb.Transaction,
    sample_idx: int,
    label: str,
    get_or_create_user_code,
    keys: List[str],
    desc: str,
) -> int:
    """
    Process a batch of signature rows and write them to LMDB.
    
    Args:
        rows: List of signature rows from database
        txn: LMDB transaction
        sample_idx: Starting sample index
        label: "genuine" or "forged"
        get_or_create_user_code: Function to get/create user codes
        keys: List to append sample keys to
        desc: Description for progress bar
        
    Returns:
        Updated sample_idx
    """
    def put_str(key: str, val: str) -> None:
        txn.put(key.encode("utf-8"), val.encode("utf-8"))
    
    for row in tqdm(rows, desc=desc):
        sample_idx += 1
        key = f"sample-{sample_idx:08d}"
        
        # Determine owner based on label type
        if label == "genuine":
            owner_table = "profiles" if row.get("user_id") else "pseudousers"
            owner_id = row.get("user_id") or row.get("pseudouser_id")
            source_table = "genuine_signatures"
        else:  # forged
            owner_table = "profiles" if row.get("original_user_id") else "pseudousers"
            owner_id = row.get("original_user_id") or row.get("original_pseudouser_id")
            source_table = "forged_signatures"
        
        user_code = get_or_create_user_code(owner_table, owner_id)
        
        # Store normalized features_table text
        features_text = row.get("features_table") or ""
        normalized_features = _normalize_coordinates(features_text)
        put_str(key, normalized_features)
        put_str(f"{key}:label", label)
        put_str(f"{key}:user_code", user_code)
        put_str(f"{key}:owner_table", owner_table)
        put_str(f"{key}:owner_id", owner_id)
        put_str(f"{key}:source_table", source_table)
        put_str(f"{key}:source_id", row["id"])
        put_str(f"{key}:input_type", row.get("input_type", ""))
        keys.append(key)
    
    return sample_idx


def build_lmdb_from_supabase(
    supabase_url: str,
    anon_key: str,
    email: str,
    password: str,
    output_lmdb_path: str,
    output_map_json_path: str,
    input_type: str = "any",
) -> None:
    """
    Fetch rows from genuine_signatures and forged_signatures where mod_for_dataset = true,
    anonymize users/pseudousers, and write LMDB with numeric keys and map.json with user code map.

    Args:
        input_type: Filter by input type - "any", "mouse", "touch", or "pen"

    LMDB keys:
      - "sample-00000001" (numeric, incremental)
      - metadata per sample:
          "sample-XXXXXX:label" -> "genuine" | "forged"
          "sample-XXXXXX:user_code" -> e.g. "u0001" (owner/original profile/pseudouser)
          "sample-XXXXXX:owner_table" -> "profiles" | "pseudousers"
          "sample-XXXXXX:owner_id" -> UUID
          "sample-XXXXXX:source_table" -> "genuine_signatures" | "forged_signatures"
          "sample-XXXXXX:source_id" -> UUID
          "sample-XXXXXX:input_type" -> "mouse" | "touch" | "pen"
    map.json:
      { "u0001": {"table": "profiles", "id": "<uuid>" }, ... }
    """
    
    logger.info("Starting dataset build process")
    logger.info(f"Input type filter: {input_type}")
    
    # Create Supabase client with error handling
    try:
        logger.info("Connecting to Supabase...")
        client = create_client_with_login(supabase_url, anon_key, email, password)
        logger.info("✓ Successfully connected to Supabase")
    except Exception as e:
        logger.error(f"✗ Failed to connect to Supabase: {e}")
        raise RuntimeError(f"Supabase connection failed: {e}") from e

    # Build anonymized user map from both profiles/pseudousers appearing in selected rows
    user_code_map: Dict[str, Dict[str, str]] = {}
    user_index = 0

    def get_or_create_user_code(table: str, uid: str) -> str:
        nonlocal user_index
        key = f"{table}:{uid}"
        if key in user_code_map:
            return user_code_map[key]["code"]  # type: ignore
        user_index += 1
        code = f"u{user_index:04d}"
        user_code_map[key] = {"table": table, "id": uid, "code": code}
        return code

    # Build filters based on input_type
    base_filters = [["mod_for_dataset", "eq", True]]
    if input_type != "any":
        base_filters.append(["input_type", "eq", input_type])

    # Query genuine signatures with error handling
    try:
        logger.info("Fetching genuine signatures from database...")
        genuine_rows = list(
            fetch_all(
                client,
                table="genuine_signatures",
                select="id,user_id,pseudouser_id,features_table,input_type,mod_for_dataset,created_at",
                filters=base_filters,
            )
        )
        logger.info(f"✓ Successfully fetched {len(genuine_rows)} genuine signatures")
    except Exception as e:
        logger.error(f"✗ Failed to fetch genuine signatures: {e}")
        raise RuntimeError(f"Failed to fetch genuine signatures from database: {e}") from e
    
    # Query forged signatures with error handling
    try:
        logger.info("Fetching forged signatures from database...")
        forged_rows = list(
            fetch_all(
                client,
                table="forged_signatures",
                select=(
                    "id,original_signature_id,original_user_id,original_pseudouser_id,features_table,input_type,mod_for_dataset,created_at"
                ),
                filters=base_filters,
            )
        )
        logger.info(f"✓ Successfully fetched {len(forged_rows)} forged signatures")
    except Exception as e:
        logger.error(f"✗ Failed to fetch forged signatures: {e}")
        raise RuntimeError(f"Failed to fetch forged signatures from database: {e}") from e
    
    # Log dataset statistics
    total_samples = len(genuine_rows) + len(forged_rows)
    logger.info(f"Total samples to process: {total_samples}")
    logger.info(f"  - Genuine: {len(genuine_rows)} ({len(genuine_rows)/total_samples*100:.1f}%)")
    logger.info(f"  - Forged: {len(forged_rows)} ({len(forged_rows)/total_samples*100:.1f}%)")

    # Prepare LMDB writers
    logger.info("Preparing LMDB database...")
    _ensure_dir(output_lmdb_path)
    _ensure_dir(output_map_json_path)
    
    try:
        env = lmdb.open(output_lmdb_path, map_size=8 * 1024 * 1024 * 1024)  # 8GB default
        logger.info(f"✓ LMDB database opened at: {output_lmdb_path}")
    except Exception as e:
        logger.error(f"✗ Failed to open LMDB database: {e}")
        raise RuntimeError(f"Failed to create LMDB database: {e}") from e

    keys: List[str] = []
    sample_idx = 0

    try:
        with env.begin(write=True) as txn:
            logger.info("Writing genuine signatures to LMDB...")
            sample_idx = _process_signature_batch(
                genuine_rows, txn, sample_idx, "genuine", 
                get_or_create_user_code, keys, "genuine"
            )
            logger.info(f"✓ Processed {len(genuine_rows)} genuine signatures")
            
            logger.info("Writing forged signatures to LMDB...")
            sample_idx = _process_signature_batch(
                forged_rows, txn, sample_idx, "forged",
                get_or_create_user_code, keys, "forged"
            )
            logger.info(f"✓ Processed {len(forged_rows)} forged signatures")
            
            # Write index
            logger.info("Writing LMDB index...")
            index_blob = "\n".join(keys).encode("utf-8")
            txn.put(b"__index__", index_blob)
            logger.info(f"✓ Index written with {len(keys)} samples")
        
        env.sync()
        env.close()
        logger.info("✓ LMDB database closed successfully")
        
    except Exception as e:
        logger.error(f"✗ Error during LMDB write operation: {e}")
        env.close()
        raise RuntimeError(f"Failed to write data to LMDB: {e}") from e

    # Write map.json { u0001: { table, id } }
    try:
        logger.info("Writing user code mapping to JSON...")
        code_to_info = {v["code"]: {"table": v["table"], "id": v["id"]} for v in user_code_map.values()}
        with open(output_map_json_path, "w", encoding="utf-8") as f:
            json.dump(code_to_info, f, ensure_ascii=False, indent=2)
        logger.info(f"✓ User code mapping saved to: {output_map_json_path}")
        logger.info(f"✓ Total unique users: {len(code_to_info)}")
    except Exception as e:
        logger.error(f"✗ Failed to write user code mapping: {e}")
        raise RuntimeError(f"Failed to save user code mapping: {e}") from e
    
    logger.info("=" * 60)
    logger.info("Dataset build completed successfully!")
    logger.info(f"Total samples: {len(keys)}")
    logger.info(f"Total users: {len(code_to_info)}")
    logger.info(f"LMDB path: {output_lmdb_path}")
    logger.info(f"Map JSON path: {output_map_json_path}")
    logger.info("=" * 60)


