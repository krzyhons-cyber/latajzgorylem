-- TravelDeals: pełna konfiguracja bazy Supabase (można uruchamiać wielokrotnie).
-- Wklej całość w SQL Editor i kliknij Run.

-- ===== 1) Tabele =====
create table if not exists public.offers (
  slug text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.site (
  id int primary key,      -- 1 = ustawienia (partnerzy, e-mail kontaktowy)
  data jsonb not null
);
create table if not exists public.subscribers (
  id bigint generated always as identity primary key,
  email text not null unique check (length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  consent boolean not null default true,
  source text,
  created_at timestamptz not null default now()
);
create table if not exists public.events (
  id bigint generated always as identity primary key,
  slug text not null check (length(slug) <= 200),
  kind text not null check (kind in ('view', 'click')),
  target text check (length(target) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists events_slug_idx on public.events (slug, kind, created_at);

-- ===== 2) Uprawnienia (dostęp przez API) =====
grant usage on schema public to anon, authenticated;
grant select on public.offers, public.site to anon, authenticated;
grant insert, update, delete on public.offers, public.site to authenticated;
grant insert on public.subscribers, public.events to anon, authenticated;
grant select, update, delete on public.subscribers, public.events to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- ===== 3) Reguły bezpieczeństwa (Row Level Security) =====
alter table public.offers enable row level security;
alter table public.site enable row level security;
alter table public.subscribers enable row level security;
alter table public.events enable row level security;

drop policy if exists "offers_public_read" on public.offers;
drop policy if exists "offers_admin_write" on public.offers;
drop policy if exists "site_public_read" on public.site;
drop policy if exists "site_admin_write" on public.site;
drop policy if exists "subs_public_insert" on public.subscribers;
drop policy if exists "subs_admin_all" on public.subscribers;
drop policy if exists "events_public_insert" on public.events;
drop policy if exists "events_admin_all" on public.events;

-- oferty i ustawienia: każdy czyta, zapisuje tylko zalogowany admin
create policy "offers_public_read" on public.offers for select using (true);
create policy "site_public_read" on public.site for select using (true);
create policy "offers_admin_write" on public.offers for all to authenticated using (true) with check (true);
create policy "site_admin_write" on public.site for all to authenticated using (true) with check (true);

-- zapisy na powiadomienia: każdy może dodać swój adres (ze zgodą), czyta i usuwa tylko admin
create policy "subs_public_insert" on public.subscribers for insert to anon, authenticated with check (consent = true);
create policy "subs_admin_all" on public.subscribers for all to authenticated using (true) with check (true);

-- statystyki: każdy może dopisać zdarzenie, czyta tylko admin
create policy "events_public_insert" on public.events for insert to anon, authenticated with check (true);
create policy "events_admin_all" on public.events for all to authenticated using (true) with check (true);

-- podsumowanie statystyk dla panelu admina
create or replace view public.offer_stats with (security_invoker = true) as
select
  slug,
  count(*) filter (where kind = 'view') as views,
  count(*) filter (where kind = 'click') as clicks,
  count(*) filter (where kind = 'view' and created_at > now() - interval '30 days') as views_30d,
  count(*) filter (where kind = 'click' and created_at > now() - interval '30 days') as clicks_30d,
  max(created_at) as last_event
from public.events
group by slug;
revoke all on public.offer_stats from anon, public;
grant select on public.offer_stats to authenticated;

-- ===== 4) Zdjęcia (publiczny odczyt, wgrywanie tylko po zalogowaniu) =====
insert into storage.buckets (id, name, public)
values ('offer-images', 'offer-images', true)
on conflict (id) do nothing;

drop policy if exists "images_public_read" on storage.objects;
drop policy if exists "images_admin_insert" on storage.objects;
drop policy if exists "images_admin_update" on storage.objects;
drop policy if exists "images_admin_delete" on storage.objects;

create policy "images_public_read" on storage.objects for select using (bucket_id = 'offer-images');
create policy "images_admin_insert" on storage.objects for insert to authenticated with check (bucket_id = 'offer-images');
create policy "images_admin_update" on storage.objects for update to authenticated using (bucket_id = 'offer-images');
create policy "images_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'offer-images');
