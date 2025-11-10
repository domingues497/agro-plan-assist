-- Função usada pelas políticas para obter o consultor do usuário logado
create or replace function public.get_user_consultor()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select numerocm_consultor
  from public.profiles
  where user_id = auth.uid()
$$;

-- SELECT: consultores veem suas próprias fazendas (admins veem tudo)
drop policy if exists "Consultores can view own fazendas" on public.fazendas;
create policy "Consultores can view own fazendas"
  on public.fazendas
  for select
  using (
    has_role(auth.uid(), 'admin'::app_role)
    or numerocm_consultor = public.get_user_consultor()
  );

-- UPDATE: consultores podem atualizar suas próprias fazendas (admins podem tudo)
drop policy if exists "Consultores can update own fazendas" on public.fazendas;
create policy "Consultores can update own fazendas"
  on public.fazendas
  for update
  using (
    has_role(auth.uid(), 'admin'::app_role)
    or numerocm_consultor = public.get_user_consultor()
  )
  with check (
    has_role(auth.uid(), 'admin'::app_role)
    or numerocm_consultor = public.get_user_consultor()
  );