import json
from pathlib import Path

p = Path(__file__).parent / "main.example.ipynb"
nb = json.loads(p.read_text(encoding="utf-8"))
for c in nb["cells"]:
    if c.get("cell_type") != "code":
        continue
    src = "".join(c.get("source", []))
    if "calibrate_anomaly_detector" not in src or "require_anomaly=False" in src:
        continue
    src = src.replace(
        "run_path = resolve_latest_run_dir(str(_artifacts_base))",
        "run_path = resolve_latest_run_dir(str(_artifacts_base), require_anomaly=False)",
    )
    src = src.replace(
        "raise FileNotFoundError(f'No run under {_artifacts_base}')",
        "raise FileNotFoundError(\n"
        "            f'No calibratable run under {_artifacts_base} '\n"
        "            '(need checkpoints/best_by_eer.pt, model.py, data_splits.json or configs.json)'\n"
        "        )",
    )
    c["source"] = [line + "\n" for line in src.splitlines()]
    if c["source"]:
        c["source"][-1] = c["source"][-1].rstrip("\n") + "\n"
    print("patched")
p.write_text(json.dumps(nb, ensure_ascii=False, indent=2), encoding="utf-8")
