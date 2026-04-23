# Required GitHub Actions Secrets

Add these in **Settings → Secrets and variables → Actions** on your GitHub repo.

## Vercel (deploy.yml)

| Secret | How to get it |
|--------|---------------|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | `vercel env ls` output, or `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | Same as above |

### Linking the project

```bash
npm i -g vercel
vercel login
vercel link        # creates .vercel/project.json with org + project IDs
cat .vercel/project.json
```

## Vercel environment variables

The deploy workflow pulls environment variables from Vercel automatically via `vercel pull`.
Set these in your Vercel project dashboard (Settings → Environment Variables) rather than as GitHub secrets:

- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `AUTH_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GITHUB_ID` / `GITHUB_SECRET`
- `APPLE_ID` / `APPLE_CLIENT_SECRET`
- `BLOB_READ_WRITE_TOKEN` (auto-provisioned when you add Blob storage)

## Database migrations

Migrations are **not** run automatically by the deploy workflow.
Run them manually when the schema changes:

```bash
POSTGRES_URL_NON_POOLING=<direct-url> npx prisma migrate deploy
```

Or add a one-off migration job to `deploy.yml` (requires `POSTGRES_URL_NON_POOLING` as a GitHub secret).
