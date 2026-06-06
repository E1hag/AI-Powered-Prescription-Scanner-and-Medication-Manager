create extension if not exists pgcrypto;

create type public.prescription_status as enum (
  'draft',
  'processing',
  'needs_review',


  'ocr_failed',
  'ready_for_schedule',
  'finalized'
);

create type public.extraction_run_status as enum (
  'queued',
  'processing',
  'completed',
  'failed'
);

create type public.review_status as enum (
  'pending',
  'reviewed',
  'confirmed',
  'rejected'
);

create type public.schedule_status as enum (
  'draft',
  'ready_for_confirmation',
  'confirmed',
  'active',
  'archived'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.prescription_status not null default 'draft',
  active_extraction_run_id uuid,
  source_type text not null default 'upload',
  handwriting_detected boolean not null default false,
  raw_ocr_text text,
  review_required boolean not null default true,
  finalized_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.prescription_images (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  width integer,
  height integer,
  file_size_bytes bigint,
  sha256 text,
  is_original boolean not null default true,
  capture_source text not null check (capture_source in ('camera', 'gallery', 'upload')),
  preprocess_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  provider text not null,
  provider_model text,
  parser_version text not null default 'v1',
  status public.extraction_run_status not null default 'queued',
  provider_request_id text,
  provider_response jsonb,
  ocr_blocks jsonb not null default '[]'::jsonb,
  raw_ocr_text text,
  overall_confidence numeric(5,4),
  issues jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.prescriptions
  add constraint prescriptions_active_extraction_run_id_fkey
  foreign key (active_extraction_run_id)
  references public.extraction_runs (id)
  on delete set null;

create table public.extracted_medications (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  extraction_run_id uuid not null references public.extraction_runs (id) on delete cascade,
  position_index integer not null,
  raw_medication_text text not null,
  medication_name text,
  strength_text text,
  dosage_text text,
  frequency_text text,
  timing_text text,
  duration_text text,
  start_date_text text,
  notes_text text,
  normalized_fields jsonb not null default '{}'::jsonb,
  confidence_flags jsonb not null default '[]'::jsonb,
  parsing_issues jsonb not null default '[]'::jsonb,
  review_status public.review_status not null default 'pending',
  is_schedule_generatable boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.parsing_reviews (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  extraction_run_id uuid not null references public.extraction_runs (id) on delete cascade,
  reviewed_by uuid not null references auth.users (id) on delete cascade,
  status public.review_status not null default 'pending',
  field_edits jsonb not null default '{}'::jsonb,
  issue_resolutions jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  extracted_medication_id uuid references public.extracted_medications (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.schedule_status not null default 'draft',
  source text not null check (source in ('manual', 'ocr_reviewed')),
  timezone text not null,
  start_date date not null,
  end_date date,
  schedule_type text not null check (schedule_type in ('daily', 'interval', 'contextual', 'manual')),
  instructions_snapshot jsonb not null default '{}'::jsonb,
  schedule_config jsonb not null default '{}'::jsonb,
  requires_confirmation boolean not null default true,
  confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.medication_schedule_events (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.medication_schedules (id) on delete cascade,
  event_date date not null,
  event_datetime timestamptz not null,
  sequence_no integer not null,
  anchor_type text not null check (
    anchor_type in (
      'custom_time',
      'morning',
      'noon',
      'evening',
      'bedtime',
      'after_meal',
      'before_meal',
      'interval'
    )
  ),
  is_generated boolean not null default true,
  generation_source text not null check (generation_source in ('schedule_engine', 'manual')),
  created_at timestamptz not null default timezone('utc', now())
);

create index prescriptions_user_created_idx
  on public.prescriptions (user_id, created_at desc);

create index extraction_runs_prescription_created_idx
  on public.extraction_runs (prescription_id, created_at desc);

create index extracted_medications_prescription_position_idx
  on public.extracted_medications (prescription_id, position_index);

create index medication_schedules_user_status_idx
  on public.medication_schedules (user_id, status);

create index medication_schedule_events_schedule_datetime_idx
  on public.medication_schedule_events (schedule_id, event_datetime);

create trigger set_prescriptions_updated_at
before update on public.prescriptions
for each row
execute function public.set_updated_at();

create trigger set_medication_schedules_updated_at
before update on public.medication_schedules
for each row
execute function public.set_updated_at();
