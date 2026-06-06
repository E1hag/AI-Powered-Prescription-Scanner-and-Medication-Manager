insert into storage.buckets (id, name, public)
values ('prescription-images', 'prescription-images', false)
on conflict (id) do nothing;

alter table public.prescriptions enable row level security;
alter table public.prescription_images enable row level security;
alter table public.extraction_runs enable row level security;
alter table public.extracted_medications enable row level security;
alter table public.parsing_reviews enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.medication_schedule_events enable row level security;

create policy "Users manage their own prescriptions"
on public.prescriptions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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

create policy "Users manage their own schedules"
on public.medication_schedules
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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
