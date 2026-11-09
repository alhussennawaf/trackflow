# JAK - flowTracker backend (Supabase)

The new backend: one database shared by JAK staff and outside companies, with every permission enforced in the database itself.

- `migrations/` — the database, applied in filename order
  - `…_core.sql` tables, permission rules, sign-up rules, numbering and workflows
  - `…_storage.sql` the private `files` bucket and its rules
  - `…_seed.sql` company settings, the 29 document types and their workflows, trade and level codes
- `tests/` — runs the migrations on a local PostgreSQL and checks every rule by acting as each kind of user
- `schema.sql` — **old** schema used by the current proof-of-concept app. Not part of the new backend.

## What it does

| Area | How it works |
| --- | --- |
| Sign-up | No public sign-up. The first account becomes admin. Microsoft 365 accounts on `jadahalkhozama.com` become staff. Anyone else needs an open invitation, otherwise the sign-up is refused. |
| Outside users | Invited by a manager (`invite_external`) for one company, chosen projects and an end date. After the end date they see nothing. |
| Visibility | Staff see projects by role and membership. Outside users see only their company's records on their invited projects, never internal comments, risks or other companies. |
| Reference numbers | Given by the database on submit: `SKY-SUB-SCC-CV-EX-GL-001-0`. Safe when many people submit at once. A new revision keeps the number and adds 1 to the last part. |
| Workflows | Status changes only through `act_on_document`, following the `doc_transitions` table: submittals A–D, inspections, RFIs, reports, instructions, NCRs, invoices. |
| Files | A file row is created first; the database picks its storage path; storage allows upload and download only to people who can see that row. |
| History | Every change to companies, users, projects, documents, comments, files, tasks and risks is recorded in `audit_log` (admins only). |

Settings that may change later live in `org_settings`, for example `sequence_scope` (`full`: the 001 counter is separate for each project + type + company + trade + level; `type`: one counter per project + type).

## Server functions the app calls

| Function | Who | What |
| --- | --- | --- |
| `submit_document(id)` | author or manager | checks a draft, gives it its number, notifies the next person |
| `assign_reviewer(id, reviewer, due)` | manager | sets the JAK reviewer and reply date |
| `act_on_document(id, to_status, reply)` | per workflow | review codes, replies, NCR responses, invoice approval and payment |
| `new_revision(id)` | company or staff | starts revision +1 after C, a failed inspection or a returned invoice |
| `invite_external(email, company, name, projects, end_date)` | manager | invites an outside user |

## Set up a Supabase project

1. Create a project at supabase.com (region close to Saudi Arabia, e.g. Frankfurt or Mumbai).
2. Apply the three migration files in order: SQL Editor → paste each file → Run. Or with the Supabase CLI: `supabase link` then `supabase db push`.
3. Authentication → Sign In / Providers:
   - **Azure**: on, with the client ID, secret and tenant URL from the Microsoft Entra app registration.
   - **Email**: on, with **Confirm email** on. Outside users sign in with an emailed one-time code.
   - Keep **Allow new users to sign up** on. The database refuses anyone who isn't JAK staff or invited.
4. Sign in first with the account that should be the administrator.

## Run the tests

Needs PostgreSQL 15 or newer running locally.

```bash
supabase/tests/run.sh
```

It creates a throwaway database, applies the migrations and prints one line per rule checked, ending with `All backend rule tests passed.`
