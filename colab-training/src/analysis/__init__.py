"""
Data analysis module for signature verification.
"""

from .data_analysis import (
    analyze_data,
    DataSource,
    print_analysis_report,
    print_supabase_report,
    print_lmdb_report,
    plot_t_distribution,
    plot_t_distribution_by_label,
    find_untrimmed_signatures
)

__all__ = [
    "analyze_data",
    "DataSource",
    "print_analysis_report",
    "print_supabase_report",
    "print_lmdb_report",
    "plot_t_distribution",
    "plot_t_distribution_by_label",
    "find_untrimmed_signatures"
]
