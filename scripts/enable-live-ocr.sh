#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
FUNCTION_NAME="analyze-prescription"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

PROJECT_URL="${SUPABASE_PROJECT_URL:-${EXPO_PUBLIC_SUPABASE_URL:-}}"
GOOGLE_PROJECT_ID="${GOOGLE_DOCUMENT_AI_PROJECT_ID:-}"
GOOGLE_LOCATION="${GOOGLE_DOCUMENT_AI_LOCATION:-}"
GOOGLE_PROCESSOR_ID="${GOOGLE_DOCUMENT_AI_PROCESSOR_ID:-}"
GOOGLE_SERVICE_ACCOUNT_B64="${GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_BASE64:-}"
GOOGLE_SERVICE_ACCOUNT_FILE="${GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_FILE:-}"
AZURE_ENDPOINT="${AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT:-}"
AZURE_KEY="${AZURE_DOCUMENT_INTELLIGENCE_KEY:-}"

if [[ -z "$PROJECT_URL" ]]; then
  echo "Missing SUPABASE_PROJECT_URL (or EXPO_PUBLIC_SUPABASE_URL) in $ENV_FILE"
  exit 1
fi

PROJECT_REF="$(echo "$PROJECT_URL" | sed -E 's#https?://([^.]+)\..*#\1#')"

if [[ -z "$PROJECT_REF" ]]; then
  echo "Unable to determine Supabase project ref from $PROJECT_URL"
  exit 1
fi

if command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD=(supabase)
elif [[ -x /usr/local/bin/node && -f /usr/local/lib/node_modules/npm/bin/npx-cli.js ]]; then
  SUPABASE_CMD=(/usr/local/bin/node /usr/local/lib/node_modules/npm/bin/npx-cli.js supabase)
else
  echo "Supabase CLI was not found. Install it or run through npx before retrying."
  exit 1
fi

if [[ -z "$GOOGLE_SERVICE_ACCOUNT_B64" && -n "$GOOGLE_SERVICE_ACCOUNT_FILE" ]]; then
  GOOGLE_SERVICE_ACCOUNT_B64="$(base64 < "$GOOGLE_SERVICE_ACCOUNT_FILE" | tr -d '\n')"
fi

if [[ -n "$GOOGLE_PROJECT_ID" || -n "$GOOGLE_LOCATION" || -n "$GOOGLE_PROCESSOR_ID" || -n "$GOOGLE_SERVICE_ACCOUNT_B64" ]]; then
  if [[ -z "$GOOGLE_PROJECT_ID" ]]; then
    echo "Missing GOOGLE_DOCUMENT_AI_PROJECT_ID in $ENV_FILE"
    exit 1
  fi

  if [[ -z "$GOOGLE_LOCATION" ]]; then
    echo "Missing GOOGLE_DOCUMENT_AI_LOCATION in $ENV_FILE"
    exit 1
  fi

  if [[ -z "$GOOGLE_PROCESSOR_ID" ]]; then
    echo "Missing GOOGLE_DOCUMENT_AI_PROCESSOR_ID in $ENV_FILE"
    exit 1
  fi

  if [[ -z "$GOOGLE_SERVICE_ACCOUNT_B64" ]]; then
    echo "Missing GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_BASE64 or GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_FILE in $ENV_FILE"
    exit 1
  fi

  echo "Setting Google Document AI secrets on Supabase project $PROJECT_REF..."
  "${SUPABASE_CMD[@]}" secrets set \
    GOOGLE_DOCUMENT_AI_PROJECT_ID="$GOOGLE_PROJECT_ID" \
    GOOGLE_DOCUMENT_AI_LOCATION="$GOOGLE_LOCATION" \
    GOOGLE_DOCUMENT_AI_PROCESSOR_ID="$GOOGLE_PROCESSOR_ID" \
    GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_BASE64="$GOOGLE_SERVICE_ACCOUNT_B64" \
    --project-ref "$PROJECT_REF"
elif [[ -n "$AZURE_ENDPOINT" || -n "$AZURE_KEY" ]]; then
  if [[ -z "$AZURE_ENDPOINT" ]]; then
    echo "Missing AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT in $ENV_FILE"
    exit 1
  fi

  if [[ -z "$AZURE_KEY" ]]; then
    echo "Missing AZURE_DOCUMENT_INTELLIGENCE_KEY in $ENV_FILE"
    exit 1
  fi

  echo "Setting Azure OCR secrets on Supabase project $PROJECT_REF..."
  "${SUPABASE_CMD[@]}" secrets set \
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="$AZURE_ENDPOINT" \
    AZURE_DOCUMENT_INTELLIGENCE_KEY="$AZURE_KEY" \
    --project-ref "$PROJECT_REF"
else
  echo "No live OCR provider configuration found in $ENV_FILE"
  exit 1
fi

echo "Redeploying $FUNCTION_NAME with live OCR secrets..."
"${SUPABASE_CMD[@]}" functions deploy "$FUNCTION_NAME" --no-verify-jwt --project-ref "$PROJECT_REF"

echo
echo "Live OCR is now configured for $FUNCTION_NAME."
echo "Run the prescription flow again and the processing step should stop using mock-seeded data."
