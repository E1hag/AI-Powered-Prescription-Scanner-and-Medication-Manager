do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "Users can read own profile" on public.profiles';
    execute 'create policy "Users can read own profile" on public.profiles for select to authenticated using (auth.uid() = id)';

    execute 'drop policy if exists "Authenticated users can read clinician display profiles" on public.profiles';
    execute 'create policy "Authenticated users can read clinician display profiles" on public.profiles for select to authenticated using (role = ''clinician'')';
  end if;
end $$;
