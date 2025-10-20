"""
Data analysis module for signature verification dataset.
Provides functions to analyze both Supabase database and LMDB dataset.
"""

from typing import Dict, List, Tuple, Optional
import os
import lmdb
import csv
import numpy as np
import pandas as pd
from collections import defaultdict, Counter
from statistics import mode
from supabase import create_client, Client

import io
from enum import Enum


class DataSource(str, Enum):
    SUPABASE = "supabase"
    LMDB = "lmdb"


def analyze_data(source: DataSource, **kwargs):
    """Analyze signature data from Supabase or LMDB with unified metric logic.

    Parameters differ by source:
      • SUPABASE expects: supabase_url, anon_key, email, password
      • LMDB expects: lmdb_path
    """

    # ------------------------------------------------------------------
    # 1. FETCH RAW ROWS DEPENDING ON SOURCE
    # Each row is dict: {"id_or_key", "label", "input_type", "csv"}
    # ------------------------------------------------------------------

    rows: List[Dict[str, any]] = []

    if source == DataSource.SUPABASE:
        from utils.supabase_io import create_client_with_login, fetch_all

        client = create_client_with_login(
            kwargs["supabase_url"], kwargs["anon_key"], kwargs["email"], kwargs["password"]
        )

        for table, label in [("genuine_signatures", "genuine"), ("forged_signatures", "forged")]:
            table_rows = fetch_all(
                client,
                table=table,
                select="id,input_type,features_table",
                filters=[["mod_for_dataset", "eq", True]],
            )
            for r in table_rows:
                rows.append({
                    "id": r["id"],
                    "label": label,
                    "input_type": r["input_type"],
                    "csv": r["features_table"],
                })

    elif source == DataSource.LMDB:
        lmdb_path = kwargs["lmdb_path"]
        lmdb_env = lmdb.open(lmdb_path, readonly=True, lock=False, readahead=True, max_readers=2048)
        with lmdb_env.begin() as txn:
            index_bytes = txn.get(b"__index__")
            if index_bytes is None:
                raise RuntimeError(f"LMDB index not found at {lmdb_path}")
            for key in index_bytes.decode("utf-8").splitlines():
                csv_bytes = txn.get(key.encode("utf-8"))
                if csv_bytes is None:
                    continue
                label_bytes = txn.get(f"{key}:label".encode("utf-8"))
                input_type_bytes = txn.get(f"{key}:input_type".encode("utf-8"))
                if label_bytes is None or input_type_bytes is None:
                    continue
                rows.append({
                    "id": key,
                    "label": label_bytes.decode("utf-8"),
                    "input_type": input_type_bytes.decode("utf-8"),
                    "csv": csv_bytes.decode("utf-8"),
                })
        lmdb_env.close()
    else:
        raise ValueError(f"Unsupported data source: {source}")

    # ------------------------------------------------------------------
    # 2. UNIFIED METRIC COMPUTATION
    # ------------------------------------------------------------------

    seq_lengths = []
    feature_mins = {c: np.inf for c in ["x", "y", "t", "p"]}
    feature_maxs = {c: -np.inf for c in ["x", "y", "t", "p"]}
    all_t_values: List[float] = []

    tag_stats: Dict[Tuple[str, str], List[int]] = defaultdict(list)  # (label,input_type)->seq lens

    for r in rows:
        csv_str = r["csv"]
        seq_len = csv_str.count("\n")
        seq_lengths.append((seq_len, r))
        tag_stats[(r["label"], r["input_type"])].append(seq_len)

        # Parse CSV for feature ranges
        try:
            table_df = pd.read_csv(io.StringIO(csv_str))
        except Exception:
            continue

        for col in feature_mins.keys():
            if col not in table_df.columns:
                continue
            col_vals = table_df[col].values
            feature_mins[col] = min(feature_mins[col], np.min(col_vals))
            feature_maxs[col] = max(feature_maxs[col], np.max(col_vals))
            if col == "t":
                all_t_values.extend(col_vals.tolist())

    # Build metrics dataframe
    metrics = {}
    for (label, itype), seqs in tag_stats.items():
        seqs_arr = np.array(seqs)
        seq_mode = Counter(seqs).most_common(1)[0][0] if seqs else None
        metrics[(label, itype)] = {
            "count": len(seqs),
            "mean_seq_len": seqs_arr.mean(),
            "median_seq_len": np.median(seqs_arr),
            "mode_seq_len": seq_mode,
            "std_seq_len": seqs_arr.std(),
            "min_seq_len": seqs_arr.min(),
            "max_seq_len": seqs_arr.max(),
        }

    metrics_df = pd.DataFrame.from_dict(metrics, orient="index")

    # shortest & longest
    min_info = min(seq_lengths, key=lambda x: x[0])[1]
    max_info = max(seq_lengths, key=lambda x: x[0])[1]

    overall_lengths = [l for l, _ in seq_lengths]

    return {
        "metrics_df": metrics_df,
        "total_samples": len(seq_lengths),
        "shortest_signature": {
            "id": min_info["id"],
            "length": min(seq_lengths)[0],
            "label": min_info["label"],
            "input_type": min_info["input_type"],
        },
        "longest_signature": {
            "id": max_info["id"],
            "length": max(seq_lengths)[0],
            "label": max_info["label"],
            "input_type": max_info["input_type"],
        },
        "overall_stats": {
            "mean_seq_len": np.mean(overall_lengths),
            "median_seq_len": np.median(overall_lengths),
            "std_seq_len": np.std(overall_lengths),
        },
        "feature_ranges": {col: (feature_mins[col], feature_maxs[col]) for col in feature_mins},
        "median_t": float(np.median(all_t_values)) if all_t_values else None,
    }


def print_supabase_report(supabase_results: Dict) -> None:
    """
    Print formatted analysis report for Supabase data.
    
    Args:
        supabase_results: Results from analyze_supabase_data
    """
    print("=" * 60)
    print("📊 ОТЧЕТ ПО ДАННЫМ SUPABASE")
    print("=" * 60)
    
    print("\nМетрики по категориям (label, input_type):")
    print("-" * 50)
    print(supabase_results["metrics_df"])
    
    print(f"\nВсего образцов в БД: {supabase_results['total_samples']}")
    print(f"Самая короткая подпись: {supabase_results['shortest_signature']['id']} "
          f"(len={supabase_results['shortest_signature']['length']}, "
          f"label={supabase_results['shortest_signature']['label']})")
    print(f"Самая длинная подпись: {supabase_results['longest_signature']['id']} "
          f"(len={supabase_results['longest_signature']['length']}, "
          f"label={supabase_results['longest_signature']['label']})")
    
    print(f"\nОбщая статистика:")
    print(f"Средняя длина: {supabase_results['overall_stats']['mean_seq_len']:.1f}")
    print(f"Медианная длина: {supabase_results['overall_stats']['median_seq_len']:.1f}")
    print(f"Стандартное отклонение: {supabase_results['overall_stats']['std_seq_len']:.1f}")

    print("\nДиапазоны координат и давлений:")
    for col, rng in supabase_results["feature_ranges"].items():
        print(f"{col}: min={rng[0]:.1f}, max={rng[1]:.1f}")
    if supabase_results["median_t"] is not None:
        print(f"Медиана t: {supabase_results['median_t']:.1f}")


def print_lmdb_report(lmdb_results: Dict) -> None:
    """
    Print formatted analysis report for LMDB data.
    
    Args:
        lmdb_results: Results from analyze_lmdb_data
    """
    print("=" * 60)
    print("📊 ОТЧЕТ ПО ДАННЫМ LMDB")
    print("=" * 60)
    
    print("\nМетрики по категориям (label, input_type):")
    print("-" * 50)
    print(lmdb_results["metrics_df"])
    
    print(f"\nВсего образцов в LMDB: {lmdb_results['total_samples']}")
    ss_short = lmdb_results['shortest_signature']
    ss_long = lmdb_results['longest_signature']
    short_id = ss_short.get('id', ss_short.get('key'))
    long_id = ss_long.get('id', ss_long.get('key'))
    print(f"Самая короткая подпись: {short_id} (len={ss_short['length']})")
    print(f"Самая длинная подпись: {long_id} (len={ss_long['length']})")
    
    print(f"\nОбщая статистика:")
    print(f"Средняя длина: {lmdb_results['overall_stats']['mean_seq_len']:.1f}")
    print(f"Медианная длина: {lmdb_results['overall_stats']['median_seq_len']:.1f}")
    print(f"Стандартное отклонение: {lmdb_results['overall_stats']['std_seq_len']:.1f}")

    print("\nДиапазоны координат и давлений:")
    for col, rng in lmdb_results["feature_ranges"].items():
        print(f"{col}: min={rng[0]:.1f}, max={rng[1]:.1f}")
    if lmdb_results["median_t"] is not None:
        print(f"Медиана t: {lmdb_results['median_t']:.1f}")


def print_analysis_report(supabase_results: Dict, lmdb_results: Dict) -> None:
    """
    Print formatted analysis report comparing Supabase and LMDB data.
    
    Args:
        supabase_results: Results from analyze_supabase_data
        lmdb_results: Results from analyze_lmdb_data
    """
    print("=" * 80)
    print("📈 СВОДНЫЙ ОТЧЕТ ПО АНАЛИЗУ ДАННЫХ ПОДПИСЕЙ")
    print("=" * 80)
    
    # Вывод отчетов по отдельности
    print_supabase_report(supabase_results)
    print()
    print_lmdb_report(lmdb_results)
    
    print("\n" + "=" * 80)
    print("📊 СРАВНИТЕЛЬНЫЙ АНАЛИЗ")
    print("=" * 80)
    
    print(f"\nСравнение общих статистик:")
    print(f"БД  - Средняя длина: {supabase_results['overall_stats']['mean_seq_len']:.1f}, "
          f"Медианная длина: {supabase_results['overall_stats']['median_seq_len']:.1f}")
    print(f"LMDB - Средняя длина: {lmdb_results['overall_stats']['mean_seq_len']:.1f}, "
          f"Медианная длина: {lmdb_results['overall_stats']['median_seq_len']:.1f}")
    
    # Проверка на расхождения
    db_count = supabase_results['total_samples']
    lmdb_count = lmdb_results['total_samples']
    if db_count != lmdb_count:
        print(f"\n⚠️  ВНИМАНИЕ: Несоответствие количества образцов! БД: {db_count}, LMDB: {lmdb_count}")
    else:
        print(f"\n✅ Количество образцов совпадает: {db_count} образцов")


# ---------------------------------------------------------------------------
# Visualization utilities
# ---------------------------------------------------------------------------

import matplotlib.pyplot as plt


def plot_t_distribution(
    lmdb_path: str,
    *,
    bin_width: int = 500,
    max_t: Optional[float] = None,
) -> plt.Figure:
    """Plot histogram (bar chart) of *t* coordinate distribution for a given LMDB.

    Args:
        lmdb_path: Path to the ``.lmdb`` dataset.
        bin_width: Width of the bins for the histogram in the same units as *t*.
        max_t: Optional upper bound for *t* values. If ``None`` (default), the
            function will compute the 99-й процентиль и отфильтровать более
            редкие выбросы, чтобы график не растягивался.

    Returns:
        Matplotlib ``Figure`` with the histogram. Useful if caller wants to
        further customise or save the plot.
    """

    # Collect *duration* of each signature (max t value)
    durations: List[float] = []

    env = lmdb.open(lmdb_path, readonly=True, lock=False, readahead=True, max_readers=2048)
    with env.begin() as txn:
        index_bytes = txn.get(b"__index__")
        if index_bytes is None:
            raise RuntimeError("LMDB index not found; ensure the dataset is built correctly")
        keys = [k for k in index_bytes.decode("utf-8").splitlines() if k]

        for key in keys:
            csv_bytes = txn.get(key.encode("utf-8"))
            if csv_bytes is None:
                continue
            csv_text = csv_bytes.decode("utf-8")
            rows = list(csv.reader(csv_text.strip().split("\n")))
            if len(rows) <= 1:
                continue
            # take last data row t value
            try:
                last_t = float(rows[-1][0])
                durations.append(last_t)
            except (ValueError, IndexError):
                continue

    if not durations:
        raise RuntimeError("Не удалось извлечь длительности подписей из LMDB")

    dur_arr = np.array(durations, dtype=np.float32)

    if max_t is None:
        max_t = dur_arr.max()
    # При явном max_t можно обрезать, иначе оставляем все значения
    if max_t is not None:
        dur_arr = dur_arr[dur_arr <= max_t]

    num_bins = int(np.ceil(max_t / bin_width))
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.hist(dur_arr, bins=num_bins, color="#2b8cbe")
    ax.set_xlabel("Длительность подписи t (мс)")
    ax.set_ylabel("Количество подписей")
    ax.set_title("Распределение длительностей подписей (t_max) в LMDB")
    ax.grid(True, linestyle=":", alpha=0.5)

    plt.tight_layout()
    return fig

# ---------------------------------------------------------------------------
# Label-aware duration histogram
# ---------------------------------------------------------------------------


def plot_t_distribution_by_label(
    lmdb_path: str,
    *,
    bin_width: int = 500,
    max_t: Optional[float] = None,
    overlay: bool = False,
    text_step: int = 100,
) -> plt.Figure:
    """Build duration histograms separately for *genuine* и *forged* подписей.

    Args:
        lmdb_path: Path to dataset.
        bin_width: Histogram bin width (ms).
        max_t: Optional clip value; if *None* uses 99-percentile of all durations.
        overlay: If *True* – overlay both distributions on single axes, otherwise
            draws two stacked subplots.
    """

    # Gather durations per label
    durations_by_label: Dict[str, List[float]] = {"genuine": [], "forged": []}

    env = lmdb.open(lmdb_path, readonly=True, lock=False, readahead=True, max_readers=2048)
    with env.begin() as txn:
        index_bytes = txn.get(b"__index__")
        if index_bytes is None:
            raise RuntimeError("LMDB index not found")
        keys = [k for k in index_bytes.decode("utf-8").splitlines() if k]

        for key in keys:
            csv_bytes = txn.get(key.encode("utf-8"))
            lbl_bytes = txn.get(f"{key}:label".encode("utf-8"))
            if csv_bytes is None or lbl_bytes is None:
                continue
            label = lbl_bytes.decode("utf-8").strip().lower()
            if label not in durations_by_label:
                continue  # skip unknown labels

            rows = list(csv.reader(csv_bytes.decode("utf-8").strip().split("\n")))
            if len(rows) <= 1:
                continue
            try:
                durations_by_label[label].append(float(rows[-1][0]))
            except (ValueError, IndexError):
                continue

    # Flatten to compute global clipping value
    all_durations = [d for lst in durations_by_label.values() for d in lst]
    if not all_durations:
        raise RuntimeError("Не удалось получить длительности подписей")

    if max_t is None:
        max_t = max(all_durations)

    # Clip only if max_t specified by user
    if max_t is not None:
        for lbl in durations_by_label:
            durations_by_label[lbl] = [d for d in durations_by_label[lbl] if d <= max_t]

    num_bins = int(np.ceil(max_t / bin_width))

    # Prepare textual histogram with fixed step (default 100 мс)
    text_bins = np.arange(0, max_t + text_step, text_step)
    text_counts = {
        lbl: np.histogram(durations_by_label[lbl], bins=text_bins)[0]
        for lbl in durations_by_label
    }

    # Compose CSV-like text output
    lines = ["duration_ms,genuine_count,forged_count"]
    for i in range(len(text_bins) - 1):
        duration = int(text_bins[i])
        genuine_count = int(text_counts['genuine'][i])
        forged_count = int(text_counts['forged'][i])
        if genuine_count == 0 and forged_count == 0:
            continue
        lines.append(f"{duration},{genuine_count},{forged_count}")
    text_output = "\n".join(lines)

    if overlay:
        fig, ax = plt.subplots(figsize=(10, 4))
        colors = {"genuine": "#2b8cbe", "forged": "#e34a33"}
        for lbl, data in durations_by_label.items():
            ax.hist(data, bins=num_bins, alpha=0.6, label=f"{lbl} ({len(data)})", color=colors[lbl])
        ax.set_xlabel("Длительность подписи t (мс)")
        ax.set_ylabel("Количество подписей")
        ax.set_title("Распределение длительностей подписей по меткам")
        ax.legend()
        ax.grid(True, linestyle=":", alpha=0.5)
    else:
        fig, axes = plt.subplots(2, 1, figsize=(10, 6), sharex=True)
        for idx, lbl in enumerate(["genuine", "forged"]):
            axes[idx].hist(durations_by_label[lbl], bins=num_bins, color="#2b8cbe" if lbl == "genuine" else "#e34a33")
            axes[idx].set_ylabel("Кол-во подписей")
            axes[idx].set_title(f"{lbl.capitalize()} ({len(durations_by_label[lbl])})")
            axes[idx].grid(True, linestyle=":", alpha=0.5)
        axes[-1].set_xlabel("Длительность подписи t (мс)")
        plt.tight_layout()

    return fig, text_output

# ---------------------------------------------------------------------------
# Data quality checks
# ---------------------------------------------------------------------------


def find_untrimmed_signatures(
    lmdb_path: str,
    *,
    pressure_zero_threshold: float = 0.0,
    max_skip_check: int = 10,
) -> List[Dict[str, any]]:
    """Find LMDB entries that contain garbage points with zero pressure
    at the *start* or *end* of the sequence.

    Args:
        lmdb_path: Path to ``.lmdb`` dataset.
        pressure_zero_threshold: Value that is considered *zero* pressure.
        max_skip_check: How many first/last points to inspect. You may keep
            this small for performance – it is enough to detect majority of
            мусорных "хвостов".

    Returns:
        List of dicts with keys: ``key`` – LMDB key, ``leading_zeros`` – number
        of consecutive zero-pressure points at the start, ``trailing_zeros`` –
        number of such points at the end, ``length`` – full sequence length.
    """

    problematic: List[Dict[str, any]] = []

    env = lmdb.open(lmdb_path, readonly=True, lock=False, readahead=True, max_readers=2048)
    with env.begin() as txn:
        index_bytes = txn.get(b"__index__")
        if index_bytes is None:
            raise RuntimeError("LMDB index not found")
        keys = [k for k in index_bytes.decode("utf-8").splitlines() if k]

        for key in keys:
            csv_bytes = txn.get(key.encode("utf-8"))
            if csv_bytes is None:
                continue
            csv_text = csv_bytes.decode("utf-8")
            rows = list(csv.reader(csv_text.strip().split("\n")))
            if len(rows) <= 1:
                continue  # empty

            values = rows[1:]
            pressures = [float(r[3]) if len(r) >= 4 else pressure_zero_threshold for r in values]
            length = len(pressures)

            # Leading zeros
            leading_zeros = 0
            for p in pressures[:max_skip_check]:
                if p <= pressure_zero_threshold:
                    leading_zeros += 1
                else:
                    break

            # Trailing zeros
            trailing_zeros = 0
            for p in reversed(pressures[-max_skip_check:]):
                if p <= pressure_zero_threshold:
                    trailing_zeros += 1
                else:
                    break

            if leading_zeros > 0 or trailing_zeros > 0:
                problematic.append(
                    {
                        "key": key,
                        "leading_zeros": leading_zeros,
                        "trailing_zeros": trailing_zeros,
                        "length": length,
                    }
                )

    return problematic


