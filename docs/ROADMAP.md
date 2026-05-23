# Roadmap

Prioritized work items for Your Sign AI. This file is the living backlog; update it when scope changes.

## P0 — Stability and agent onboarding

- [x] Add root **`AGENTS.md`** — context for AI coding agents
- [x] Align repo docs: remove dead **CONTRIBUTING** links; keep **SETUP** / **DEPLOYMENT** accurate
- [x] Update **`.cursor/rules/inference-venv.mdc`** — repo-relative paths, root `.venv`

## P1 — Model / inference contract (highest product risk)

- [x] **Feature pipeline sync**: bundle `features.py` + `manifest.json` on inference; `models/current/` slot; threshold from manifest
- [x] **Model bundle zip**: training `export_bundle.py` → Blob `models/{name}.zip`; admin upload/activate/rollback; notebook `NAME` для имени zip/manifest
- [x] **Verification threshold**: cosine threshold из `manifest.verification` (EER на val)
- [x] **Anomaly detector (Mahalanobis)**: post-training calibration → `anomaly_params.npz`; REJECT `input_not_a_signature` на inference + UI
- [ ] **Verification UX**: richer copy / stats beyond similarity % (anomaly fields уже в API)

## P2 — Deployment and CORS

- [ ] **Vercel preview origins** in inference `FRONTEND_URL` (dev branches as private preview; no separate staging DB/inference)
- [x] Document Supabase project URL churn risk (free tier pause ~90 days) in **AGENTS.md** / deployment notes

## P3 — Housekeeping (demo → maintainable)

- [ ] Finish or remove **admin_tokens** table flow (low priority; dataset export uses Supabase login in `training/main.ipynb` today)
- [ ] Refresh **inference `.env.example`** (`MODEL_NAME`, production vars) when env contract changes
- [ ] Revisit **diagrams** under `docs/diagrams/` when architecture stabilizes (currently may be stale)

## P4 — Not planned

- Docker Compose for full stack (Supabase CLI + npm only)
- GitHub Actions CI (manual / local checks for now)
- Local training replacing Colab notebook (`training/main.ipynb` stays primary)
- Online E2E environment (local Supabase + local inference only)

## Production reference (may change)

| Service   | URL |
|-----------|-----|
| Frontend  | https://your-signature-ai.vercel.app/ |
| Inference | https://your-signature-ai.onrender.com |
| Supabase  | https://fobqfdljlrglvvhbfsnz.supabase.co |

**Active model (hosted):** `temp-quick` (weights on host / Vercel Blob; not necessarily in local `inference/models/`).

**Deploy branch:** `main` → auto-deploy Vercel (`site/`) + Render (`inference/`).
