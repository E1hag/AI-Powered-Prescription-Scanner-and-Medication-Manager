alter table public.prescriptions
  add column if not exists patient_id uuid;

alter table public.medication_schedules
  add column if not exists patient_id uuid;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'medication_schedules'
      and column_name = 'medication_id'
  ) then
    alter table public.medication_schedules
      alter column medication_id drop not null;
  end if;
end;
$$;
