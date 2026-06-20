create table if not exists public.treatment_notes (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  note_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  note_type text
);

create index if not exists treatment_notes_patient_created_idx
  on public.treatment_notes (patient_id, created_at desc);

create index if not exists treatment_notes_clinician_created_idx
  on public.treatment_notes (clinician_id, created_at desc);

alter table public.treatment_notes enable row level security;

drop policy if exists "Patients can read approved clinician treatment notes"
on public.treatment_notes;

create policy "Patients can read approved clinician treatment notes"
on public.treatment_notes
for select
using (
  patient_id = auth.uid()
  and exists (
    select 1
    from public.clinician_access_requests car
    where car.patient_id = treatment_notes.patient_id
      and car.clinician_id = treatment_notes.clinician_id
      and car.status = 'approved'
  )
);

drop policy if exists "Clinicians can read own treatment notes"
on public.treatment_notes;

create policy "Clinicians can read own treatment notes"
on public.treatment_notes
for select
using (clinician_id = auth.uid());

drop policy if exists "Clinicians can insert own treatment notes"
on public.treatment_notes;

create policy "Clinicians can insert own treatment notes"
on public.treatment_notes
for insert
with check (clinician_id = auth.uid());

drop policy if exists "Clinicians can update own treatment notes"
on public.treatment_notes;

create policy "Clinicians can update own treatment notes"
on public.treatment_notes
for update
using (clinician_id = auth.uid())
with check (clinician_id = auth.uid());

drop policy if exists "Clinicians can delete own treatment notes"
on public.treatment_notes;

create policy "Clinicians can delete own treatment notes"
on public.treatment_notes
for delete
using (clinician_id = auth.uid());
