# Pasta `worker/` — legado

Esta API em **Cloudflare Worker + D1** **não faz parte do deploy atual** do Ativa Dash.

A produção usa apenas:

- **Backend:** `backend/` (Node + Express + Prisma + PostgreSQL) — ver **`DEPLOY-VPS.md`** na raiz do repositório.
- **Frontend:** `frontend/` (build estático servido na VPS ou outro host de sua escolha).

O código em `worker/` permanece no repositório como referência histórica; não há documentação de deploy Cloudflare na raiz do projeto.
