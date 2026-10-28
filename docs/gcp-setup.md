# Deploying Sofiya to Google Cloud

One-time setup in **your** Google Cloud, Neon and GitHub accounts, then a
deploy from GitHub Actions. Nothing here has been run yet.

What runs where:

| Piece | Service |
|---|---|
| Website (Next.js) | Cloud Run service `sofiya-web` |
| API (NestJS) | Cloud Run service `sofiya-api` |
| Database migrations, demo catalogue | Cloud Run jobs `sofiya-migrate`, `sofiya-seed` (created by the workflow) |
| Database | Neon Postgres with pgvector |
| Book covers | Private Cloud Storage bucket, served by the API at `/api/covers/…` |
| Secrets | Secret Manager |
| Images | Artifact Registry |

Install the gcloud CLI (`brew install --cask google-cloud-sdk`), then run
`gcloud auth login`. Replace the values in this block and keep the terminal
open for the steps below.

```bash
export PROJECT_ID=sofiya-ai-prod          # must be globally unique
export REGION=asia-northeast3             # Seoul
export REPO=sofiya
export BUCKET=$PROJECT_ID-covers          # must be globally unique
export GITHUB_REPO=kakhkhorov97/Sofiya-Bookstore
```

## 1. Project and APIs

```bash
gcloud projects create "$PROJECT_ID"
gcloud config set project "$PROJECT_ID"
# Link billing in the console: Billing → Link a billing account.
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  storage.googleapis.com
export PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
```

Set a budget alert in the console (Billing → Budgets & alerts), for example
$10 a month.

## 2. Artifact Registry and the covers bucket

```bash
gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION"

# Private bucket: covers are served through the API, never directly.
gcloud storage buckets create "gs://$BUCKET" --location="$REGION" \
  --uniform-bucket-level-access --public-access-prevention
```

## 3. Service accounts

```bash
gcloud iam service-accounts create sofiya-deploy --display-name "GitHub deploy"
gcloud iam service-accounts create sofiya-api    --display-name "api runtime"
gcloud iam service-accounts create sofiya-web    --display-name "web runtime"

DEPLOY_SA=sofiya-deploy@$PROJECT_ID.iam.gserviceaccount.com
API_SA=sofiya-api@$PROJECT_ID.iam.gserviceaccount.com
WEB_SA=sofiya-web@$PROJECT_ID.iam.gserviceaccount.com

# GitHub deploys images, services and jobs, running them as the runtime accounts.
for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$DEPLOY_SA" --role "$role"
done

# The API reads and writes covers in the bucket, and nothing else.
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member "serviceAccount:$API_SA" --role roles/storage.objectAdmin
```

## 4. Workload Identity Federation (GitHub signs in without keys)

```bash
gcloud iam workload-identity-pools create github --location=global
gcloud iam workload-identity-pools providers create-oidc github \
  --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='$GITHUB_REPO'"

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GITHUB_REPO"
```

## 5. Neon database

1. Create a project at neon.tech in the region nearest to `$REGION` that
   Neon offers (check the list when creating the project).
2. In the SQL editor run `CREATE EXTENSION IF NOT EXISTS vector;`
3. Copy the **pooled** connection string (host contains `-pooler`, ends with
   `?sslmode=require`). It goes into the `sofiya-database-url` secret below.

## 6. Secrets

The names must match the deploy workflow exactly. `printf` avoids a trailing
newline; paste each value at the prompt instead of typing it into the command
so it does not end up in your shell history.

```bash
read -rs DB_URL && printf '%s' "$DB_URL" | gcloud secrets create sofiya-database-url --data-file=- && unset DB_URL
read -rs GEMINI && printf '%s' "$GEMINI" | gcloud secrets create sofiya-gemini-api-key --data-file=- && unset GEMINI
# Toss Payments secret key: test_sk_… while testing, live_sk_… for real money.
read -rs TOSS && printf '%s' "$TOSS" | gcloud secrets create sofiya-toss-secret-key --data-file=- && unset TOSS
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create sofiya-auth-secret --data-file=-
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create sofiya-proxy-secret --data-file=-

# The API reads all five; the website only the proxy secret.
for s in sofiya-database-url sofiya-gemini-api-key sofiya-toss-secret-key sofiya-auth-secret sofiya-proxy-secret; do
  gcloud secrets add-iam-policy-binding "$s" --member "serviceAccount:$API_SA" --role roles/secretmanager.secretAccessor
done
gcloud secrets add-iam-policy-binding sofiya-proxy-secret \
  --member "serviceAccount:$WEB_SA" --role roles/secretmanager.secretAccessor
```

`sofiya-proxy-secret` lets the API trust the visitor IP that the website
passes on, so rate limits apply per visitor instead of to everyone at once.

## 7. GitHub repository variables

Cloud Run addresses are predictable, so both URLs can be filled in before the
first deploy. Print them with:

```bash
echo "https://sofiya-web-$PROJECT_NUMBER.$REGION.run.app"
echo "https://sofiya-api-$PROJECT_NUMBER.$REGION.run.app/api"
```

In GitHub → Settings → Secrets and variables → Actions → **Variables**:

| Variable | Value |
|---|---|
| `GCP_PROJECT_ID` | your project id |
| `GCP_REGION` | e.g. `asia-northeast3` |
| `GCP_ARTIFACT_REPO` | `sofiya` |
| `GCP_WIF_PROVIDER` | `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/providers/github` |
| `GCP_DEPLOY_SA` | `sofiya-deploy@<PROJECT_ID>.iam.gserviceaccount.com` |
| `GCP_API_RUNTIME_SA` | `sofiya-api@<PROJECT_ID>.iam.gserviceaccount.com` |
| `GCP_WEB_RUNTIME_SA` | `sofiya-web@<PROJECT_ID>.iam.gserviceaccount.com` |
| `GCS_BUCKET` | the bucket name (`$BUCKET`, without `gs://`) |
| `WEB_ORIGINS` | the website URL (first `echo` above; add your own domain later, comma-separated) |
| `API_URL` | the API URL ending in `/api` (second `echo` above) |
| `CLIENT_IP_HOPS` | optional: `1` (default). Use `2` if you put a Google load balancer in front later |
| `TOSS_CLIENT_KEY` | Toss Payments client key (`test_ck_…` or `live_ck_…`; public by design) |
| `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_HOLDER` | shown to customers who pay by bank transfer |

None of these are secrets; real secrets stay in Secret Manager.

## 7b. Optional: emails (Resend) and shared limits (Upstash Redis)

Both are free at low volume, and the site works without them: without
email, "Forgot password" says it isn't available and no order emails go
out; without Redis, each API instance keeps its own rate limits.

**Emails with Resend**

1. Create an account at resend.com, add and verify your domain (it gives
   you DNS records to add), and create an API key.
2. Store the key and switch email on:

```bash
read -rs RESEND && printf '%s' "$RESEND" | gcloud secrets create sofiya-resend-api-key --data-file=- && unset RESEND
gcloud secrets add-iam-policy-binding sofiya-resend-api-key \
  --member "serviceAccount:$API_SA" --role roles/secretmanager.secretAccessor
```

3. GitHub variables: `EMAIL_PROVIDER` = `resend`, `EMAIL_FROM` =
   `Sofiya <hello@your-domain>` (an address on the verified domain).

**Shared limits with Upstash Redis**

1. Create a Redis database at upstash.com in the region nearest
   `$REGION`, and copy its `rediss://…` connection string (with password).
2. Store it and switch it on:

```bash
read -rs REDIS && printf '%s' "$REDIS" | gcloud secrets create sofiya-redis-url --data-file=- && unset REDIS
gcloud secrets add-iam-policy-binding sofiya-redis-url \
  --member "serviceAccount:$API_SA" --role roles/secretmanager.secretAccessor
```

3. GitHub variable: `USE_REDIS` = `true`.

If Redis is ever unreachable, the API falls back to per-instance memory
limits instead of failing.

## 8. First deploy

1. Push the `v2` branch to GitHub.
2. GitHub → Actions → **Deploy to Cloud Run** → Run workflow, on `v2`,
   service **both**, and tick **Load the demo catalogue** (first time only:
   it resets prices and stock of the demo books).
3. The workflow runs the checks, builds both images, applies migrations,
   loads the catalogue, then deploys the API and the website.

## 9. After the first deploy

Create your admin account from your Mac against the production database
(Node's `--env-file` keeps a variable you set yourself, so this does not
touch your local database):

```bash
read -rs DATABASE_URL && export DATABASE_URL
npm run db:create-admin -w @sofiya/api -- you@example.com 'a long password' "Your Name"
unset DATABASE_URL
```

Then sign in on the website, open **Admin → AI & search** and press
**Re-index** to build the Ask Sofiya search index (about two minutes on the
Gemini free tier).

Quick checks:

- `https://<web>/api/health` answers with the deployed version.
- Upload a cover in the admin, redeploy, and check the cover is still there.
- Ask Sofiya answers a question.
- With Toss **test** keys, pay for an order with a test card: the order
  becomes "Paid · Card" and is confirmed; cancelling it in the admin refunds
  it. Switch to live keys only after signing a contract with Toss.

## Later deploys

Run the workflow again with service **api**, **web** or **both**, and leave
**Load the demo catalogue** unticked. New migrations are applied
automatically before the new API version takes traffic.

## Costs to expect

- Cloud Run scales to zero when nobody visits. The API runs with
  `--no-cpu-throttling` so background work (re-indexing after a save)
  finishes; that bills for the whole time an instance is up, which is still
  small at low traffic.
- Neon's free plan is enough to start.
- Gemini: the free tier covers light use; `AI_DAILY_CAP` (default 200
  questions a day) limits spending.
