# Live OCR Setup

The helper script uses whatever Supabase project is currently configured in the root `.env`.
For shared development, this should be the team project rather than a personal test project.

This project already has the live OCR code path wired into the Supabase Edge Function:

- function: `analyze-prescription`
- primary OCR provider: Google Document AI `OCR_PROCESSOR`
- fallback OCR provider: Azure Document Intelligence `prebuilt-read`

## Required Google Document AI values

- `GOOGLE_DOCUMENT_AI_PROJECT_ID`
  - your Google Cloud project ID
- `GOOGLE_DOCUMENT_AI_LOCATION`
  - processor region, usually `us`
- `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`
  - the OCR processor ID
- `GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_BASE64`
  - the full service account JSON file, base64-encoded

## Easier local option

Instead of manually base64-encoding the JSON key, put the path in:

```env
GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_FILE=/absolute/path/to/your-service-account.json
```

The helper script will convert it automatically before pushing the secret to Supabase.

## Example `.env`

```env
SUPABASE_PROJECT_URL=https://YOUR_PROJECT_REF.supabase.co
GOOGLE_DOCUMENT_AI_PROJECT_ID=medco-495411
GOOGLE_DOCUMENT_AI_LOCATION=us
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=YOUR_PROCESSOR_ID
GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_FILE=/absolute/path/to/your-service-account.json
```

## Turn live OCR on

Run:

```bash
npm run ocr:enable-live
```

What this does:

1. reads the Google Document AI values from the root `.env`
2. base64-encodes the service account JSON if a file path is provided
3. stores the values as Supabase Edge Function secrets
4. redeploys `analyze-prescription`

## Expected result

After that, run the prescription flow again in the app.

The processing screen should stop showing:

- `OCR mode: mock`
- `Provider: mock-seeded`

and instead show the live OCR provider.

## Optional Azure fallback

If you ever want to use Azure instead, the script still supports:

- `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`
- `AZURE_DOCUMENT_INTELLIGENCE_KEY`
