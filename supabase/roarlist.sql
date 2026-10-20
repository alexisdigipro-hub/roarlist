-- RoarList (themadlions.com/roarlist, Alex 20 Oct 2026): shot lists in the cloud for the web app.
-- Lives in RoarMe's Supabase project (bzmjhbnwhdwmncxkqkdl) and signs in with RoarMe's accounts, like Roardino,
-- but keeps its own tables and bucket; it never reads or writes roar_* or roardino_*.
-- Safe to run again.

-- one row per shot list; data is the whole project (scenes, shots, image file names)
create table if not exists public.roarlist_projects (
  id         uuid primary key,
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roarlist_projects_size check (octet_length(data::text) <= 2000000)
);
create index if not exists roarlist_projects_owner on public.roarlist_projects (owner, updated_at desc);
alter table public.roarlist_projects enable row level security;
drop policy if exists roarlist_projects_own on public.roarlist_projects;
create policy roarlist_projects_own on public.roarlist_projects
  for all to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

-- a person's settings (look, language, defaults), so they follow the account
create table if not exists public.roarlist_settings (
  id         uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint roarlist_settings_size check (octet_length(data::text) <= 20000)
);
alter table public.roarlist_settings enable row level security;
drop policy if exists roarlist_settings_own on public.roarlist_settings;
create policy roarlist_settings_own on public.roarlist_settings
  for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create or replace function public.roarlist_touch() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists roarlist_projects_touch on public.roarlist_projects;
create trigger roarlist_projects_touch before update on public.roarlist_projects for each row execute function public.roarlist_touch();
drop trigger if exists roarlist_settings_touch on public.roarlist_settings;
create trigger roarlist_settings_touch before update on public.roarlist_settings for each row execute function public.roarlist_touch();
revoke all on function public.roarlist_touch() from public, anon, authenticated;

revoke all on public.roarlist_projects, public.roarlist_settings from anon;
revoke insert, update on public.roarlist_projects, public.roarlist_settings from authenticated;
grant insert (id, data) on public.roarlist_projects to authenticated;
grant update (data) on public.roarlist_projects to authenticated;
grant select, delete on public.roarlist_projects to authenticated;
grant insert (data) on public.roarlist_settings to authenticated;
grant update (data) on public.roarlist_settings to authenticated;
grant select, delete on public.roarlist_settings to authenticated;

-- the frames: private bucket, <user id>/<project id>/<file>, only the owner reads or writes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('roarlist-images', 'roarlist-images', false, 15728640, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists roarlist_images_read on storage.objects;
create policy roarlist_images_read on storage.objects for select to authenticated
  using (bucket_id = 'roarlist-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists roarlist_images_write on storage.objects;
create policy roarlist_images_write on storage.objects for insert to authenticated
  with check (bucket_id = 'roarlist-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists roarlist_images_update on storage.objects;
create policy roarlist_images_update on storage.objects for update to authenticated
  using (bucket_id = 'roarlist-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'roarlist-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists roarlist_images_delete on storage.objects;
create policy roarlist_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'roarlist-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
