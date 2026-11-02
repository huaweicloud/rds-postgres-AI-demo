-- The merged catalog: what we know about each company once a run has finished.

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique,
  description text,
  logo_url text,
  summary text,                      -- merger's architecture summary
  stack_embedding extensions.vector(1024),
  updated_at timestamptz default now()
);

create table technologies (
  id serial primary key,
  slug text unique not null,         -- 'postgresql'
  name text not null,                -- 'PostgreSQL'
  category text not null check (category in
    ('language','frontend','backend','database','data','messaging',
     'cloud','infra','devops','observability','ml','saas')),
  aliases text[] not null default '{}',
  name_embedding extensions.vector(1024)
);

-- Aliases are stored lowercased and version-free, the same way the merger normalizes raw names.
create index technologies_aliases_idx on technologies using gin (aliases);

create table company_stack (
  company_id uuid references companies(id) on delete cascade,
  technology_id int references technologies(id),
  run_id uuid,
  score real not null,
  status text not null check (status in ('in_use','hiring_for','migrated_away','mentioned')),
  agent_count int not null,
  evidence_count int not null,
  primary key (company_id, technology_id)
);
