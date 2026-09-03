-- Scroll Through History
-- Generic Historical Data Schema v2.0
--
-- Design principles:
-- 1. Episodes are curated experiences, not owners of historical truth.
-- 2. Sources and entities are global and reusable across episodes.
-- 3. Claims are atomic historical assertions grounded in source segments.
-- 4. Historical time does not require a modern timestamp.
-- 5. Normalization and narrative ordering are separate from source evidence.
-- 6. Events are episode-level syntheses built from approved claims.
-- 7. Posts are presentation-layer representations of claims/events.

create extension if not exists pgcrypto;


-- ============================================================
-- UPDATED_AT SUPPORT
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- EPISODES
-- ============================================================

create table public.episodes (
  id uuid primary key default gen_random_uuid(),

  slug text not null unique,
  title text not null,
  subtitle text,
  description text,

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'review',
        'published',
        'archived'
      )
    ),

  -- Flexible episode-level historical context.
  --
  -- Example:
  -- {
  --   "start": "1912-04-10",
  --   "end": "1912-04-18",
  --   "default_calendar_system": "gregorian"
  -- }
  --
  -- This is contextual metadata, NOT historical evidence.
  temporal_context jsonb not null default '{}'::jsonb,

  geographic_context jsonb not null default '{}'::jsonb,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger episodes_set_updated_at
before update on public.episodes
for each row
execute function public.set_updated_at();


-- ============================================================
-- GLOBAL SOURCES
-- ============================================================
--
-- Sources are NOT owned by episodes.
--
-- The same source might support:
-- - multiple episodes
-- - multiple events
-- - multiple claims
--
-- Example:
-- A collection of Napoleon's correspondence could support several
-- different Napoleon episodes.

create table public.sources (
  id uuid primary key default gen_random_uuid(),

  slug text not null unique,

  title text not null,

  -- Flexible taxonomy.
  --
  -- Examples:
  -- testimony
  -- inquiry_report
  -- inscription
  -- archaeological_report
  -- newspaper
  -- diary
  -- letter
  -- census
  -- military_dispatch
  -- audio_recording
  --
  -- Do NOT constrain historical source types in the database.
  source_type text,

  creator_text text,
  publisher text,

  -- Intentionally text instead of date.
  --
  -- Historical publication dating may be:
  -- "1912"
  -- "late 5th century BCE"
  -- "during the reign of..."
  publication_text text,

  url text,

  citation text,

  is_primary boolean not null default false,

  rights_notes text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sources_set_updated_at
before update on public.sources
for each row
execute function public.set_updated_at();


-- ============================================================
-- EPISODE <-> SOURCE RELATIONSHIP
-- ============================================================

create table public.episode_sources (
  episode_id uuid not null
    references public.episodes(id)
    on delete cascade,

  source_id uuid not null
    references public.sources(id)
    on delete cascade,

  relationship_type text not null default 'evidence',

  notes text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  primary key (episode_id, source_id)
);


-- ============================================================
-- SOURCE SEGMENTS
-- ============================================================
--
-- Claims should normally be extracted from a specific source segment,
-- not from an entire book/report/archive.
--
-- Examples:
--
-- Book VI, Chapter 3
-- Harold Bride testimony, questions 16520-16540
-- Page 27
-- Telegram 003
-- Paragraph 17
-- Video 00:14:22 - 00:15:40

create table public.source_segments (
  id uuid primary key default gen_random_uuid(),

  source_id uuid not null
    references public.sources(id)
    on delete cascade,

  parent_segment_id uuid
    references public.source_segments(id)
    on delete cascade,

  -- Stable identifier inside the source.
  --
  -- Examples:
  -- "chapter-6"
  -- "bride-q16520-16540"
  -- "page-27"
  -- "telegram-003"
  segment_key text not null,

  title text,

  -- Human-readable locator in the original source.
  locator text,

  -- Ordering within the source.
  sequence_index numeric,

  -- Historical/source material used by extraction.
  --
  -- This may be null when storage rights or architecture require
  -- the content to remain external.
  raw_text text,

  content_hash text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_id, segment_key)
);

create trigger source_segments_set_updated_at
before update on public.source_segments
for each row
execute function public.set_updated_at();


-- ============================================================
-- GLOBAL HISTORICAL ENTITIES
-- ============================================================
--
-- Entities are global.
--
-- Napoleon is one entity whether he appears in one episode or twenty.
--
-- Entity taxonomy is intentionally flexible.

create table public.entities (
  id uuid primary key default gen_random_uuid(),

  slug text not null unique,

  canonical_name text not null,

  -- Examples:
  -- person
  -- vessel
  -- organization
  -- government
  -- military_unit
  -- city
  -- geographic_place
  -- publication
  -- building
  -- object
  -- system
  -- composite
  entity_type text,

  -- More expressive than is_real boolean.
  --
  -- Examples:
  -- historical
  -- composite
  -- disputed
  -- legendary
  -- editorial
  historicity_status text not null default 'historical',

  description text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger entities_set_updated_at
before update on public.entities
for each row
execute function public.set_updated_at();


-- ============================================================
-- ENTITY ALIASES
-- ============================================================
--
-- Example:
--
-- Entity:
-- Ulysses S. Grant
--
-- Aliases:
-- "Gen. Grant"
-- "Grant"
-- "U. S. Grant"
--
-- Extraction preserves source wording.
-- Entity resolution happens later.

create table public.entity_aliases (
  id uuid primary key default gen_random_uuid(),

  entity_id uuid not null
    references public.entities(id)
    on delete cascade,

  alias text not null,

  alias_type text,

  language_code text,

  -- Optional provenance for an alias.
  source_id uuid
    references public.sources(id)
    on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  unique (entity_id, alias)
);


-- ============================================================
-- EPISODE <-> ENTITY RELATIONSHIP
-- ============================================================

create table public.episode_entities (
  episode_id uuid not null
    references public.episodes(id)
    on delete cascade,

  entity_id uuid not null
    references public.entities(id)
    on delete cascade,

  role_text text,

  profile_notes text,

  -- Voice guidance is episode/presentation-specific.
  voice_notes text,

  sort_key numeric,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  primary key (episode_id, entity_id)
);


-- ============================================================
-- ATOMIC HISTORICAL CLAIMS
-- ============================================================
--
-- Claims represent evidence-grounded assertions.
--
-- They are NOT social posts.
-- They are NOT events.
-- They are NOT narrative summaries.
--
-- Claims are global because historical evidence itself is not
-- owned by a single episode.

create table public.claims (
  id uuid primary key default gen_random_uuid(),

  statement text not null,

  -- Flexible taxonomy:
  -- action
  -- communication
  -- observation
  -- condition
  -- identity
  -- relationship
  -- etc.
  claim_type text,

  location_text text,

  confidence numeric(4,3)
    check (
      confidence is null
      or (
        confidence >= 0
        and confidence <= 1
      )
    ),

  knowledge_notes text,


  -- ========================================================
  -- SOURCE-EXPRESSED TEMPORAL INFORMATION
  -- ========================================================

  temporal_raw_text text,

  temporal_kind text,

  temporal_relation text,

  temporal_granularity text,

  temporal_certainty text,

  calendar_system text,

  calendar_system_status text,

  clock_system text,

  clock_system_status text,

  temporal_anchor_text text,


  -- ========================================================
  -- LATER NORMALIZATION
  -- ========================================================
  --
  -- These fields are NOT populated by Claim Extractor v1.
  --
  -- They are filled by a later normalization/editorial stage.
  --
  -- TEXT is deliberate:
  -- PostgreSQL timestamptz is not our canonical representation
  -- for all human history.

  normalized_start_text text,

  normalized_end_text text,

  normalization_status text not null default 'unresolved',

  normalization_notes text,


  -- ========================================================
  -- REVIEW / PROVENANCE
  -- ========================================================

  review_status text not null default 'pending'
    check (
      review_status in (
        'pending',
        'approved',
        'rejected',
        'needs_review'
      )
    ),

  review_notes text,

  reviewed_at timestamptz,

  extraction_version text,

  extraction_model text,

  generation_meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger claims_set_updated_at
before update on public.claims
for each row
execute function public.set_updated_at();


-- ============================================================
-- CLAIM EVIDENCE
-- ============================================================
--
-- A claim may be supported by multiple source segments.
--
-- A source segment may support multiple claims.

create table public.claim_evidence (
  id uuid primary key default gen_random_uuid(),

  claim_id uuid not null
    references public.claims(id)
    on delete cascade,

  source_segment_id uuid not null
    references public.source_segments(id)
    on delete cascade,

  evidence_text text not null,

  -- Examples:
  -- direct
  -- corroborating
  -- contradictory
  -- contextual
  evidence_type text not null default 'direct',

  sequence_index integer,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);


-- ============================================================
-- CLAIM <-> ENTITY RELATIONSHIP
-- ============================================================
--
-- mention_text preserves the exact extracted form.
--
-- Example:
--
-- mention_text = "Gen. Grant"
-- entity_id -> Ulysses S. Grant

create table public.claim_entities (
  id uuid primary key default gen_random_uuid(),

  claim_id uuid not null
    references public.claims(id)
    on delete cascade,

  entity_id uuid not null
    references public.entities(id)
    on delete cascade,

  mention_text text,

  role_text text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);


-- ============================================================
-- EPISODE <-> CLAIM RELATIONSHIP
-- ============================================================
--
-- One historical claim can be relevant to multiple episodes.
--
-- sort_key controls ordering inside a specific episode.
-- It is NOT necessarily a timestamp.

create table public.episode_claims (
  episode_id uuid not null
    references public.episodes(id)
    on delete cascade,

  claim_id uuid not null
    references public.claims(id)
    on delete cascade,

  inclusion_status text not null default 'candidate'
    check (
      inclusion_status in (
        'candidate',
        'included',
        'excluded'
      )
    ),

  sort_key numeric,

  notes text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  primary key (episode_id, claim_id)
);


-- ============================================================
-- HISTORICAL EVENTS
-- ============================================================
--
-- Events are curated historical syntheses built from claims.
--
-- Unlike claims, an event may be episode-specific because different
-- episodes can group historical facts at different levels of detail.

create table public.historical_events (
  id uuid primary key default gen_random_uuid(),

  episode_id uuid not null
    references public.episodes(id)
    on delete cascade,

  slug text not null,

  title text not null,

  summary text,

  event_type text,

  location_text text,

  confidence numeric(4,3)
    check (
      confidence is null
      or (
        confidence >= 0
        and confidence <= 1
      )
    ),


  -- Historical temporal description

  temporal_raw_text text,
  temporal_kind text,
  temporal_relation text,
  temporal_granularity text,
  temporal_certainty text,

  calendar_system text,
  calendar_system_status text,

  clock_system text,
  clock_system_status text,

  temporal_anchor_text text,


  -- Optional editorial normalization

  normalized_start_text text,
  normalized_end_text text,

  normalization_status text not null default 'unresolved',

  normalization_notes text,


  -- Narrative ordering within the episode.
  --
  -- This allows uncertain/ancient events to appear in correct sequence
  -- without inventing timestamps.

  sort_key numeric,


  review_status text not null default 'pending'
    check (
      review_status in (
        'pending',
        'approved',
        'rejected',
        'needs_review'
      )
    ),

  review_notes text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (episode_id, slug)
);

create trigger historical_events_set_updated_at
before update on public.historical_events
for each row
execute function public.set_updated_at();


-- ============================================================
-- EVENT <-> CLAIM RELATIONSHIP
-- ============================================================

create table public.event_claims (
  event_id uuid not null
    references public.historical_events(id)
    on delete cascade,

  claim_id uuid not null
    references public.claims(id)
    on delete cascade,

  -- Examples:
  -- supports
  -- contradicts
  -- contextualizes
  relationship_type text not null default 'supports',

  notes text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  primary key (event_id, claim_id)
);


-- ============================================================
-- EVENT <-> ENTITY RELATIONSHIP
-- ============================================================

create table public.event_entities (
  event_id uuid not null
    references public.historical_events(id)
    on delete cascade,

  entity_id uuid not null
    references public.entities(id)
    on delete cascade,

  role_text text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  primary key (event_id, entity_id)
);


-- ============================================================
-- FEED POSTS
-- ============================================================
--
-- Posts are presentation-layer content.
--
-- Historical truth lives in claims/source evidence.
--
-- sort_key is the canonical feed-order mechanism.
-- It does NOT require a modern timestamp.

create table public.posts (
  id uuid primary key default gen_random_uuid(),

  episode_id uuid not null
    references public.episodes(id)
    on delete cascade,

  author_entity_id uuid
    references public.entities(id)
    on delete set null,

  event_id uuid
    references public.historical_events(id)
    on delete set null,

  parent_post_id uuid
    references public.posts(id)
    on delete cascade,

  -- Canonical episode feed order.
  sort_key numeric not null,

  -- Human-facing historical label.
  --
  -- Examples:
  -- "12:15 AM"
  -- "Before sunrise"
  -- "Summer 480 BCE"
  -- "Day 3"
  display_time_text text,

  -- Optional normalized representation if later available.
  normalized_time_text text,

  content text not null,

  -- Flexible presentation taxonomy.
  --
  -- Examples:
  -- post
  -- status
  -- wireless
  -- artifact
  -- news
  -- context
  -- quote
  post_type text not null default 'post',

  -- Examples:
  -- documented
  -- reconstructed
  -- composite
  -- context
  accuracy_type text not null default 'reconstructed',

  status text not null default 'draft'
    check (
      status in (
        'candidate',
        'draft',
        'approved',
        'rejected',
        'published'
      )
    ),

  generated_by text,

  generation_meta jsonb not null default '{}'::jsonb,

  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger posts_set_updated_at
before update on public.posts
for each row
execute function public.set_updated_at();


-- ============================================================
-- POST <-> CLAIM PROVENANCE
-- ============================================================

create table public.post_claims (
  post_id uuid not null
    references public.posts(id)
    on delete cascade,

  claim_id uuid not null
    references public.claims(id)
    on delete cascade,

  -- Examples:
  -- primary_basis
  -- supporting
  -- context
  usage_type text not null default 'primary_basis',

  notes text,

  created_at timestamptz not null default now(),

  primary key (post_id, claim_id)
);


-- ============================================================
-- POST <-> SOURCE PROVENANCE
-- ============================================================
--
-- Useful for artifact cards or direct citation even when a post does
-- not map cleanly through a claim.

create table public.post_sources (
  id uuid primary key default gen_random_uuid(),

  post_id uuid not null
    references public.posts(id)
    on delete cascade,

  source_id uuid not null
    references public.sources(id)
    on delete cascade,

  source_segment_id uuid
    references public.source_segments(id)
    on delete set null,

  note text,

  created_at timestamptz not null default now()
);


-- ============================================================
-- INDEXES
-- ============================================================

create index episode_sources_episode_idx
  on public.episode_sources(episode_id);

create index episode_sources_source_idx
  on public.episode_sources(source_id);

create index source_segments_source_sequence_idx
  on public.source_segments(source_id, sequence_index);

create index entity_aliases_alias_idx
  on public.entity_aliases(alias);

create index episode_entities_episode_idx
  on public.episode_entities(episode_id);

create index claim_evidence_claim_idx
  on public.claim_evidence(claim_id);

create index claim_evidence_segment_idx
  on public.claim_evidence(source_segment_id);

create index claim_entities_claim_idx
  on public.claim_entities(claim_id);

create index claim_entities_entity_idx
  on public.claim_entities(entity_id);

create index claims_review_status_idx
  on public.claims(review_status);

create index episode_claims_episode_sort_idx
  on public.episode_claims(episode_id, sort_key);

create index historical_events_episode_sort_idx
  on public.historical_events(episode_id, sort_key);

create index historical_events_review_idx
  on public.historical_events(review_status);

create index event_claims_claim_idx
  on public.event_claims(claim_id);

create index event_entities_entity_idx
  on public.event_entities(entity_id);

create index posts_episode_status_sort_idx
  on public.posts(episode_id, status, sort_key);

create index posts_event_idx
  on public.posts(event_id);

create index posts_parent_idx
  on public.posts(parent_post_id);

create index post_claims_claim_idx
  on public.post_claims(claim_id);

create index post_sources_post_idx
  on public.post_sources(post_id);

create index post_sources_source_idx
  on public.post_sources(source_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
--
-- Public clients receive SELECT-only access to explicitly published
-- material.
--
-- Admin/source ingestion will later run server-side using elevated
-- credentials.
--
-- Private editorial/source-material tables do not receive public
-- SELECT grants unless explicitly needed.


alter table public.episodes enable row level security;
alter table public.sources enable row level security;
alter table public.episode_sources enable row level security;
alter table public.source_segments enable row level security;

alter table public.entities enable row level security;
alter table public.entity_aliases enable row level security;
alter table public.episode_entities enable row level security;

alter table public.claims enable row level security;
alter table public.claim_evidence enable row level security;
alter table public.claim_entities enable row level security;
alter table public.episode_claims enable row level security;

alter table public.historical_events enable row level security;
alter table public.event_claims enable row level security;
alter table public.event_entities enable row level security;

alter table public.posts enable row level security;
alter table public.post_claims enable row level security;
alter table public.post_sources enable row level security;


-- Remove accidental client write access.

revoke all on table public.episodes
from anon, authenticated;

revoke all on table public.sources
from anon, authenticated;

revoke all on table public.episode_sources
from anon, authenticated;

revoke all on table public.source_segments
from anon, authenticated;

revoke all on table public.entities
from anon, authenticated;

revoke all on table public.entity_aliases
from anon, authenticated;

revoke all on table public.episode_entities
from anon, authenticated;

revoke all on table public.claims
from anon, authenticated;

revoke all on table public.claim_evidence
from anon, authenticated;

revoke all on table public.claim_entities
from anon, authenticated;

revoke all on table public.episode_claims
from anon, authenticated;

revoke all on table public.historical_events
from anon, authenticated;

revoke all on table public.event_claims
from anon, authenticated;

revoke all on table public.event_entities
from anon, authenticated;

revoke all on table public.posts
from anon, authenticated;

revoke all on table public.post_claims
from anon, authenticated;

revoke all on table public.post_sources
from anon, authenticated;


-- Public-readable tables.

grant select on table public.episodes
to anon, authenticated;

grant select on table public.sources
to anon, authenticated;

grant select on table public.episode_sources
to anon, authenticated;

grant select on table public.entities
to anon, authenticated;

grant select on table public.episode_entities
to anon, authenticated;

grant select on table public.claims
to anon, authenticated;

grant select on table public.claim_evidence
to anon, authenticated;

grant select on table public.historical_events
to anon, authenticated;

grant select on table public.event_claims
to anon, authenticated;

grant select on table public.event_entities
to anon, authenticated;

grant select on table public.posts
to anon, authenticated;

grant select on table public.post_claims
to anon, authenticated;

grant select on table public.post_sources
to anon, authenticated;


-- ============================================================
-- PUBLIC SELECT POLICIES
-- ============================================================


-- Published episodes

create policy "public can read published episodes"
on public.episodes
for select
to anon, authenticated
using (
  status = 'published'
);


-- Sources attached to published episodes

create policy "public can read sources for published episodes"
on public.sources
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.episode_sources es
    join public.episodes e
      on e.id = es.episode_id
    where es.source_id = sources.id
      and e.status = 'published'
  )
);


create policy "public can read published episode source links"
on public.episode_sources
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.episodes e
    where e.id = episode_sources.episode_id
      and e.status = 'published'
  )
);


-- Global entities only become public when used by a published episode.

create policy "public can read entities in published episodes"
on public.entities
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.episode_entities ee
    join public.episodes e
      on e.id = ee.episode_id
    where ee.entity_id = entities.id
      and e.status = 'published'
  )
  or exists (
    select 1
    from public.posts p
    join public.episodes e
      on e.id = p.episode_id
    where p.author_entity_id = entities.id
      and p.status = 'published'
      and e.status = 'published'
  )
);


create policy "public can read published episode entity links"
on public.episode_entities
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.episodes e
    where e.id = episode_entities.episode_id
      and e.status = 'published'
  )
);


-- Claims are public only when approved AND actually used by a
-- published post.

create policy "public can read approved claims behind published posts"
on public.claims
for select
to anon, authenticated
using (
  review_status = 'approved'
  and exists (
    select 1
    from public.post_claims pc
    join public.posts p
      on p.id = pc.post_id
    join public.episodes e
      on e.id = p.episode_id
    where pc.claim_id = claims.id
      and p.status = 'published'
      and e.status = 'published'
  )
);


create policy "public can read evidence for published claims"
on public.claim_evidence
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.claims c
    join public.post_claims pc
      on pc.claim_id = c.id
    join public.posts p
      on p.id = pc.post_id
    join public.episodes e
      on e.id = p.episode_id
    where c.id = claim_evidence.claim_id
      and c.review_status = 'approved'
      and p.status = 'published'
      and e.status = 'published'
  )
);


-- Approved events for published episodes.

create policy "public can read approved events in published episodes"
on public.historical_events
for select
to anon, authenticated
using (
  review_status = 'approved'
  and exists (
    select 1
    from public.episodes e
    where e.id = historical_events.episode_id
      and e.status = 'published'
  )
);


create policy "public can read claim links for published events"
on public.event_claims
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.historical_events he
    join public.episodes e
      on e.id = he.episode_id
    where he.id = event_claims.event_id
      and he.review_status = 'approved'
      and e.status = 'published'
  )
);


create policy "public can read entity links for published events"
on public.event_entities
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.historical_events he
    join public.episodes e
      on e.id = he.episode_id
    where he.id = event_entities.event_id
      and he.review_status = 'approved'
      and e.status = 'published'
  )
);


-- Published feed posts.

create policy "public can read published posts"
on public.posts
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.episodes e
    where e.id = posts.episode_id
      and e.status = 'published'
  )
);


create policy "public can read claim links for published posts"
on public.post_claims
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.posts p
    join public.episodes e
      on e.id = p.episode_id
    where p.id = post_claims.post_id
      and p.status = 'published'
      and e.status = 'published'
  )
);


create policy "public can read source links for published posts"
on public.post_sources
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.posts p
    join public.episodes e
      on e.id = p.episode_id
    where p.id = post_sources.post_id
      and p.status = 'published'
      and e.status = 'published'
  )
);