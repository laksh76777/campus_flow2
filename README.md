# CampusFlow V3 — Enterprise Full-Stack Placement Automation Engine

Welcome to **CampusFlow V3** — the production-grade, fully typed, relational collegiate placement and career automation platform.

This version is a comprehensive technology migration of the CampusFlow platform from MongoDB/Mongoose to **Supabase PostgreSQL** and **TypeScript (End-to-End)** while preserving 100% of the UI design tokens, animations, student workflows, and TPO administration systems.

---

## 🔑 Demo Accounts (Ready to Test)

The platform includes verified demo accounts for both roles, featuring automatic offline and online support:

| Role | Email / Login Identifier | Password | Description & Permissions |
| :--- | :--- | :--- | :--- |
| **Placement Admin / TPO** | `admin@campusflow.edu` | `Admin@12345` | Full TPO console access (Drives, Applications, Students, Cohort Migration, Reminders & Copilot) |
| **Student Candidate** | `student@campusflow.edu` *(or USN: `1RV22CS042`)* | `Student@12345` | Class of 2026 CSE profile (CGPA: 8.75, 0 backlogs, verified resume, applications, support assistant) |

---

## 🚀 Key Architectural Changes in V3

| Capability | CampusFlow V2 (Legacy) | CampusFlow V3 (Migrated Target) |
| :--- | :--- | :--- |
| **Language** | JavaScript (ES6 / CommonJS & ESM) | **Strict TypeScript (End-to-End)** |
| **Primary Database** | MongoDB Atlas (NoSQL) via Mongoose | **Supabase PostgreSQL (Relational)** with transactions & foreign keys |
| **Data Safety & Integrity** | Schema-less / Soft validation | **PostgreSQL Constraints, Unique Indexes & RLS Policies** |
| **Eligibility Engine** | Ad-hoc Javascript logic | **Deterministic 11-Criteria Multi-Degree Evaluator** |
| **Authentication** | Standalone JWT with Mongo lookups | **Supabase Auth + Dual JWT verification & Server-Side Claims** |
| **Reminders & Workers** | In-memory `setInterval` timers | **PostgreSQL Idempotent Job Queue Worker** |
| **Spreadsheet Migration** | In-memory Excel parse | **Staged Imports, Formula-Injection Sanitizer & Atomic Batch Commits** |
| **AI Assistants** | Hardcoded prompts | **Structured Groq & Gemini Service Abstractions with Data Isolation** |
| **Transactional Email** | Nodemailer SMTP only | **Resend HTTPS API Primary with Truthful Diagnostics & SMTP Fallback** |
| **Hosting Model** | Monolithic Web Service | **Frontend (Vercel) + API (Render) + DB (Supabase) + Worker** |

---

## 📁 Repository Structure

```
campus_flow2/
├── frontend/                     # React 19 + TypeScript + Vite + Tailwind CSS v4
│   ├── public/                   # Public assets & icons
│   ├── src/
│   │   ├── assets/               # Logos, SVG illustrations
│   │   ├── components/
│   │   │   ├── admin/            # TPO management views (Drives, Applications, Students, Cohorts)
│   │   │   ├── common/           # ProtectedRoute, Layout wrappers
│   │   │   ├── home/             # Landing page components
│   │   │   ├── HomePageDashboard/# Interactive homepage showcase & contact
│   │   │   ├── studentDashboard/ # Student portal, profile drawers, application modals, support chat
│   │   │   └── ui/               # Reusable primitives (StatCard, SidebarNav, Markdown, ChatComposer)
│   │   ├── context/              # AuthContext (Supabase + API token sync)
│   │   ├── hooks/                # useAuth, useOverlay hooks
│   │   ├── pages/                # Route pages (Auth, Student, Admin)
│   │   ├── services/             # Typed API clients (student, admin, excel, session, notif, support)
│   │   ├── types/                # Domain types & API contracts
│   │   └── utils/                # Resume helper, URL parser
│   ├── .env                      # Local frontend environment variables
│   ├── .env.example              # Template for frontend environment
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── vercel.json               # SPA route rewrite config
│
├── major-backend/                # Node.js (v22+) + Express 5 + TypeScript (ESM)
│   ├── migrations/               # Versioned PostgreSQL SQL DDL migrations
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_create_indexes_and_constraints.sql
│   │   ├── 003_rls_policies.sql
│   │   └── 004_seed_data.sql
│   ├── src/
│   │   ├── config/               # Zod-validated environment runtime configuration
│   │   ├── constants/            # 13 approved academic programs, legal pipeline states
│   │   ├── controllers/          # HTTP request handlers
│   │   ├── database/             # PostgreSQL pool (`pg`), transactions & Supabase client
│   │   ├── integrations/         # AI (Groq, Gemini), Email (Resend, SMTP), Storage (Cloudinary)
│   │   ├── middlewares/          # JWT/Supabase Auth, Rate limiting, Zod validation, Multer
│   │   ├── repositories/         # Relational database access layers (Supabase PostgreSQL)
│   │   ├── routes/               # Express routes
│   │   ├── schemas/              # Zod validation schemas
│   │   ├── services/             # Core business logic (Eligibility, Scheduler, Excel, etc.)
│   │   ├── types/                # Backend types & database schemas
│   │   ├── utils/                # ApiError, ApiResponse, asyncHandler, params
│   │   ├── app.ts                # Express application configuration
│   │   └── server.ts             # Server entry point & reminder worker
│   ├── tests/                    # Unit tests (`node:test`)
│   ├── .env                      # Local backend environment variables
│   ├── .env.example              # Template for backend environment
│   ├── package.json
│   └── tsconfig.json
│
├── render.yaml                   # Infrastructure-as-Code blueprint for Render
└── README.md                     # You are here
```

---

## 🛠️ Prerequisites

- **Node.js**: `v20.0.0` or higher (tested with `v22.18.0`)
- **npm**: `v10.0.0` or higher
- **Supabase Account**: A Supabase project (Free or Pro tier) with PostgreSQL

---

## ⚙️ Environment Configuration

### 1. Frontend (`campus_flow2/frontend/.env`)

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-anon-key
```

### 2. Backend (`campus_flow2/major-backend/.env`)

```env
PORT=8000
NODE_ENV=development

# Supabase PostgreSQL Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres

# Security Secrets
JWT_SECRET=campusflow_production_jwt_secret_key_minimum_32_characters_long
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_EXPIRY=10d

# CORS & Routing
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173

# Transactional Email (Resend Recommended)
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_resend_api_key_here
EMAIL_FROM="CampusFlow Placements <onboarding@resend.dev>"

# AI Integration Credentials
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Document & Resume Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
```

---

## 🗄️ Database Setup & Migrations

CampusFlow V3 provides reproducible, versioned SQL migrations in `major-backend/migrations/`.

To apply the schema to your Supabase PostgreSQL instance:

1. Open your Supabase Dashboard: **SQL Editor**.
2. Run the migration scripts in sequential order:
   - `001_initial_schema.sql` (Creates all 13 relational tables, enums, and foreign keys)
   - `002_create_indexes_and_constraints.sql` (Creates b-tree indexes and auto-updating `updated_at` trigger)
   - `003_rls_policies.sql` (Enables Row-Level Security for authenticated students and admins)
   - `004_seed_data.sql` (Seeds 13 accredited programs and the active 2025-2026 placement session)

Alternatively, run the automated migration tool from the backend:
```bash
cd major-backend
npm run migrate
```

---

## 🏃 Local Development

### Starting the Backend
```bash
cd campus_flow2/major-backend
npm install
npm run dev
```
The API starts at `http://localhost:8000`. Health check endpoint: `http://localhost:8000/api/v1/health`.

### Starting the Frontend
```bash
cd campus_flow2/frontend
npm install
npm run dev
```
The application opens in your browser at `http://localhost:5173`.

---

## 🧪 Testing & Verification Commands

### Backend
```bash
cd campus_flow2/major-backend

# Type-check TypeScript codebase
npm run typecheck

# Run unit tests
npm test

# Build production bundle to dist/
npm run build
```

### Frontend
```bash
cd campus_flow2/frontend

# Type-check TypeScript codebase
npm run typecheck

# Build production bundle to dist/
npm run build
```

---

## 🚢 Deployment Guide

### Deploying Frontend to Vercel
1. Set the Root Directory to `frontend`.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Environment Variables:
   - `VITE_API_URL`: Your deployed Render backend URL (e.g. `https://campusflow-api.onrender.com/api/v1`).
   - `VITE_SUPABASE_URL`: Your Supabase URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase publishable anon key.

### Deploying Backend to Render
1. Create a **Web Service** on Render pointing to your repository.
2. Root Directory: `major-backend`.
3. Runtime: **Node**.
4. Build Command: `npm install && npm run build`.
5. Start Command: `npm start`.
6. Environment Variables: Populate all variables as listed in `major-backend/.env.example`.
7. Optional: Launch a **Background Worker** using the provided `render.yaml` blueprint to execute scheduled reminders independently.

---

## 🔐 Security Standards Implemented

- **No Public Service Keys**: Supabase service-role keys are strictly server-side and never exposed to Vite.
- **Formula Injection Defense**: All user-generated text exported to `.xlsx` / `.csv` is sanitized to neutralize spreadsheet execution vectors (`=`, `+`, `-`, `@`).
- **Deterministic Eligibility**: Student eligibility is calculated strictly on the backend using 11 verifiable criteria, preventing client-side spoofing.
- **Audience Isolation**: AI Copilot & Student Support queries enforce role-level boundaries so students cannot inspect other students' records or unreleased placement drives.
