-- Scroll Through History
-- Claim ingestion support

alter table public.claims
add column if not exists extraction_key text;

create unique index if not exists
claims_extraction_key_unique_idx
on public.claims(extraction_key)
where extraction_key is not null;
