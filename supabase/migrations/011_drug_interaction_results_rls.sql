do $$
begin
  if to_regclass('public.drug_interaction_results') is not null then
    alter table public.drug_interaction_results enable row level security;

    drop policy if exists "Patients can read own drug interaction results"
      on public.drug_interaction_results;
    drop policy if exists "Patients can insert own drug interaction results"
      on public.drug_interaction_results;
    drop policy if exists "Patients can update own drug interaction results"
      on public.drug_interaction_results;
    drop policy if exists "Patients can delete own drug interaction results"
      on public.drug_interaction_results;
    drop policy if exists "Approved clinicians can read patient drug interaction results"
      on public.drug_interaction_results;

    create policy "Patients can read own drug interaction results"
    on public.drug_interaction_results
    for select
    to authenticated
    using (patient_id = auth.uid());

    create policy "Patients can insert own drug interaction results"
    on public.drug_interaction_results
    for insert
    to authenticated
    with check (patient_id = auth.uid());

    create policy "Patients can update own drug interaction results"
    on public.drug_interaction_results
    for update
    to authenticated
    using (patient_id = auth.uid())
    with check (patient_id = auth.uid());

    create policy "Patients can delete own drug interaction results"
    on public.drug_interaction_results
    for delete
    to authenticated
    using (patient_id = auth.uid());

    if to_regclass('public.clinician_access_requests') is not null then
      create policy "Approved clinicians can read patient drug interaction results"
      on public.drug_interaction_results
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.clinician_access_requests car
          where car.patient_id = drug_interaction_results.patient_id
            and car.clinician_id = auth.uid()
            and car.status = 'approved'
        )
      );
    end if;
  end if;
end $$;
