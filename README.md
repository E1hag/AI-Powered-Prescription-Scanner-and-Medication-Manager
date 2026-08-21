# MEDCO: AI-Powered Prescription Scanner and Medication Manager

[GitHub Repository](https://github.com/E1hag/AI-Powered-Prescription-Scanner-and-Medication-Manager)

MEDCO is a capstone mobile application that helps patients scan prescriptions,
review extracted medication details, generate medication schedules, track dose
adherence, and view medication safety information. The main product is an Expo
React Native app backed by Supabase, with supporting database migrations, edge
functions, a shared parsing/scheduling package, an optional Express backend, and
a Vite website scaffold.

This project provides general medication support only. It is not medical advice
and does not replace guidance from a doctor, pharmacist, or other licensed
healthcare professional.

## Features

- Email/password authentication with Supabase Auth
- Prescription capture from camera or photo library
- Prescription image upload to Supabase Storage
- OCR-backed prescription analysis through a Supabase Edge Function
- Google Document AI configuration for live prescription extraction
- Medication review screen with editable extracted details
- Automatic schedule suggestions based on dosage, frequency, duration, and PRN instructions
- Current medications view grouped by medication and dose schedule
- Daily dose tracking with Taken, Missed, Snoozed, Pending, Due now, Late, and Upcoming states
- Weekly adherence summary and local fallback cache with AsyncStorage
- Dose reminder persistence through Supabase and local storage
- Medical condition profile for allergies, chronic conditions, and notes
- Drug interaction checking against a master interaction table and cached interaction results
- Patient profile, patient code display, clinician access requests, and treatment note visibility
- Rule-based MEDCO chatbot for general medication education

## Tech Stack

- Expo SDK 54
- React Native 0.81
- Expo Router
- TypeScript
- Supabase Auth, Database, Storage, RLS, and Edge Functions
- Google Document AI for prescription OCR extraction
- AsyncStorage for local cache and offline fallback
- React 19 and Vite for the website scaffold
- Express for the optional backend API

## Repository Structure

```text
.
|-- app/                 # Expo Router screens and routes
|-- assets/              # App images and architecture diagrams
|-- backend/             # Optional Express API server
|-- components/          # Shared React Native UI components
|-- constants/           # Theme constants
|-- hooks/               # Shared React Native hooks
|-- lib/                 # Supabase client helpers
|-- packages/shared/     # Shared parser, prescription, and schedule schemas/logic
|-- src/                 # Feature services, hooks, utilities, and Supabase service layer
|-- supabase/            # Database migrations and Edge Functions
|-- website/             # Vite website scaffold
|-- app.json             # Expo app configuration
|-- package.json         # Main mobile app dependencies and scripts
`-- README.md
```

## Prerequisites

- Node.js
- npm
- Expo CLI through `npx expo`
- Expo Go, an iOS simulator, or an Android emulator
- A Supabase project
- Google Document AI processor credentials for live prescription analysis

## Environment Variables

Create a `.env` file in the project root using `.env.example` as a starting
point.

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

GOOGLE_DOCUMENT_AI_PROJECT_ID=your_google_document_ai_project_id_here
GOOGLE_DOCUMENT_AI_LOCATION=us
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=your_google_document_ai_processor_id_here
GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_BASE64=base64_encoded_service_account_json_here
```

The `analyze-prescription` Supabase Edge Function also expects Supabase service
configuration in the Supabase function environment:

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

The function also contains optional Azure Document Intelligence support through
`AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` and `AZURE_DOCUMENT_INTELLIGENCE_KEY`.

## Run the Mobile App

Install dependencies from the project root:

```bash
npm install
```

Start Expo:

```bash
npm run start
```

Useful app commands:

```bash
npm run start:clear
npm run ios
npm run android
npm run web
npm run lint
```

## Supabase Setup

Apply the migrations in `supabase/migrations` to create the prescription,
storage, medication schedule, adherence, reminder, medical profile, clinician
access, treatment note, and drug interaction tables and policies.

Deploy the Edge Functions from `supabase/functions`:

```bash
supabase functions deploy analyze-prescription
supabase functions deploy finalize-schedule
```

Set function secrets for Supabase and Document AI before using live OCR:

```bash
supabase secrets set SUPABASE_URL=your_supabase_project_url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set GOOGLE_DOCUMENT_AI_PROJECT_ID=your_google_project_id
supabase secrets set GOOGLE_DOCUMENT_AI_LOCATION=us
supabase secrets set GOOGLE_DOCUMENT_AI_PROCESSOR_ID=your_processor_id
supabase secrets set GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_KEY_BASE64=your_base64_service_account_json
```

## Optional Backend API

The `backend/` folder contains a small Express API for basic prescription CRUD
experiments against Supabase.

```bash
cd backend
npm install
node server.js
```

The backend expects:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
PORT=5000
```

## Optional Website

The `website/` folder is a React + Vite scaffold.

```bash
cd website
npm install
npm run dev
```

Other website commands:

```bash
npm run build
npm run preview
npm run lint
```

## Key App Flows

1. Register or sign in with Supabase Auth.
2. Capture or upload a prescription image.
3. Upload the image to Supabase Storage.
4. Run prescription analysis through the `analyze-prescription` Edge Function.
5. Review and edit extracted medications.
6. Generate and save a medication schedule.
7. Track dose status from the home and adherence screens.
8. Review current medications, drug interaction results, reminders, and profile data.

## Implementation Notes

- The main completed experience is the root Expo app.
- `website/` is still the default Vite starter and is not the primary product UI.
- `supabase/functions/finalize-schedule` is scaffolded; schedule persistence is handled in the app service layer.
- The app uses AsyncStorage as a local cache when Supabase data cannot be loaded.
- Live prescription scanning requires valid Supabase and Google Document AI configuration.

## Project Status

Completed capstone implementation with mobile app flows, Supabase persistence,
OCR integration wiring, adherence tracking, drug interaction checks, clinician
access visibility, and supporting project infrastructure.
