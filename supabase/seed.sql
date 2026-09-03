-- Scroll Through History
-- Development Seed v2


-- ============================================================
-- EPISODE 001
-- ============================================================

insert into public.episodes (
  slug,
  title,
  subtitle,
  description,
  status,
  temporal_context,
  geographic_context
)
values (
  'titanic-1912',

  'Titanic: The Maiden Voyage',

  'Episode 001',

  'Experience the Titanic disaster through a source-backed chronological feed.',

  'draft',

  '{
    "start": "1912-04-10",
    "end": "1912-04-18",
    "default_calendar_system": "gregorian",
    "notes": "Historical source times may use shipboard or source-specific clock conventions. Do not assume a timezone."
  }'::jsonb,

  '{
    "description": "Southampton, Cherbourg, Queenstown, and the North Atlantic"
  }'::jsonb
)
on conflict (slug)
do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  temporal_context = excluded.temporal_context,
  geographic_context = excluded.geographic_context;


-- ============================================================
-- GLOBAL SOURCES
-- ============================================================

insert into public.sources (
  slug,
  title,
  source_type,
  publisher,
  is_primary,
  url,
  citation,
  metadata
)
values (
  'british-inquiry-assistance',

  'British Wreck Commissioner Inquiry — Means taken to procure assistance',

  'inquiry_report',

  'British Wreck Commissioner Inquiry',

  true,

  'https://www.titanicinquiry.org/BOTInq/BOTReport/botRepAssist.php',

  'British Wreck Commissioner Inquiry, Report: Means taken to procure assistance.',

  '{
    "temporal_context": {
      "date_context": "1912-04-15",
      "calendar_system": "gregorian",
      "clock_basis": "source_unspecified",
      "normalization_status": "partial"
    }
  }'::jsonb
)
on conflict (slug)
do update set
  title = excluded.title,
  source_type = excluded.source_type,
  publisher = excluded.publisher,
  is_primary = excluded.is_primary,
  url = excluded.url,
  citation = excluded.citation,
  metadata = excluded.metadata;


insert into public.sources (
  slug,
  title,
  source_type,
  publisher,
  is_primary,
  url,
  citation
)
values (
  'us-inquiry-evans',

  'U.S. Senate Inquiry — Testimony of Cyril F. Evans',

  'testimony',

  'United States Senate Inquiry',

  true,

  'https://www.titanicinquiry.org/USInq/AmInq08EvansCF01.php',

  'U.S. Senate Inquiry, testimony of Cyril F. Evans, wireless operator, SS Californian.'
)
on conflict (slug)
do update set
  title = excluded.title,
  source_type = excluded.source_type,
  publisher = excluded.publisher,
  is_primary = excluded.is_primary,
  url = excluded.url,
  citation = excluded.citation;


-- ============================================================
-- ATTACH SOURCES TO TITANIC EPISODE
-- ============================================================

insert into public.episode_sources (
  episode_id,
  source_id,
  relationship_type
)
select
  e.id,
  s.id,
  'evidence'
from public.episodes e
join public.sources s
  on s.slug in (
    'british-inquiry-assistance',
    'us-inquiry-evans'
  )
where e.slug = 'titanic-1912'
on conflict (episode_id, source_id)
do nothing;


-- ============================================================
-- GLOBAL ENTITIES
-- ============================================================

insert into public.entities (
  slug,
  canonical_name,
  entity_type,
  historicity_status,
  description
)
values
(
  'rms-titanic',
  'RMS Titanic',
  'vessel',
  'historical',
  'White Star Line ocean liner.'
),
(
  'rms-carpathia',
  'RMS Carpathia',
  'vessel',
  'historical',
  'Cunard Line ocean liner.'
),
(
  'captain-edward-smith',
  'Edward John Smith',
  'person',
  'historical',
  'Captain of RMS Titanic.'
),
(
  'cyril-evans',
  'Cyril F. Evans',
  'person',
  'historical',
  'Wireless operator aboard SS Californian.'
)
on conflict (slug)
do update set
  canonical_name = excluded.canonical_name,
  entity_type = excluded.entity_type,
  historicity_status = excluded.historicity_status,
  description = excluded.description;


-- ============================================================
-- ENTITY ALIASES
-- ============================================================

insert into public.entity_aliases (
  entity_id,
  alias,
  alias_type
)
select
  id,
  'Titanic',
  'common'
from public.entities
where slug = 'rms-titanic'
on conflict (entity_id, alias)
do nothing;


insert into public.entity_aliases (
  entity_id,
  alias,
  alias_type
)
select
  id,
  'Carpathia',
  'common'
from public.entities
where slug = 'rms-carpathia'
on conflict (entity_id, alias)
do nothing;


insert into public.entity_aliases (
  entity_id,
  alias,
  alias_type
)
select
  id,
  'Captain Smith',
  'source_form'
from public.entities
where slug = 'captain-edward-smith'
on conflict (entity_id, alias)
do nothing;


-- ============================================================
-- ATTACH ENTITIES TO TITANIC EPISODE
-- ============================================================

insert into public.episode_entities (
  episode_id,
  entity_id,
  role_text
)
select
  e.id,
  ent.id,
  case ent.slug
    when 'rms-titanic'
      then 'Central vessel'
    when 'rms-carpathia'
      then 'Rescue vessel'
    when 'captain-edward-smith'
      then 'Captain of RMS Titanic'
    when 'cyril-evans'
      then 'Wireless operator aboard SS Californian'
  end
from public.episodes e
join public.entities ent
  on ent.slug in (
    'rms-titanic',
    'rms-carpathia',
    'captain-edward-smith',
    'cyril-evans'
  )
where e.slug = 'titanic-1912'
on conflict (episode_id, entity_id)
do update set
  role_text = excluded.role_text;