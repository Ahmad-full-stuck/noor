-- Noor private sync foundation
-- Apply this migration in the Supabase SQL Editor for the dedicated Noor project.
-- User data is scoped by auth.uid(); the browser must NEVER use a service_role key.

begin;

create table if not exists public.noor_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.noor_snapshots enable row level security;

-- The browser can read only its own snapshot. Writes must go through the
-- compare-and-swap RPC so a stale device cannot silently overwrite a newer one.
revoke all on table public.noor_snapshots from anon, authenticated;
grant select on table public.noor_snapshots to authenticated;

drop policy if exists "Noor users can read their own snapshot" on public.noor_snapshots;
create policy "Noor users can read their own snapshot"
  on public.noor_snapshots
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.save_noor_snapshot(
  p_expected_revision bigint,
  p_payload jsonb
)
returns table (revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_current_revision bigint;
  v_saved_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'NOOR_AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'NOOR_INVALID_REVISION' using errcode = '22023';
  end if;

  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'NOOR_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  -- Snapshots should contain structured app data and file references, not large
  -- base64 files. Files belong in the private Storage bucket below.
  if pg_catalog.octet_length(p_payload::text) > 8388608 then
    raise exception 'NOOR_PAYLOAD_TOO_LARGE' using errcode = '22001';
  end if;

  insert into public.noor_snapshots (user_id, revision, payload, updated_at)
  values (v_user_id, 0, '{}'::jsonb, pg_catalog.clock_timestamp())
  on conflict (user_id) do nothing;

  select s.revision
    into v_current_revision
    from public.noor_snapshots as s
   where s.user_id = v_user_id
   for update;

  if v_current_revision <> p_expected_revision then
    raise exception 'NOOR_REVISION_CONFLICT'
      using errcode = '40001',
            detail = pg_catalog.format(
              'expected=%s; current=%s',
              p_expected_revision,
              v_current_revision
            );
  end if;

  v_saved_at := pg_catalog.clock_timestamp();

  update public.noor_snapshots as s
     set payload = p_payload,
         revision = v_current_revision + 1,
         updated_at = v_saved_at
   where s.user_id = v_user_id;

  return query select v_current_revision + 1, v_saved_at;
end;
$function$;

revoke all on function public.save_noor_snapshot(bigint, jsonb) from public, anon;
grant execute on function public.save_noor_snapshot(bigint, jsonb) to authenticated;

-- A private bucket for PDFs and other user files.
-- The first folder in every object path MUST be the authenticated user's UUID.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'noor-private',
  'noor-private',
  false,
  52428800,
  array[
    'application/pdf',
    'application/epub+zip',
    'text/plain',
    'text/markdown',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set name = excluded.name,
      public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Noor files: read own" on storage.objects;
create policy "Noor files: read own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'noor-private'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Noor files: upload own" on storage.objects;
create policy "Noor files: upload own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'noor-private'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Noor files: update own" on storage.objects;
create policy "Noor files: update own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'noor-private'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'noor-private'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Noor files: delete own" on storage.objects;
create policy "Noor files: delete own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'noor-private'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

commit;
