-- Pastas de videos
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  created_at timestamptz not null default now()
);

-- Videos em fila de renderizacao
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  folder_id uuid not null references public.folders(id) on delete cascade,
  title text not null,
  status text not null default 'queued',
  error text,
  settings jsonb not null,
  scenes jsonb not null,
  audio_path text,
  output_paths text[] not null default '{}',
  total_seconds integer not null,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index videos_queue_idx on public.videos (status, created_at);

grant select, insert, update, delete on public.folders to authenticated;
grant all on public.folders to service_role;
grant select, insert, update, delete on public.videos to authenticated;
grant all on public.videos to service_role;

alter table public.folders enable row level security;
alter table public.videos enable row level security;

create policy "Users manage own folders"
  on public.folders for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own videos"
  on public.videos for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.update_updated_at_column() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger update_videos_updated_at
  before update on public.videos
  for each row execute function public.update_updated_at_column();

-- Fila: reivindica o proximo video (um por vez, sem duplicar; travados >7h voltam pra fila)
create or replace function public.claim_video_job()
returns public.videos
language sql
security definer
set search_path = public
as $$
  update public.videos v
  set status = 'rendering', locked_at = now(), updated_at = now()
  from (
    select id from public.videos
    where status = 'queued'
       or (status = 'rendering' and (locked_at is null or locked_at < now() - interval '7 hours'))
    order by created_at
    limit 1
    for update skip locked
  ) claimed
  where v.id = claimed.id
  returning v.*;
$$;

revoke execute on function public.claim_video_job() from public;
revoke execute on function public.claim_video_job() from anon;
revoke execute on function public.claim_video_job() from authenticated;
grant execute on function public.claim_video_job() to service_role;

-- Arquivos no bucket privado 'videos': cada usuario gerencia apenas seus arquivos
create policy "Users manage own video files"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
