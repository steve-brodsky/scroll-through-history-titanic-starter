insert into episodes (
  slug, title, subtitle, description, starts_at, ends_at, default_timezone, status
)
values (
  'titanic-1912',
  'Titanic: The Maiden Voyage',
  'Episode 001',
  'Experience the Titanic disaster through a source-backed chronological feed.',
  '1912-04-10T12:00:00Z',
  '1912-04-18T23:59:00Z',
  'UTC',
  'published'
)
on conflict (slug) do nothing;

with ep as (
  select id from episodes where slug = 'titanic-1912'
)
insert into historical_entities (episode_id, slug, name, entity_type, is_real, role)
select ep.id, x.slug, x.name, x.entity_type, x.is_real, x.role
from ep
cross join (values
  ('titanic-wireless', 'Titanic Wireless', 'system', true, 'Marconi room • RMS Titanic'),
  ('rms-titanic', 'RMS Titanic', 'ship', true, 'White Star Line ocean liner'),
  ('rms-carpathia', 'RMS Carpathia', 'ship', true, 'Cunard Line ocean liner'),
  ('cyril-evans', 'Cyril Evans', 'person', true, 'Wireless operator • SS Californian')
) as x(slug, name, entity_type, is_real, role)
on conflict (episode_id, slug) do nothing;

with ep as (
  select id from episodes where slug = 'titanic-1912'
)
insert into sources (
  episode_id, slug, title, source_type, url, publisher, is_primary, citation
)
select ep.id, x.slug, x.title, x.source_type, x.url, x.publisher, x.is_primary, x.citation
from ep
cross join (values
  (
    'british-inquiry-assistance',
    'British Wreck Commissioner Inquiry — Means taken to procure assistance',
    'inquiry_report',
    'https://www.titanicinquiry.org/BOTInq/BOTReport/botRepAssist.php',
    'British Wreck Commissioner Inquiry',
    true,
    'British Wreck Commissioner Inquiry, Report: Means taken to procure assistance.'
  ),
  (
    'us-inquiry-evans',
    'U.S. Senate Inquiry — Testimony of Cyril F. Evans',
    'testimony',
    'https://www.titanicinquiry.org/USInq/AmInq08EvansCF01.php',
    'United States Senate Inquiry',
    true,
    'U.S. Senate Inquiry, testimony of Cyril F. Evans, wireless operator, SS Californian.'
  )
) as x(slug, title, source_type, url, publisher, is_primary, citation)
on conflict (episode_id, slug) do nothing;
