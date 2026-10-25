# Google Cloud setup (milestone 0)

These steps run in **your** Google Cloud account. Nothing here has been run yet. Install the gcloud CLI first (`brew install --cask google-cloud-sdk`), then `gcloud auth login`.

Replace the values in the first block, then run the rest in order.

```bash
export PROJECT_ID=sofiya-ai-prod        # must be globally unique
export REGION=asia-northeast3           # Seoul; use us-central1 if you prefer
export REPO=sofiya
export GITHUB_REPO=kakhkhorov97/Sofiya-Bookstore
```

## 1. Project and APIs

```bash
gcloud projects create "$PROJECT_ID"
gcloud config set project "$PROJECT_ID"
# Link billing in the console: Billing → Link a billing account.
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iamcredentials.googleapis.com \
  cloudtasks.googleapis.com cloudscheduler.googleapis.com storage.googleapis.com
```

Set a budget alert in the console (Billing → Budgets & alerts), e.g. $10/month.

## 2. Artifact Registry

```bash
gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION"
```

## 3. Service accounts

```bash
gcloud iam service-accounts create sofiya-deploy --display-name "GitHub deploy"
gcloud iam service-accounts create sofiya-api    --display-name "api runtime"
gcloud iam service-accounts create sofiya-web    --display-name "web runtime"

DEPLOY_SA=sofiya-deploy@$PROJECT_ID.iam.gserviceaccount.com
for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$DEPLOY_SA" --role "$role"
done
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:sofiya-api@$PROJECT_ID.iam.gserviceaccount.com" \
  --role roles/secretmanager.secretAccessor
```

## 4. Workload Identity Federation (GitHub → GCP without keys)

```bash
gcloud iam workload-identity-pools create github --location=global
gcloud iam workload-identity-pools providers create-oidc github \
  --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='$GITHUB_REPO'"

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GITHUB_REPO"
```

## 5. Secrets (filled in during milestones 1 and 5)

```bash
printf '%s' 'postgresql://...' | gcloud secrets create DATABASE_URL --data-file=-
printf '%s' 'your-gemini-key'  | gcloud secrets create GEMINI_API_KEY --data-file=-
```

Mount them on the api service later with `--set-secrets DATABASE_URL=DATABASE_URL:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest`.

## 6. GitHub repository variables

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
| `WEB_ORIGINS` | the web service URL (after the first web deploy) |
| `API_URL` | the api service URL + `/api` |

## 7. Neon

Create a project at neon.tech in the region closest to `$REGION`, enable the `vector` extension (`CREATE EXTENSION vector;`), and store the pooled connection string as the `DATABASE_URL` secret.
