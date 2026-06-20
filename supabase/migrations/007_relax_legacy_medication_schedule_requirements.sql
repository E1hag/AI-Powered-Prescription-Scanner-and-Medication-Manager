do $$
declare
  legacy_column text;
begin
  foreach legacy_column in array array[
    'medication_id',
    'scheduled_time',
    'is_active'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'medication_schedules'
        and column_name = legacy_column
        and is_nullable = 'NO'
    ) then
      execute format(
        'alter table public.medication_schedules alter column %I drop not null',
        legacy_column
      );
    end if;
  end loop;
end;
$$;
