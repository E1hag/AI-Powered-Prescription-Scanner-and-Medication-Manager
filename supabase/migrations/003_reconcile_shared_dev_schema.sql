create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'prescription_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.prescription_status as enum (
      'draft',
      'processing',
      'needs_review',
      'ocr_failed',
      'ready_for_schedule',
      'finalized'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'extraction_run_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.extraction_run_status as enum (
      'queued',
      'processing',
      'completed',
      'failed'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'review_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.review_status as enum (
      'pending',
      'reviewed',
      'confirmed',
      'rejected'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'schedule_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.schedule_status as enum (
      'draft',
      'ready_for_confirmation',
      'confirmed',
      'active',
      'archived'
    );
  end if;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid()
);

alter table public.prescriptions
  add column if not exists user_id uuid,
  add column if not exists status public.prescription_status not null default 'draft',
  add column if not exists active_extraction_run_id uuid,
  add column if not exists source_type text not null default 'upload',
  add column if not exists handwriting_detected boolean not null default false,
  add column if not exists raw_ocr_text text,
  add column if not exists review_required boolean not null default true,
  add column if not exists finalized_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prescriptions_user_id_fkey'
      and conrelid = 'public.prescriptions'::regclass
  ) then
    alter table public.prescriptions
      add constraint prescriptions_user_id_fkey
      foreign key (user_id)
      references auth.users (id)
      on delete cascade;
  end if;
end;
$$;

create table if not exists public.prescription_images (
  id uuid primary key default gen_random_uuid()
);

alter table public.prescription_images
  add column if not exists prescription_id uuid,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists file_size_bytes bigint,
  add column if not exists sha256 text,
  add column if not exists is_original boolean not null default true,
  add column if not exists capture_source text,
  add column if not exists preprocess_meta jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.prescription_images
  alter column prescription_id set not null,
  alter column storage_path set not null,
  alter column mime_type set not null,
  alter column capture_source set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prescription_images_prescription_id_fkey'
      and conrelid = 'public.prescription_images'::regclass
  ) then
    alter table public.prescription_images
      add constraint prescription_images_prescription_id_fkey
      foreign key (prescription_id)
      references public.prescriptions (id)
      on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prescription_images_capture_source_check'
      and conrelid = 'public.prescription_images'::regclass
  ) then
    alter table public.prescription_images
      add constraint prescription_images_capture_source_check
      check (capture_source in ('camera', 'gallery', 'upload'));
  end if;
end;
$$;

create table if not exists public.extraction_runs (
  id uuid primary key default gen_random_uuid()
);

alter table public.extraction_runs
  add column if not exists prescription_id uuid,
  add column if not exists provider text,
  add column if not exists provider_model text,
  add column if not exists parser_version text not null default 'v1',
  add column if not exists status public.extraction_run_status not null default 'queued',
  add column if not exists provider_request_id text,
  add column if not exists provider_response jsonb,
  add column if not exists ocr_blocks jsonb not null default '[]'::jsonb,
  add column if not exists raw_ocr_text text,
  add column if not exists overall_confidence numeric(5,4),
  add column if not exists issues jsonb not null default '[]'::jsonb,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists failure_code text,
  add column if not exists failure_message text,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.extraction_runs
  alter column prescription_id set not null,
  alter column provider set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'extraction_runs_prescription_id_fkey'
      and conrelid = 'public.extraction_runs'::regclass
  ) then
    alter table public.extraction_runs
      add constraint extraction_runs_prescription_id_fkey
      foreign key (prescription_id)
      references public.prescriptions (id)
      on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prescriptions_active_extraction_run_id_fkey'
      and conrelid = 'public.prescriptions'::regclass
  ) then
    alter table public.prescriptions
      add constraint prescriptions_active_extraction_run_id_fkey
      foreign key (active_extraction_run_id)
      references public.extraction_runs (id)
      on delete set null;
  end if;
end;
$$;

create table if not exists public.extracted_medications (
  id uuid primary key default gen_random_uuid()
);

alter table public.extracted_medications
  add column if not exists prescription_id uuid,
  add column if not exists extraction_run_id uuid,
  add column if not exists position_index integer,
  add column if not exists raw_medication_text text,
  add column if not exists medication_name text,
  add column if not exists strength_text text,
  add column if not exists dosage_text text,
  add column if not exists frequency_text text,
  add column if not exists timing_text text,
  add column if not exists duration_text text,
  add column if not exists start_date_text text,
  add column if not exists notes_text text,
  add column if not exists normalized_fields jsonb not null default '{}'::jsonb,
  add column if not exists confidence_flags jsonb not null default '[]'::jsonb,
  add column if not exists parsing_issues jsonb not null default '[]'::jsonb,
  add column if not exists review_status public.review_status not null default 'pending',
  add column if not exists is_schedule_generatable boolean not null default false,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.extracted_medications
  alter column prescription_id set not null,
  alter column extraction_run_id set not null,
  alter column position_index set not null,
  alter column raw_medication_text set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'extracted_medications_prescription_id_fkey'
      and conrelid = 'public.extracted_medications'::regclass
  ) then
    alter table public.extracted_medications
      add constraint extracted_medications_prescription_id_fkey
      foreign key (prescription_id)
      references public.prescriptions (id)
      on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'extracted_medications_extraction_run_id_fkey'
      and conrelid = 'public.extracted_medications'::regclass
  ) then
    alter table public.extracted_medications
      add constraint extracted_medications_extraction_run_id_fkey
      foreign key (extraction_run_id)
      references public.extraction_runs (id)
      on delete cascade;
  end if;
end;
$$;

create table if not exists public.parsing_reviews (
  id uuid primary key default gen_random_uuid()
);

alter table public.parsing_reviews
  add column if not exists prescription_id uuid,
  add column if not exists extraction_run_id uuid,
  add column if not exists reviewed_by uuid,
  add column if not exists status public.review_status not null default 'pending',
  add column if not exists field_edits jsonb not null default '{}'::jsonb,
  add column if not exists issue_resolutions jsonb not null default '{}'::jsonb,
  add column if not exists submitted_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.parsing_reviews
  alter column prescription_id set not null,
  alter column extraction_run_id set not null,
  alter column reviewed_by set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'parsing_reviews_prescription_id_fkey'
      and conrelid = 'public.parsing_reviews'::regclass
  ) then
    alter table public.parsing_reviews
      add constraint parsing_reviews_prescription_id_fkey
      foreign key (prescription_id)
      references public.prescriptions (id)
      on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'parsing_reviews_extraction_run_id_fkey'
      and conrelid = 'public.parsing_reviews'::regclass
  ) then
    alter table public.parsing_reviews
      add constraint parsing_reviews_extraction_run_id_fkey
      foreign key (extraction_run_id)
      references public.extraction_runs (id)
      on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'parsing_reviews_reviewed_by_fkey'
      and conrelid = 'public.parsing_reviews'::regclass
  ) then
    alter table public.parsing_reviews
      add constraint parsing_reviews_reviewed_by_fkey
      foreign key (reviewed_by)
      references auth.users (id)
      on delete cascade;
  end if;
end;
$$;

create table if not exists public.medication_schedules (
  id uuid primary key default gen_random_uuid()
);

alter table public.medication_schedules
  add column if not exists prescription_id uuid,
  add column if not exists extracted_medication_id uuid,
  add column if not exists user_id uuid,
  add column if not exists status public.schedule_status not null default 'draft',
  add column if not exists source text,
  add column if not exists timezone text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists schedule_type text,
  add column if not exists instructions_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists schedule_config jsonb not null default '{}'::jsonb,
  add column if not exists requires_confirmation boolean not null default true,
  add column if not exists confirmed_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.medication_schedules
  alter column prescription_id set not null,
  alter column user_id set not null,
  alter column source set not null,
  alter column timezone set not null,
  alter column start_date set not null,
  alter column schedule_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medication_schedules_prescription_id_fkey'
      and conrelid = 'public.medication_schedules'::regclass
  ) then
    alter table public.medication_schedules
      add constraint medication_schedules_prescription_id_fkey
      foreign key (prescription_id)
      references public.prescriptions (id)
      on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medication_schedules_extracted_medication_id_fkey'
      and conrelid = 'public.medication_schedules'::regclass
  ) then
    alter table public.medication_schedules
      add constraint medication_schedules_extracted_medication_id_fkey
      foreign key (extracted_medication_id)
      references public.extracted_medications (id)
      on delete set null;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medication_schedules_user_id_fkey'
      and conrelid = 'public.medication_schedules'::regclass
  ) then
    alter table public.medication_schedules
      add constraint medication_schedules_user_id_fkey
      foreign key (user_id)
      references auth.users (id)
      on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medication_schedules_source_check'
      and conrelid = 'public.medication_schedules'::regclass
  ) then
    alter table public.medication_schedules
      add constraint medication_schedules_source_check
      check (source in ('manual', 'ocr_reviewed'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medication_schedules_schedule_type_check'
      and conrelid = 'public.medication_schedules'::regclass
  ) then
    alter table public.medication_schedules
      add constraint medication_schedules_schedule_type_check
      check (schedule_type in ('daily', 'interval', 'contextual', 'manual'));
  end if;
end;
$$;

create table if not exists public.medication_schedule_events (
  id uuid primary key default gen_random_uuid()
);

alter table public.medication_schedule_events
  add column if not exists schedule_id uuid,
  add column if not exists event_date date,
  add column if not exists event_datetime timestamptz,
  add column if not exists sequence_no integer,
  add column if not exists anchor_type text,
  add column if not exists is_generated boolean not null default true,
  add column if not exists generation_source text,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.medication_schedule_events
  alter column schedule_id set not null,
  alter column event_date set not null,
  alter column event_datetime set not null,
  alter column sequence_no set not null,
  alter column anchor_type set not null,
  alter column generation_source set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medication_schedule_events_schedule_id_fkey'
      and conrelid = 'public.medication_schedule_events'::regclass
  ) then
    alter table public.medication_schedule_events
      add constraint medication_schedule_events_schedule_id_fkey
      foreign key (schedule_id)
      references public.medication_schedules (id)
      on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medication_schedule_events_anchor_type_check'
      and conrelid = 'public.medication_schedule_events'::regclass
  ) then
    alter table public.medication_schedule_events
      add constraint medication_schedule_events_anchor_type_check
      check (
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
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medication_schedule_events_generation_source_check'
      and conrelid = 'public.medication_schedule_events'::regclass
  ) then
    alter table public.medication_schedule_events
      add constraint medication_schedule_events_generation_source_check
      check (generation_source in ('schedule_engine', 'manual'));
  end if;
end;
$$;

create index if not exists prescriptions_user_created_idx
  on public.prescriptions (user_id, created_at desc);

create index if not exists extraction_runs_prescription_created_idx
  on public.extraction_runs (prescription_id, created_at desc);

create index if not exists extracted_medications_prescription_position_idx
  on public.extracted_medications (prescription_id, position_index);

create index if not exists medication_schedules_user_status_idx
  on public.medication_schedules (user_id, status);

create index if not exists medication_schedule_events_schedule_datetime_idx
  on public.medication_schedule_events (schedule_id, event_datetime);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_prescriptions_updated_at'
      and tgrelid = 'public.prescriptions'::regclass
  ) then
    create trigger set_prescriptions_updated_at
    before update on public.prescriptions
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_medication_schedules_updated_at'
      and tgrelid = 'public.medication_schedules'::regclass
  ) then
    create trigger set_medication_schedules_updated_at
    before update on public.medication_schedules
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;

insert into storage.buckets (id, name, public)
values ('prescription-images', 'prescription-images', false)
on conflict (id) do nothing;

do $$
begin
  if to_regclass('public.prescriptions') is not null then
    execute 'alter table public.prescriptions enable row level security';
  end if;
  if to_regclass('public.prescription_images') is not null then
    execute 'alter table public.prescription_images enable row level security';
  end if;
  if to_regclass('public.extraction_runs') is not null then
    execute 'alter table public.extraction_runs enable row level security';
  end if;
  if to_regclass('public.extracted_medications') is not null then
    execute 'alter table public.extracted_medications enable row level security';
  end if;
  if to_regclass('public.parsing_reviews') is not null then
    execute 'alter table public.parsing_reviews enable row level security';
  end if;
  if to_regclass('public.medication_schedules') is not null then
    execute 'alter table public.medication_schedules enable row level security';
  end if;
  if to_regclass('public.medication_schedule_events') is not null then
    execute 'alter table public.medication_schedule_events enable row level security';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'prescriptions'
      and policyname = 'Users manage their own prescriptions'
  ) then
    create policy "Users manage their own prescriptions"
    on public.prescriptions
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.prescription_images') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'prescription_images'
      and policyname = 'Users manage their own prescription images'
  ) then
    create policy "Users manage their own prescription images"
    on public.prescription_images
    for all
    using (
      exists (
        select 1
        from public.prescriptions prescriptions
        where prescriptions.id = prescription_images.prescription_id
          and prescriptions.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.prescriptions prescriptions
        where prescriptions.id = prescription_images.prescription_id
          and prescriptions.user_id = auth.uid()
      )
    );
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.extraction_runs') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'extraction_runs'
      and policyname = 'Users manage their own extraction runs'
  ) then
    create policy "Users manage their own extraction runs"
    on public.extraction_runs
    for all
    using (
      exists (
        select 1
        from public.prescriptions prescriptions
        where prescriptions.id = extraction_runs.prescription_id
          and prescriptions.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.prescriptions prescriptions
        where prescriptions.id = extraction_runs.prescription_id
          and prescriptions.user_id = auth.uid()
      )
    );
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.extracted_medications') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'extracted_medications'
      and policyname = 'Users manage their own extracted medications'
  ) then
    create policy "Users manage their own extracted medications"
    on public.extracted_medications
    for all
    using (
      exists (
        select 1
        from public.prescriptions prescriptions
        where prescriptions.id = extracted_medications.prescription_id
          and prescriptions.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.prescriptions prescriptions
        where prescriptions.id = extracted_medications.prescription_id
          and prescriptions.user_id = auth.uid()
      )
    );
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.parsing_reviews') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'parsing_reviews'
      and policyname = 'Users manage their own parsing reviews'
  ) then
    create policy "Users manage their own parsing reviews"
    on public.parsing_reviews
    for all
    using (
      exists (
        select 1
        from public.prescriptions prescriptions
        where prescriptions.id = parsing_reviews.prescription_id
          and prescriptions.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.prescriptions prescriptions
        where prescriptions.id = parsing_reviews.prescription_id
          and prescriptions.user_id = auth.uid()
      )
    );
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.medication_schedules') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'medication_schedules'
      and policyname = 'Users manage their own schedules'
  ) then
    create policy "Users manage their own schedules"
    on public.medication_schedules
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.medication_schedule_events') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'medication_schedule_events'
      and policyname = 'Users manage their own schedule events'
  ) then
    create policy "Users manage their own schedule events"
    on public.medication_schedule_events
    for all
    using (
      exists (
        select 1
        from public.medication_schedules medication_schedules
        where medication_schedules.id = medication_schedule_events.schedule_id
          and medication_schedules.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.medication_schedules medication_schedules
        where medication_schedules.id = medication_schedule_events.schedule_id
          and medication_schedules.user_id = auth.uid()
      )
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users manage their own prescription image objects'
  ) then
    create policy "Users manage their own prescription image objects"
    on storage.objects
    for all
    using (
      bucket_id = 'prescription-images'
      and split_part(name, '/', 1) = auth.uid()::text
    )
    with check (
      bucket_id = 'prescription-images'
      and split_part(name, '/', 1) = auth.uid()::text
    );
  end if;
end;
$$;
