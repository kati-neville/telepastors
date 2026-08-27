# Telepastors Ministry Platform

Production web application for the First Love Church Telepastors Ministry — campaign contact management, hierarchical assignment, mobile calling, reporting, SMS broadcasts, and WhatsApp message templates.

## Stack

- **Next.js** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui
- **Supabase** (Auth, Postgres, RLS, Storage)
- **Framer Motion** (subtle mobile animations)

## Ministry roles

| Role | Capabilities |
|------|-------------|
| **SUPER_ADMIN** | Full access; campaigns; Excel import; broadcasts; role changes |
| **GOVERNOR** | Manage campaigns; assign to Leaders; org reports; templates |
| **LEADER** | Assign to Telepastors; team reports; templates |
| **TELEPASTOR** | My Calls queue; manual WhatsApp; own stats |

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

See [Required environment variables](#required-environment-variables) below.

### 3. Apply database migrations

Run all SQL files in `supabase/migrations/` **in order** against your Supabase project:

1. `20240827000001_initial_schema.sql`
2. `20240827000002_profile_pictures_storage.sql`
3. `20240827000003_campaigns_contacts.sql`
4. `20240827000004_contact_assignments.sql`
5. `20240827000005_call_attempts.sql`
6. `20240827000006_sms_broadcasts.sql`
7. `20240827000007_audit_logs.sql`
8. `20240827000008_fix_assignment_reassignment_rls.sql`

### 4. Bootstrap the first Super Admin

```bash
npm run bootstrap:super-admin
```

### 5. Seed test users (optional, local dev)

Creates one account per role with password `password`:

```bash
npm run seed:test-users
```

| Role | Email |
|------|-------|
| Super Admin | `superadmin@test.telepastors.local` |
| Governor | `governor@test.telepastors.local` |
| Leader | `leader@test.telepastors.local` |
| Telepastor | `telepastor@test.telepastors.local` |

Override the email domain with `SEED_EMAIL_DOMAIN` in `.env.local`. The script is idempotent — re-running updates passwords and profile links.

### 6. Start the dev server

```bash
npm run dev
```

## Required environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Bootstrap only | Server-only; bootstrap script only |
| `BOOTSTRAP_ADMIN_*` | Bootstrap only | First Super Admin credentials |
| `SMS_PROVIDER` | Optional | Set to `twilio` to enable SMS |
| `TWILIO_*` | If SMS | Twilio credentials |
| `NEXT_PUBLIC_WHATSAPP_MESSAGE_TEMPLATE` | Optional | Fallback WhatsApp template |

## Deployment checklist

- [ ] All 7 migrations applied to production Supabase
- [ ] Super Admin bootstrapped
- [ ] Environment variables set in hosting platform
- [ ] `SUPABASE_SERVICE_ROLE_KEY` not exposed to client bundle
- [ ] Supabase Auth Site URL and redirect URLs configured
- [ ] Storage bucket `profile-pictures` exists
- [ ] SMS provider configured (if needed) or accept `UNAVAILABLE` status
- [ ] `npm run typecheck && npm run lint && npm run build` pass
- [ ] Phase test suites pass
- [ ] Verify login, role-based nav, My Calls on mobile

## External services

| Service | Required | Notes |
|---------|----------|-------|
| **Supabase** | Yes | Auth, database, storage |
| **Twilio** | Optional | SMS broadcasts only |
| **WhatsApp** | N/A | Manual links only |

## Security model

- **Authentication**: Supabase Auth; inactive users blocked at session load
- **Authorization**: App checks + server guards + Postgres RLS
- **Audit logging**: Important actions in `audit_logs` (Super Admin read via RLS)
- **Service role**: Bootstrap script only, never in request handlers

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test:phase3` … `test:phase8` | Unit test suites |
| `npm run bootstrap:super-admin` | Create first Super Admin |
