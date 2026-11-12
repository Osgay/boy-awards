-- BOY AWARDS: execute este arquivo uma vez no SQL Editor do Supabase.
-- ATENÇÃO: a conta admin deve ser criada primeiro no Supabase Auth.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 90),
  description text not null default '',
  edition text not null default '2027',
  emoji text not null default '🏆',
  voting_open boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.nominees (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);
create table if not exists public.access_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.ballots (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  nominee_id uuid not null references public.nominees(id) on delete cascade,
  access_code_id uuid not null references public.access_codes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (category_id,access_code_id)
);
create table if not exists public.winners (
  category_id uuid primary key references public.categories(id) on delete cascade,
  nominee_id uuid not null references public.nominees(id) on delete cascade,
  revealed_at timestamptz not null default now()
);

create index if not exists idx_nominees_category on public.nominees(category_id);
create index if not exists idx_ballots_category on public.ballots(category_id);
create index if not exists idx_ballots_nominee on public.ballots(nominee_id);

alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.nominees enable row level security;
alter table public.access_codes enable row level security;
alter table public.ballots enable row level security;
alter table public.winners enable row level security;

-- Os visitantes veem somente categorias/indicados e vencedores revelados.
create policy "Public read categories" on public.categories for select to anon,authenticated using (true);
create policy "Public read nominees" on public.nominees for select to anon,authenticated using (true);
create policy "Public read revealed winners" on public.winners for select to anon,authenticated using (true);

-- A checagem de admin não permite que usuários vejam a lista de outros admins.
create policy "Admin can read own role" on public.admins for select to authenticated using (user_id = (select auth.uid()));

-- Permissões editoriais; administradores são designados exclusivamente no SQL Editor.
create policy "Admin insert categories" on public.categories for insert to authenticated with check (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "Admin update categories" on public.categories for update to authenticated using (exists(select 1 from public.admins where user_id=(select auth.uid()))) with check (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "Admin delete categories" on public.categories for delete to authenticated using (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "Admin insert nominees" on public.nominees for insert to authenticated with check (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "Admin update nominees" on public.nominees for update to authenticated using (exists(select 1 from public.admins where user_id=(select auth.uid()))) with check (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "Admin delete nominees" on public.nominees for delete to authenticated using (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "Admin read access codes" on public.access_codes for select to authenticated using (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "Admin read ballots" on public.ballots for select to authenticated using (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "Admin insert winners" on public.winners for insert to authenticated with check (exists(select 1 from public.admins where user_id=(select auth.uid())));
create policy "Admin delete winners" on public.winners for delete to authenticated using (exists(select 1 from public.admins where user_id=(select auth.uid())));

-- Nenhum cliente pode inserir votos ou criar códigos diretamente nas tabelas.
-- Em vez disso, estas operações passam por funções verificadas pelo servidor.
create or replace function public.cast_vote(p_category_id uuid,p_nominee_id uuid,p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_access uuid;
begin
  if not exists(select 1 from public.categories c where c.id=p_category_id and c.voting_open) then
    raise exception 'Votação encerrada ou categoria inexistente.';
  end if;
  if not exists(select 1 from public.nominees n where n.id=p_nominee_id and n.category_id=p_category_id) then
    raise exception 'Indicado inválido para esta categoria.';
  end if;
  select a.id into v_access from public.access_codes a
    where a.code_hash=encode(extensions.digest(upper(regexp_replace(trim(p_code),'[^a-zA-Z0-9]','','g')),'sha256'),'hex') and a.active=true;
  if v_access is null then raise exception 'Código inválido ou desativado.';end if;
  begin
    insert into public.ballots(category_id,nominee_id,access_code_id)
    values(p_category_id,p_nominee_id,v_access);
  exception when unique_violation then
    raise exception 'Este código já votou nesta categoria.';
  end;
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.admin_create_codes(p_count integer)
returns table(code text)
language plpgsql security definer set search_path = ''
as $$
declare v_raw text;
begin
  if (select auth.uid()) is null or not exists(select 1 from public.admins a where a.user_id=(select auth.uid())) then
    raise exception 'Apenas administradores podem gerar códigos.';
  end if;
  if p_count < 1 or p_count > 100 or p_count is null then raise exception 'Quantidade deve ser entre 1 e 100.';end if;
  for i in 1..p_count loop
    v_raw := upper(encode(extensions.gen_random_bytes(10),'hex'));
    insert into public.access_codes(code_hash) values(encode(extensions.digest(v_raw,'sha256'),'hex'));
    code := substring(v_raw,1,5)||'-'||substring(v_raw,6,5)||'-'||substring(v_raw,11,5)||'-'||substring(v_raw,16,5);
    return next;
  end loop;
end;
$$;

create or replace function public.admin_vote_totals()
returns table(category_id uuid,nominee_id uuid,total bigint)
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists(select 1 from public.admins a where a.user_id=(select auth.uid())) then
    raise exception 'Acesso negado.';
  end if;
  return query select n.category_id,n.id,count(b.id) from public.nominees n
  left join public.ballots b on b.nominee_id=n.id and b.category_id=n.category_id
  group by n.category_id,n.id;
end;
$$;

-- Garante que o indicado premiado pertence à categoria, mesmo em inserções manuais.
create or replace function public.validate_winner()
returns trigger language plpgsql set search_path = '' as $$
begin
 if not exists(select 1 from public.nominees n where n.id=new.nominee_id and n.category_id=new.category_id) then
   raise exception 'Vencedor não pertence à categoria.';
 end if;
 if exists(select 1 from public.categories c where c.id=new.category_id and c.voting_open) then
   raise exception 'Encerre a votação antes da revelação.';
 end if;
 return new;
end;
$$;
create trigger trg_validate_winner before insert or update on public.winners for each row execute function public.validate_winner();

revoke all on function public.cast_vote(uuid,uuid,text) from public;
revoke all on function public.admin_create_codes(integer) from public;
revoke all on function public.admin_vote_totals() from public;
grant execute on function public.cast_vote(uuid,uuid,text) to anon,authenticated;
grant execute on function public.admin_create_codes(integer) to authenticated;
grant execute on function public.admin_vote_totals() to authenticated;

-- Passo final MANUAL após criar a conta no Authentication > Users:
-- insert into public.admins (user_id) values ('COLE-AQUI-O-UUID-DO-USUARIO');
