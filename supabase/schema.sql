-- Denahin: proyek denah milik tiap pengguna. Jalankan ulang aman (idempoten).
-- Terapkan dengan: npm run db:apply

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  data jsonb not null check (pg_column_size(data) < 2000000), -- batas wajar satu denah, cegah penyalahgunaan penyimpanan
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);

-- RLS: tiap pengguna hanya melihat dan mengubah barisnya sendiri.
alter table public.projects enable row level security;

drop policy if exists "pemilik membaca" on public.projects;
create policy "pemilik membaca" on public.projects for select
  to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "pemilik menambah" on public.projects;
create policy "pemilik menambah" on public.projects for insert
  to authenticated with check ((select auth.uid()) = user_id);

-- WITH CHECK mencegah baris dipindah ke pengguna lain.
drop policy if exists "pemilik mengubah" on public.projects;
create policy "pemilik mengubah" on public.projects for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "pemilik menghapus" on public.projects;
create policy "pemilik menghapus" on public.projects for delete
  to authenticated using ((select auth.uid()) = user_id);

-- Tabel baru tidak otomatis terbuka ke Data API (perubahan Supabase 2026). Hanya pengguna login, bukan anon.
revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;
