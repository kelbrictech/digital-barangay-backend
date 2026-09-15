# VICO — Backend API

Production API for VICO, a community member-facing service delivery application supporting resident services, barangay operations, and separated Webmaster credential governance.

## Current release

**v1.1.0 — live in production**

**Frontend / Live Demo:** https://kelbrictech.github.io/Digital-Barangay-App/

**Backend API:** https://digital-barangay-backend.onrender.com/

Health check: `https://digital-barangay-backend.onrender.com/api/health`

The repository and deployed-service slugs remain stable infrastructure identifiers; the product identity is VICO.

## Stack

- Node.js + Express
- PostgreSQL via Neon
- Prisma ORM
- JWT authentication
- bcrypt password hashing
- Cloudinary for uploaded files
- Render deployment

## Architecture

```text
Resident / Admin / Webmaster Browser
                |
                v
         GitHub Pages frontend
                |
                v
         Render Express API
                |
             Prisma ORM
                |
                v
          Neon PostgreSQL

File uploads -> Cloudinary
```

## v1.1 governance model

### Resident
- Creates and tracks document requests and community concerns.
- Receives canonical backend-generated request tracking numbers.
- Confirms a ready document as claimed.
- Confirms a resolved concern as closed.

### Admin
- Uses a stable `ADM-####` Staff ID.
- Operates request and concern workflows through backend-authoritative transitions.
- Actions are recorded in status history for auditability.
- Does not control Webmaster-governed credential fields.

### Webmaster
- Uses the dedicated `WEB-0001` governance identity.
- Reviews administrator credential applications.
- Approves/rejects applications and records review notes.
- Suspends/reactivates administrator credentials without deleting historical attribution.
- Reviews credential-governance history.

## API overview

| Area | Base path | Auth |
|---|---|---|
| Auth | `/api/auth` | registration/login public; `/me` authenticated |
| Profile | `/api/users` | authenticated |
| Document requests | `/api/requests` | resident/admin with role-authorized actions |
| Officials | `/api/officials` | public |
| Notices | `/api/notices` | public |
| Concerns | `/api/concerns` | resident/admin with role-authorized actions |
| Admin | `/api/admin/*` | admin operations |
| Webmaster | `/api/webmaster/*` | webmaster credential governance |

## Data integrity and history

v1.1 adds stable Staff IDs, request tracking numbers, request status history, concern status history, administrator applications, credential events, and supporting counters. Workflow transitions are validated by the backend rather than trusted to the browser.

The v1.1 production migration was rehearsed against an isolated Neon branch, verified for data preservation and uniqueness, then executed against production. Existing production accounts and service records were preserved.

## Local setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Required environment variables include `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, and the Cloudinary credentials used when uploads are enabled. Never commit production credentials or `.env` files.

## Administrator bootstrap

Administrative credentials are provisioned through controlled scripts/workflows rather than public self-registration. v1.1 separates ordinary Admin operations from Webmaster credential governance.

## Deployment

The production API runs on Render and uses Neon PostgreSQL. The frontend is deployed separately through GitHub Pages and communicates with this API over HTTPS. `CORS_ORIGIN` supports the approved frontend origin list; during the KELBRIC namespace transition both the legacy and current GitHub Pages origins are permitted until migration verification is complete.

## Release history

- `v1.0.0` — first accepted full-stack production baseline
- `v1.1.0` — Staff IDs, tracking numbers, auditable histories, resident confirmations, backend-authoritative workflows, and Webmaster credential governance

The production backend commit for v1.1.0 is preserved by the `v1.1.0` Git tag.

## Companion frontend

The public application and resident/admin/webmaster interfaces live in the companion repository:

https://github.com/kelbrictech/Digital-Barangay-App

## Status

**v1.1.0 is deployed and human-accepted in production.** Additional independent assurance remains a future quality checkpoint and is not represented as part of this release.

---

## About KELBRIC Technologies

We turn practical ideas and operational needs into focused digital products through rapid prototyping and evidence-based iteration.

**Public product process:** DISCOVER → DESIGN → BUILD → PROVE

© 2026 KELBRIC Technologies.
