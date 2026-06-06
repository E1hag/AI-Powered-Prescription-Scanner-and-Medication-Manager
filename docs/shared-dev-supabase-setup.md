# Shared Dev Supabase Setup

This project now treats the team Supabase project as the default shared development backend.

## Local app environment

The mobile app reads its public Supabase values from:

- `app/.env`

Required values:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

## Root environment

Helper scripts and backend deployment utilities read from:

- `.env`

Required values:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_PROJECT_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
GOOGLE_DOCUMENT_AI_PROJECT_ID=YOUR_GOOGLE_PROJECT_ID
GOOGLE_DOCUMENT_AI_LOCATION=us
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=YOUR_PROCESSOR_ID
GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_FILE=/absolute/path/to/your-service-account.json
```

## Local Supabase linkage

The local project linkage files under `supabase/.temp/` should point at the team project ref so
future CLI operations target the shared backend by default.

## After env changes

Restart Expo so the mobile app picks up the new public environment values.

```bash
cd /Users/moham/Desktop/AI-Powered-Prescription-Scanner-and-Medication-Manager-1
HOME=/tmp/expo-home EXPO_NO_TELEMETRY=1 PATH=/usr/local/bin:$PATH /usr/local/bin/node /usr/local/lib/node_modules/npm/bin/npm-cli.js --workspace app run start
```

## OCR deployment

To push the Google Document AI secrets and redeploy the OCR function, use:

```bash
npm run ocr:enable-live
```

That command reads `.env`, pushes the live OCR secrets to Supabase, and redeploys
`analyze-prescription`.
