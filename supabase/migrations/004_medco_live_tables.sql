create extension if not exists "pgcrypto";

create table if not exists public.medco_medication_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  doses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.medco_adherence_history (
  id text primary key,
  schedule_id uuid not null references public.medco_medication_schedules(id) on delete cascade,
  dose_id text not null,
  medication_name text not null,
  dose_time text not null,
  action text not null check (action in ('Pending', 'Taken', 'Missed', 'Snoozed')),
  created_at timestamptz not null default now()
);

create table if not exists public.medco_dose_reminders (
  id text primary key,
  schedule_id uuid not null references public.medco_medication_schedules(id) on delete cascade,
  dose_id text not null,
  medication_name text not null,
  dosage text not null,
  dose_time text not null,
  instruction text not null,
  is_enabled boolean not null default true
);

create table if not exists public.medco_medical_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  allergies text,
  chronic_conditions text,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.medco_medication_schedules enable row level security;
alter table public.medco_adherence_history enable row level security;
alter table public.medco_dose_reminders enable row level security;
alter table public.medco_medical_profiles enable row level security;

drop policy if exists "Users can read own medication schedules" on public.medco_medication_schedules;
drop policy if exists "Users can insert own medication schedules" on public.medco_medication_schedules;
drop policy if exists "Users can update own medication schedules" on public.medco_medication_schedules;
drop policy if exists "Users can delete own medication schedules" on public.medco_medication_schedules;

create policy "Users can read own medication schedules"
on public.medco_medication_schedules
for select
using (
  auth.uid() = user_id
  or user_id is null
);

create policy "Users can insert own medication schedules"
on public.medco_medication_schedules
for insert
with check (
  auth.uid() = user_id
  or user_id is null
);

create policy "Users can update own medication schedules"
on public.medco_medication_schedules
for update
using (
  auth.uid() = user_id
  or user_id is null
)
with check (
  auth.uid() = user_id
  or user_id is null
);

create policy "Users can delete own medication schedules"
on public.medco_medication_schedules
for delete
using (
  auth.uid() = user_id
  or user_id is null
);

drop policy if exists "Users can read own adherence history" on public.medco_adherence_history;
drop policy if exists "Users can insert own adherence history" on public.medco_adherence_history;
drop policy if exists "Users can delete own adherence history" on public.medco_adherence_history;

create policy "Users can read own adherence history"
on public.medco_adherence_history
for select
using (
  exists (
    select 1
    from public.medco_medication_schedules s
    where s.id = medco_adherence_history.schedule_id
    and (
      s.user_id = auth.uid()
      or s.user_id is null
    )
  )
);

create policy "Users can insert own adherence history"
on public.medco_adherence_history
for insert
with check (
  exists (
    select 1
    from public.medco_medication_schedules s
    where s.id = medco_adherence_history.schedule_id
    and (
      s.user_id = auth.uid()
      or s.user_id is null
    )
  )
);

create policy "Users can delete own adherence history"
on public.medco_adherence_history
for delete
using (
  exists (
    select 1
    from public.medco_medication_schedules s
    where s.id = medco_adherence_history.schedule_id
    and (
      s.user_id = auth.uid()
      or s.user_id is null
    )
  )
);

drop policy if exists "Users can read own dose reminders" on public.medco_dose_reminders;
drop policy if exists "Users can insert own dose reminders" on public.medco_dose_reminders;
drop policy if exists "Users can update own dose reminders" on public.medco_dose_reminders;
drop policy if exists "Users can delete own dose reminders" on public.medco_dose_reminders;

create policy "Users can read own dose reminders"
on public.medco_dose_reminders
for select
using (
  exists (
    select 1
    from public.medco_medication_schedules s
    where s.id = medco_dose_reminders.schedule_id
    and (
      s.user_id = auth.uid()
      or s.user_id is null
    )
  )
);

create policy "Users can insert own dose reminders"
on public.medco_dose_reminders
for insert
with check (
  exists (
    select 1
    from public.medco_medication_schedules s
    where s.id = medco_dose_reminders.schedule_id
    and (
      s.user_id = auth.uid()
      or s.user_id is null
    )
  )
);

create policy "Users can update own dose reminders"
on public.medco_dose_reminders
for update
using (
  exists (
    select 1
    from public.medco_medication_schedules s
    where s.id = medco_dose_reminders.schedule_id
    and (
      s.user_id = auth.uid()
      or s.user_id is null
    )
  )
)
with check (
  exists (
    select 1
    from public.medco_medication_schedules s
    where s.id = medco_dose_reminders.schedule_id
    and (
      s.user_id = auth.uid()
      or s.user_id is null
    )
  )
);

create policy "Users can delete own dose reminders"
on public.medco_dose_reminders
for delete
using (
  exists (
    select 1
    from public.medco_medication_schedules s
    where s.id = medco_dose_reminders.schedule_id
    and (
      s.user_id = auth.uid()
      or s.user_id is null
    )
  )
);

drop policy if exists "Users can read own medical profile" on public.medco_medical_profiles;
drop policy if exists "Users can insert own medical profile" on public.medco_medical_profiles;
drop policy if exists "Users can update own medical profile" on public.medco_medical_profiles;
drop policy if exists "Users can delete own medical profile" on public.medco_medical_profiles;

create policy "Users can read own medical profile"
on public.medco_medical_profiles
for select
using (
  auth.uid() = user_id
  or user_id is null
);

create policy "Users can insert own medical profile"
on public.medco_medical_profiles
for insert
with check (
  auth.uid() = user_id
  or user_id is null
);

create policy "Users can update own medical profile"
on public.medco_medical_profiles
for update
using (
  auth.uid() = user_id
  or user_id is null
)
with check (
  auth.uid() = user_id
  or user_id is null
);

create policy "Users can delete own medical profile"
on public.medco_medical_profiles
for delete
using (
  auth.uid() = user_id
  or user_id is null
);