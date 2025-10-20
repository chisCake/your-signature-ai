from __future__ import annotations

from typing import List, Dict, Callable, Any
import math
import numpy as np
import torch

# ---- Dynamic feature registry -------------------------------------------------

# Users can register custom feature-computation callbacks which receive a
# dictionary with already-computed base/derived channels and must return a
# 1-D numpy array of shape [T].
#
# Example:
#   @register_feature("log_speed")
#   def _log_speed(arrs):
#       return np.log(arrs["speed"] + 1e-6)

FEATURE_REGISTRY: Dict[str, Callable[[Dict[str, np.ndarray]], np.ndarray]] = {}


def register_feature(name: str):
    """Decorator to register a new derived feature by name."""

    def _decorator(fn: Callable[[Dict[str, np.ndarray]], np.ndarray]):
        if name in FEATURE_REGISTRY:
            raise ValueError(f"Feature '{name}' already registered")
        FEATURE_REGISTRY[name] = fn
        return fn

    return _decorator


def _safe_div(a: np.ndarray, b: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    return a / (b + eps)


# NOTE: Removed redundant @register_feature decorators.
# All features are now computed directly in apply_feature_pipeline()
# and stored in name_to_array dictionary.
# FEATURE_REGISTRY is now available for custom user-defined features only.


def compute_dt(t: np.ndarray) -> np.ndarray:
    """Compute time deltas between consecutive points."""
    dt = np.zeros_like(t)
    if t.shape[0] > 1:
        dt[1:] = np.diff(t)
    return dt


def compute_velocity(x: np.ndarray, y: np.ndarray, dt: np.ndarray) -> Dict[str, np.ndarray]:
    dx = np.zeros_like(x)
    dy = np.zeros_like(y)
    if x.shape[0] > 1:
        dx[1:] = np.diff(x)
        dy[1:] = np.diff(y)
    vx = _safe_div(dx, dt)
    vy = _safe_div(dy, dt)
    return {"vx": vx, "vy": vy, "dx": dx, "dy": dy}


def compute_acceleration(vx: np.ndarray, vy: np.ndarray, dt: np.ndarray) -> Dict[str, np.ndarray]:
    dvx = np.zeros_like(vx)
    dvy = np.zeros_like(vy)
    if vx.shape[0] > 1:
        dvx[1:] = np.diff(vx)
        dvy[1:] = np.diff(vy)
    ax = _safe_div(dvx, dt)
    ay = _safe_div(dvy, dt)
    return {"ax": ax, "ay": ay, "dvx": dvx, "dvy": dvy}


def compute_jerk(ax: np.ndarray, ay: np.ndarray, dt: np.ndarray) -> Dict[str, np.ndarray]:
    dax = np.zeros_like(ax)
    day = np.zeros_like(ay)
    if ax.shape[0] > 1:
        dax[1:] = np.diff(ax)
        day[1:] = np.diff(ay)
    jx = _safe_div(dax, dt)
    jy = _safe_div(day, dt)
    j = np.sqrt(jx ** 2 + jy ** 2)
    return {"jx": jx, "jy": jy, "jerk": j}


def compute_angles(dx: np.ndarray, dy: np.ndarray) -> Dict[str, np.ndarray]:
    theta = np.arctan2(dy, dx)
    # turn angle is delta theta with unwrap
    dtheta = np.zeros_like(theta)
    if theta.shape[0] > 1:
        d = np.diff(np.unwrap(theta))
        dtheta[1:] = d
    return {"theta": theta, "turn": dtheta}


def compute_curvature(dx: np.ndarray, dy: np.ndarray, ddx: np.ndarray, ddy: np.ndarray) -> np.ndarray:
    # curvature = |x'y'' - y'x''| / ( (x'^2 + y'^2)^(3/2) )
    num = np.abs(dx * ddy - dy * ddx)
    denom = (dx ** 2 + dy ** 2) ** 1.5 + 1e-8
    kappa = num / denom
    return kappa


def compute_pressure_derivatives(p: np.ndarray, dt: np.ndarray) -> Dict[str, np.ndarray]:
    dp = np.zeros_like(p)
    if p.shape[0] > 1:
        dp[1:] = np.diff(p)
    dp_dt = _safe_div(dp, dt)
    return {"dp": dp, "dp_dt": dp_dt}


def compute_path_and_strokes(dx: np.ndarray, dy: np.ndarray, dt: np.ndarray) -> Dict[str, np.ndarray]:
    speed = np.sqrt(dx ** 2 + dy ** 2)
    path = np.cumsum(speed)
    # simple pause flag heuristic: dt greater than 3x median of positive dt
    pos_dt = dt[dt > 0]
    thr = 0.0
    if pos_dt.size > 0:
        thr = 3.0 * float(np.median(pos_dt))
    pause = (dt > thr).astype(np.float32)
    # stroke id increments at pause rising edges
    stroke_id = np.zeros_like(dt)
    if dt.shape[0] > 1:
        edges = (pause[1:] > pause[:-1]) & (pause[1:] > 0)
        stroke_id[1:] = np.cumsum(edges.astype(np.int32))
    return {"speed": speed, "path_len": path, "pause": pause, "stroke_id": stroke_id}


def apply_feature_pipeline(seq: torch.Tensor, pipeline: List[str]) -> torch.Tensor:
    """
    Build derived features from base sequence tensor of shape [T, 4] with columns [t, x, y, p].
    Returns tensor [T, C] including selected derived features in order given by pipeline.
    
    NOTE: x, y, p are already normalized to [0,1] in build_dataset.py during LMDB creation.
    
    Available names: "dt","vx","vy","ax","ay","jx","jy","jerk","theta","turn","curvature",
                     "dp","dp_dt","path_len","pause","stroke_id","prate","path_velocity",
                     "path_tangent_angle","abs_delta_pressure".
    """
    if pipeline is None or len(pipeline) == 0:
        return seq

    arr = seq.detach().cpu().numpy()
    t = arr[:, 0]
    x = arr[:, 1]  # Already normalized [0,1] with aspect ratio preserved
    y = arr[:, 2]  # Already normalized [0,1] with aspect ratio preserved
    p = arr[:, 3]  # Already normalized [0,1]
    
    # {ДОБАВЛЕНО: нормализация времени}/{предотвратить использование длины последовательности как признака}/{модель будет фокусироваться на динамике, а не на длине}
    t_range = t.max() - t.min()
    if t_range > 1e-8:  # {ДОБАВЛЕНО: защита от деления на ноль}/{избежать NaN при одинаковых временных метках}/{стабильная нормализация}
        t = (t - t.min()) / t_range  # Normalize to [0,1]

    dt = compute_dt(t)
    v = compute_velocity(x, y, dt)
    a = compute_acceleration(v["vx"], v["vy"], dt)
    j = compute_jerk(a["ax"], a["ay"], dt)
    ang = compute_angles(v["dx"], v["dy"])  # use dx,dy for angles
    # approximate second derivatives in coord space
    ddx = np.zeros_like(v["dx"])
    ddy = np.zeros_like(v["dy"])
    if v["dx"].shape[0] > 1:
        ddx[1:] = np.diff(v["dx"])
        ddy[1:] = np.diff(v["dy"])
    kappa = compute_curvature(v["dx"], v["dy"], ddx, ddy)
    pr = compute_pressure_derivatives(p, dt)
    path = compute_path_and_strokes(v["dx"], v["dy"], dt)

    # NOTE: In build_dataset.py, x,y,p are already normalized to [0,1]
    # So sx, sy, sp are redundant and removed.
    
    # Compute additional features from preprocessing.py
    # prate - pressure rate (derivative of normalized pressure)
    prate = np.zeros_like(p)
    if len(p) > 1:
        prate[1:] = np.diff(p) / (dt[1:] + 1e-8)
    
    # path_velocity - magnitude of velocity vector
    path_velocity = np.sqrt(v["vx"]**2 + v["vy"]**2)
    
    # path_tangent_angle - angle of velocity vector normalized to [-1, 1]
    path_tangent_angle = np.zeros_like(v["vx"])
    mask = (v["vx"] != 0) | (v["vy"] != 0)
    path_tangent_angle[mask] = np.arctan2(v["vy"][mask], v["vx"][mask]) / np.pi
    
    # abs_delta_pressure - absolute change in pressure between consecutive points
    abs_delta_pressure = np.abs(np.diff(p, prepend=p[0]))

    name_to_array: Dict[str, np.ndarray] = {
        "t": t,
        "x": x,
        "y": y,
        "p": p,
        "dt": dt,
        "vx": v["vx"],
        "vy": v["vy"],
        "ax": a["ax"],
        "ay": a["ay"],
        "jx": j["jx"],
        "jy": j["jy"],
        "jerk": j["jerk"],
        "theta": ang["theta"],
        "turn": ang["turn"],
        "curvature": kappa,
        "dp": pr["dp"],
        "dp_dt": pr["dp_dt"],
        "path_len": path["path_len"],
        "pause": path["pause"],
        "stroke_id": path["stroke_id"],
        "prate": prate,
        "path_velocity": path_velocity,
        "path_tangent_angle": path_tangent_angle,
        "abs_delta_pressure": abs_delta_pressure,
    }

    channels: List[np.ndarray] = []
    for name in pipeline:
        if name in name_to_array:
            channels.append(name_to_array[name].astype(np.float32))
        elif name in FEATURE_REGISTRY:
            # Compute custom feature on demand and cache for possible reuse
            arr = FEATURE_REGISTRY[name](name_to_array)
            if arr.shape[0] != t.shape[0]:
                raise ValueError(
                    f"Custom feature '{name}' returned wrong length {arr.shape[0]} (expected {t.shape[0]})"
                )
            name_to_array[name] = arr  # cache
            channels.append(arr.astype(np.float32))
        else:
            # Unknown feature name – silently skip
            continue

    if len(channels) == 0:
        return seq

    out = np.stack(channels, axis=1)
    return torch.from_numpy(out).type_as(seq)


