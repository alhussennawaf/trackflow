# JAK - flowTracker website

The web app for JAK staff and outside companies, served at **app.jadahalkhozama.com**. It talks directly to the Supabase backend in `../supabase`; every permission is enforced there.

- **Staff** sign in with Microsoft 365 and get the internal app: Home, Requests, Reports, Contractors, Content / Files, Tasks, Risks, Admin.
- **Contractors, consultants and suppliers** sign in with an emailed code after a manager invites them, and get the company portal: their own documents, files shared with them and tasks for their company.

## Run locally

```bash
cd web
npm install
cp .env.example .env.local   # points at the live project; change it to use a local Supabase
npm run dev                  # http://localhost:5173
```

## Build

```bash
npm run build                # static site in web/dist
```

`.env.production` holds the Supabase URL and publishable key used by production builds. Both are public by design; never put a secret key in this folder.

## Host on Cloudflare Pages

Workers & Pages → Create → Pages → Connect to Git → the trackflow repository, then:

| Setting | Value |
| --- | --- |
| Production branch | the branch to publish |
| Root directory | `web` |
| Build command | `npm run build` |
| Build output directory | `dist` |

`public/_redirects` sends every path to the app, so links like `/documents/…` open directly. Add the custom domain `app.jadahalkhozama.com` in the Pages project and create the CNAME record it shows at the domain's DNS provider (Squarespace).

## Supabase settings the website needs

- Authentication → URL Configuration: Site URL `https://app.jadahalkhozama.com`; Redirect URLs `https://app.jadahalkhozama.com/**` and `http://localhost:5173/**`.
- Authentication → Email Templates: the **Magic Link** and **Confirm signup** templates must show the code with `{{ .Token }}`, because the site asks for the code rather than a link.
- Authentication → SMTP: a real sender (for example a jadahalkhozama.com mailbox), since Supabase's built-in sender only reaches the project's own team.
