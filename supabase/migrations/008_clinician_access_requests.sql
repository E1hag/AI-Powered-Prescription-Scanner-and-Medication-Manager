create table if not exists public.clinician_access_requests (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  reason text
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinician_access_requests_status_check'
  ) then
    alter table public.clinician_access_requests
      add constraint clinician_access_requests_status_check
      check (status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists clinician_access_requests_patient_status_idx
  on public.clinician_access_requests (patient_id, status, requested_at desc);

create index if not exists clinician_access_requests_clinician_status_idx
  on public.clinician_access_requests (clinician_id, status, requested_at desc);

alter table public.clinician_access_requests enable row level security;

drop policy if exists "Patients can read own clinician access requests"
on public.clinician_access_requests;

create policy "Patients can read own clinician access requests"
on public.clinician_access_requests
for select
using (auth.uid() = patient_id);

drop policy if exists "Clinicians can read own access requests"
on public.clinician_access_requests;

create policy "Clinicians can read own access requests"
on public.clinician_access_requests
for select
using (auth.uid() = clinician_id);

drop policy if exists "Patients can update own clinician access requests"
on public.clinician_access_requests;

create policy "Patients can update own clinician access requests"
on public.clinician_access_requests
for update
using (auth.uid() = patient_id)
with check (auth.uid() = patient_id);

drop policy if exists "Approved clinicians can read patient medication schedules"
on public.medco_medication_schedules;

create policy "Approved clinicians can read patient medication schedules"
on public.medco_medication_schedules
for select
using (
  exists (
    select 1
    from public.clinician_access_requests car
    where car.patient_id = medco_medication_schedules.user_id
      and car.clinician_id = auth.uid()
      and car.status = 'approved'
  )
);

drop policy if exists "Approved clinicians can read patient adherence history"
on public.medco_adherence_history;

create policy "Approved clinicians can read patient adherence history"
on public.medco_adherence_history
for select
using (
  exists (
    select 1
    from public.medco_medication_schedules s
    join public.clinician_access_requests car
      on car.patient_id = s.user_id
    where s.id = medco_adherence_history.schedule_id
      and car.clinician_id = auth.uid()
      and car.status = 'approved'
  )
);
