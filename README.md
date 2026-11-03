# JAK Projects

Construction project management app for **Jadah Al Khozama International**. One codebase builds the **Android app** and the **web app** (Expo / React Native + react-native-web). Data lives in **Supabase** (Postgres, login, file storage). Without Supabase keys the app runs in **demo mode** with sample data stored on the device.

## Modules

| Module | What it does |
| --- | --- |
| Login & security | Email + password per user, then a 4-digit PIN on each device, plus fingerprint / Face ID on Android. Auto-locks after 1 minute in the background; 5 wrong PINs signs the user out. |
| Dashboard | Check-in card, KPIs (active projects, open / overdue tasks, submittals awaiting reply, staff on site), quick actions, my tasks, submittal status bar, project progress, today's attendance. |
| Tasks | List and board views, assign to any user (they get a notification and see it when they sign in), priority, due date, location, filters. |
| Projects | Cards with progress, detail page with tabs: overview, tasks, submittals, contractors, photos, team. Project code drives document numbering. |
| Submittals | 16 document types: SD, MAS, MIR, WIR, RFI, MS, ITP, PQ, SAM, ABD, NCR, SI, CVI, VOR, TR, PAY. Each has its own fields, auto numbering (`NRJ-MIR-013`), revisions, reviewer, review codes A/B/C/D, attachments and a **branded PDF with the company logo**. |
| Contractors | One folder set per company: Contractor Documents, Contracts, Submittals, RFIs, MIRs, Invoices, Others. Submittals raised in the app file themselves into the right folder. Invoices track amount and pending / approved / paid. |
| Attendance | Morning check-in / check-out with time and GPS, late detection (start time + grace), monthly calendar, HR team sheet to correct days or mark leave. |
| Salary sheet | Monthly payroll from attendance: absent days (basic ÷ 30), late deductions, overtime. Export PDF or CSV (Excel). Rules are editable. |
| Photo gallery | Per project, browse folders by scope of work, building section or category. Upload from camera or gallery; images are resized before upload. |
| Daily reports | Weather, manpower, equipment, work done, issues; PDF export. |
| Search | One search box across projects, submittals (including type fields like material or drawing numbers), tasks, contractors, files, photos, reports and people. |
| Team & users | Admin / HR add users with role, job title, employee no. and salary. |
| Settings | Six colour themes (Khozama Navy, Lavender, Site Orange, Emerald, Desert Sand, Steel Grey), light / dark / automatic, change PIN / password, biometrics. |

Roles: **Administrator**, **Project Manager** (create projects, assign work, review), **Engineer**, **Employee** (own tasks), **Accountant / HR** (attendance and salaries).

## Try it

```bash
npm install
npm run web          # opens http://localhost:8081
```

In demo mode tap one of the demo accounts on the sign-in page (password `demo1234`).

## Connect the real server (Supabase)

1. Create a free project at supabase.com.
2. SQL Editor → paste `supabase/schema.sql` → Run. It creates the tables, the `files` storage bucket and the security rules.
3. Authentication → Sign In / Providers → Email: turn **Confirm email** off (the admin creates accounts for staff).
4. Copy `.env.example` to `.env` and paste the Project URL and anon key from Project Settings → API.
5. Create the first account in the Supabase dashboard: Authentication → Users → Add user (email + password, auto-confirm). The **first account becomes Administrator** automatically. Sign in to the app with it.
6. The admin adds everyone else from **Team & users** with a temporary password.

Security is enforced in the database (row-level security), not only in the app: staff cannot change their own role, salaries are only visible to HR / managers (and to the employee themselves), attendance is visible to its owner and HR, and only managers create projects and contractors.

## Build the Android app

```bash
npm install -g eas-cli   # or use npx eas-cli@latest
eas login                # free Expo account
npm run build:apk        # builds an installable .apk in the cloud
```

Put the Supabase keys in EAS as environment variables (`eas env:create`) or in `.env` before building. For the Play Store use `eas build -p android --profile production`.

### Lightweight APK without Expo cloud (`android-shell/`)

`android-shell/` is a small native Android app (about 1 MB) that runs the web build inside a WebView and adds native features through a `JakNative` bridge (`src/lib/native.ts`): fingerprint/face unlock, A4 PDF printing and saving, saving CSV files to Downloads, opening attachments, camera capture, location for check-in and the hardware back button.

```bash
# needs: openjdk, aapt, apksigner, zipalign, dalvik-exchange, android-sdk-platform-23 (Ubuntu packages)
android-shell/build.sh path/to/release.keystore KEYSTORE_PASSWORD
# → android-shell/build/JAK-Projects.apk
```

Set the Supabase keys in `.env` before building so the APK talks to the real server. Always sign updates with the same keystore, or phones will refuse to install the update. Bump `versionCode` in `android-shell/AndroidManifest.xml` for each release.

## Deploy the web app

```bash
npm run build:web        # static site in dist/
```

Upload `dist/` to any static host (Netlify, Vercel, Cloudflare Pages, Firebase Hosting, or the company server).

## Project layout

```
App.tsx                 providers + screen router
src/auth/               sign-in, PIN, biometric lock
src/data/               types, catalog (document types, statuses), backend (Supabase / demo), store, demo seed
src/screens/            one file per module
src/components/         UI kit, app shell (sidebar / bottom tabs), navigation
src/pdf/                PDF letterhead and templates (logo embedded in logoData.ts)
src/lib/                dates, files, payroll maths
supabase/schema.sql     database, storage and security
```
