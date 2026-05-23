# AGENTS.md — Your Sign AI

Context for AI coding agents (Cursor, Claude, ChatGPT, Gemini, etc.). Read this before non-trivial changes.

## Project summary

**Your Sign AI** is primarily an **academic project** used as a **demo**: collect digital signatures, build datasets, train a PyTorch encoder, and verify signatures (1:1 similarity via embeddings). The goal is to **replace temporary hacks** with maintainable patterns—not greenfield rewrites unless asked.

| Area | Path | Stack |
|------|------|--------|
| Frontend | `site/` | Next.js 16 App Router, React 19, TS, Tailwind, Supabase Auth SSR |
| Inference | `inference/` | FastAPI, PyTorch, Uvicorn; deploy Render (+ Vercel serverless alt.) |
| Training | `training/` | PyTorch package + **`training/main.ipynb`** (Colab/local notebook) |
| Database | `supabase/` | Postgres migrations, RLS, `schema.sql` (aggregated reference) |
| Scripts | `scripts/` | Node utilities (local DB seed, pseudousers, DSDB—legacy import) |
| Docs | `docs/` | Architecture, APIs, guides — **prefer updating docs when code diverges** |

Monorepo root: `package.json` workspaces (`site`, `inference`, `training`). Python venv: **repo root** `.venv` (see `inference.ps1`).

## Production & deploy

| Service | URL | Notes |
|---------|-----|--------|
| Frontend | https://your-signature-ai.vercel.app/ | Vercel, root `site/` |
| Inference | https://your-signature-ai.onrender.com | Render; **also** Vercel deploy under `inference/` (both live) |
| Supabase | https://fobqfdljlrglvvhbfsnz.supabase.co | Free tier; project was recreated after ~90d pause—URL may change again |

- **Deploy branch:** `main` → auto-deploy frontend + Render inference.
- **No shared staging:** no paid preview DB/inference. **Vercel `dev` branches** act as private frontend previews. Render `FRONTEND_URL`: production origin + glob (`https://your-signature-ai-*.vercel.app`). Local work: **Supabase CLI (`supabase start`)** + **local inference**.
- **Active production model:** `temp-quick` (bundle zip in Blob; unpacked to `inference/models/current/`).

See **`docs/ROADMAP.md`** for prioritized backlog.

## Local development

```text
Typical flow:
  supabase start          # default DB for dev/tests
  cd site && npm run dev  # :3000
  inference.ps1           # or: .venv + cd inference && uvicorn main:app --port 8000
```

- Owner may point local `.env*` at **cloud Supabase** for read-only tasks—you won't see those files.
- **Do not** start inference for unrelated `site/` work; owner often runs it in the background. **Do** start/stop inference when the task touches forgery/model routes.
- **No Docker Compose** (only Supabase CLI + npm).
- Python version on Render may shift; pin/fix `inference/requirements.txt` if deploy breaks.

### Environment files

| File | Purpose | Agent access |
|------|---------|----------------|
| `site/.env.example` | Template | Read/edit when task requires; **notify user** to sync `.env.local` / Vercel |
| `site/.env.local` | Local dev secrets | Exists; not visible—don't assume values |
| `site/.env.test.local` | Jest/Playwright | Same |
| `inference/.env.example` | Template | Read/edit when needed; notify user |
| `inference/.env` | Local inference secrets | Terminal read **only with explicit user permission** |

**Never commit:** secrets, DB backups, ad-hoc scripts under ignored `tmp/` (e.g. old `get_jwt.sql`, `find_vercel_token.py`).

**Vercel Blob:** `BLOB_READ_WRITE_TOKEN` used by **both** `site/` (admin upload UI) and `inference/` (production model load)—server-side only.

## Architecture flows

### Signature capture → DB

Canvas → points `{timestamp,x,y,p}` → `POST /api/signatures` → `genuine_signatures.features_table` (CSV: header + rows).

### Forgery dataset

`GET /api/forgery` (RPC `get_random_forgery_signature`) → user draws forgery → stored in `forged_signatures`. Flags: `user_for_forgery`, `mod_for_forgery`, `mod_for_dataset` — policy in **`site/lib/signature-management-policies.ts`** (`'use server'`, **never import in client components**).

### Verification

Client or Next layer → inference `POST /forgery-by-data/` or `/forgery-by-id/` → embeddings → optional **Mahalanobis** on candidate (`manifest.anomaly`) → cosine similarity → `is_forgery` (threshold from **`manifest.verification.threshold`**).

Reject invalid stroke: `is_not_signature`, `rejection_reason: "input_not_a_signature"`. See `docs/training/ANOMALY_DETECTION.md`.

Direct browser → inference is **acceptable**.

### Training → deploy model

`training/main.ipynb` (gitignored) ↔ **`npm run notebook:main-to-example`** / **`notebook:example-to-main`** → `training/main.example.ipynb` + `training/src/*` → `TrainingRunner` → anomaly calibration → **`export_model_bundle`** (`NAME` in export cell for zip/manifest name) → admin upload **zip** → **Vercel Blob** + `models` table → inference `models/current/` (hotswap via admin UI).

### Controlled collection (important)

`/controlled-signature-addition` — **mod/admin** creates pseudousers and adds genuine samples under supervision (live collection / external-style IDs).

## Roles

| Role | Capabilities |
|------|----------------|
| `user` | Own signatures; create forgeries from random template; **cannot** see others' signatures |
| `mod` | User + moderate all signatures; dataset flags; **controlled-signature-addition** |
| `admin` | Mod + **manage roles** (`user`/`mod`); **active inference model** via web UI |

Dashboards: `/dashboard` (user), `/dashboard-mod`, `/dashboard-admin` — document and preserve these entry points.

JWT role: `user_metadata.role` / `raw_user_meta_data.role` — values `user` | `mod` | `admin`.

## Database rules (agents)

1. **Discuss** schema/RLS changes before implementing.
2. **New migrations** for hosted DB (`supabase/migrations/NNN_*.sql`); don't rewrite applied migrations.
3. Test locally (`supabase start` / reset); user applies to cloud manually.
4. Update **`supabase/schema.sql`** after migrations when a full-schema view is needed (reference only).
5. Avoid drive-by RLS changes.

**DSDB:** external dataset already imported (~330 pseudousers × 25 genuine + 25 forged). **Pseudousers** = external IDs (`u0001`, …) or moderator-created collectors without auth accounts.

**admin_tokens:** table exists; **not used in production** (low-priority roadmap; dataset export uses Supabase login in notebook).

## Branching

Owner uses topic branches (`dev`, `dev-inference`, …). If the task touches another area than the current branch, **ask to switch** unless they said to use `dev` or merge scope explicitly.

## Code boundaries

| Change type | Where |
|-------------|--------|
| UI, API routes, auth, policies | `site/` |
| Preprocessing, model load, forgery API | `inference/` |
| Training loss, LMDB, metrics | `training/` + notebook |
| Schema, RLS, RPC | `supabase/` |

**Known pain — `features_table` / feature pipeline:** training uses extended features (`training/src/config.py` `feature_pipeline`); site must match or inference preprocess breaks. **Target:** inference reads pipeline + threshold from **active model artifact**, not manual `site/` edits per model version.

## Key source-of-truth docs

- `docs/ARCHITECTURE.md` — system overview
- `docs/DATABASE.md` — tables, RLS overview
- `site/lib/signature-management-policies.ts` — signature/forgery permissions
- `docs/API/FRONTEND_API.md`, `docs/API/INFERENCE_API.md`
- `docs/GUIDES/SETUP.md`, `docs/GUIDES/DEPLOYMENT.md`
- `docs/ROADMAP.md` — priorities
- `docs/training/MODEL_BUNDLE.md`, `docs/training/ANOMALY_DETECTION.md` — export zip, Mahalanobis gate

**Ignore for accuracy:** `docs/diagrams/*` (may be stale until owner refreshes).

## API surface (quick)

**Next (`site/app/api/`):** `signatures`, `forgery`, `forgery/[id]`, `users/[id]`, `pseudousers`, `health`, `inference/model` (public model info), `admin/models/blob` (list Blob models for admin).

**Inference:** `health`, `forgery-by-id`, `forgery-by-data`, `model`, `model-upload` (admin).

## Testing

- **When asked:** `site/`: `npm run check-all`, `npm test`, `npm run test:e2e` (role projects: guest/user/mod/admin).
- E2E expects **local** Supabase + often **local inference** (no CI inference URL).
- Root: `npm run reset-db`, `test-users`, `generate-pseudousers` — **local only**.
- Husky/lint-staged live under `site/`; no GitHub Actions planned.

## Agent behavior

- **Language:** AGENTS/docs for agents in **English**; **commit messages** per owner preference: **Russian** is fine.
- **Scope:** minimal correct diff; suggest improvements **only if relevant** to the current task.
- **Docs:** if code ≠ docs, flag it and offer to update `docs/`.
- **Sensitive files:** don't touch ignored tmp/backups; don't read non-example `.env` without permission.
- **Env example edits:** allowed when required—tell user to update local + Vercel/Render env on `main` merge.
- **Uncertain impact** on core files (RLS, policies, model loader, preprocessing): **ask** before large edits.
- **Skills:** use Supabase / Context7 MCP docs for library and Postgres/auth patterns when changing those layers.
- **PR size:** owner rarely uses PRs; atomic commits still appreciated.

## Inference local run (Windows)

From repo root (background terminal):

```powershell
.\.venv\Scripts\Activate.ps1
cd inference
python main.py
# or: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Or: `.\inference.ps1` from root.

## License

MIT — code may be reused in other owner repos.
