create extension if not exists pgcrypto;

create table if not exists episodes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  default_timezone text not null default 'UTC',
  status text not null default 'draft'
    check (status in ('draft', 'review', 'published')),
  created_at timestamptz not null default now()
);

create table if not exists historical_entities (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  slug text not null,
  name text not null,
  entity_type text not null
    check (entity_type in ('person', 'ship', 'organization', 'publication', 'system', 'composite')),
  is_real boolean not null default true,
  role text,
  bio text,
  voice_notes text,
  created_at timestamptz not null default now(),
  unique (episode_id, slug)
);

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  slug text not null,
  title text not null,
  source_type text not null
    check (source_type in ('testimony', 'inquiry_report', 'newspaper', 'letter', 'diary', 'telegram', 'wireless_log', 'book', 'photo', 'other')),
  url text,
  publisher text,
  published_at date,
  is_primary boolean not null default false,
  citation text,
  raw_text text,
  notes text,
  created_at timestamptz not null default now(),
  unique (episode_id, slug)
);

create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  source_id uuid not null references sources(id) on delete cascade,
  statement text not null,
  evidence_excerpt text,
  occurred_at timestamptz,
  known_by_actor_at timestamptz,
  publicly_known_at timestamptz,
  time_precision text not null default 'unknown'
    check (time_precision in ('exact', 'approximate', 'date_only', 'unknown')),
  location_text text,
  confidence numeric(4,3) not null default 0.500
    check (confidence >= 0 and confidence <= 1),
  review_status text not null default 'draft'
    check (review_status in ('draft', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists historical_events (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  slug text not null,
  title text not null,
  summary text not null,
  occurred_at timestamptz,
  known_by_actor_at timestamptz,
  publicly_known_at timestamptz,
  time_precision text not null default 'unknown'
    check (time_precision in ('exact', 'approximate', 'date_only', 'unknown')),
  location_text text,
  event_type text,
  confidence numeric(4,3) not null default 0.500
    check (confidence >= 0 and confidence <= 1),
  review_status text not null default 'draft'
    check (review_status in ('draft', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (episode_id, slug)
);

create table if not exists event_claims (
  event_id uuid not null references historical_events(id) on delete cascade,
  claim_id uuid not null references claims(id) on delete cascade,
  primary key (event_id, claim_id)
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  author_entity_id uuid not null references historical_entities(id) on delete cascade,
  event_id uuid references historical_events(id) on delete set null,
  feed_time timestamptz not null,
  content text not null,
  post_type text not null default 'post'
    check (post_type in ('post', 'status', 'wireless', 'artifact', 'news', 'context')),
  accuracy_type text not null
    check (accuracy_type in ('documented', 'reconstructed', 'composite', 'context')),
  status text not null default 'draft'
    check (status in ('candidate', 'draft', 'approved', 'rejected', 'published')),
  generated_by text,
  generation_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists post_sources (
  post_id uuid not null references posts(id) on delete cascade,
  source_id uuid not null references sources(id) on delete cascade,
  note text,
  primary key (post_id, source_id)
);

alter table episodes enable row level security;
alter table historical_entities enable row level security;
alter table sources enable row level security;
alter table historical_events enable row level security;
alter table posts enable row level security;
alter table post_sources enable row level security;

create policy "published episodes are public"
  on episodes for select
  using (status = 'published');

create policy "entities in published episodes are public"
  on historical_entities for select
  using (exists (
    select 1 from episodes e
    where e.id = historical_entities.episode_id
      and e.status = 'published'
  ));

create policy "sources in published episodes are public"
  on sources for select
  using (exists (
    select 1 from episodes e
    where e.id = sources.episode_id
      and e.status = 'published'
  ));

create policy "approved events in published episodes are public"
  on historical_events for select
  using (
    review_status = 'approved'
    and exists (
      select 1 from episodes e
      where e.id = historical_events.episode_id
        and e.status = 'published'
    )
  );

create policy "published posts are public"
  on posts for select
  using (
    status = 'published'
    and exists (
      select 1 from episodes e
      where e.id = posts.episode_id
        and e.status = 'published'
    )
  );

create policy "post source links for published posts are public"
  on post_sources for select
  using (exists (
    select 1 from posts p
    where p.id = post_sources.post_id
      and p.status = 'published'
  ));
