do $$
begin
  if to_regclass('public.drug_interaction_results') is not null then
    alter table public.drug_interaction_results
      add column if not exists schedule_id uuid,
      add column if not exists ingredient_fingerprint text,
      add column if not exists master_interaction_id uuid;

    create index if not exists idx_drug_interaction_results_schedule
      on public.drug_interaction_results (schedule_id);

    create index if not exists idx_drug_interaction_results_patient_fingerprint
      on public.drug_interaction_results (patient_id, ingredient_fingerprint);

    create index if not exists idx_drug_interaction_results_master
      on public.drug_interaction_results (master_interaction_id);
  end if;
end $$;
