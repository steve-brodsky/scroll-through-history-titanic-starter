import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

type JsonRecord = Record<string, unknown>;

type ExtractionProvenance = JsonRecord & {
  episode_id: string;
  source_id: string;
  source_segment_id: string;
  source_segment_key: string;
  episode_manifest_path: string;
  source_manifest_path: string;
  segment_manifest_path: string;
  content_path: string;
};

type ClaimTemporal = {
  raw_text: string | null;
  kind: string;
  relation: string;
  granularity: string;
  certainty: string;
  calendar_system: string | null;
  calendar_system_status: string;
  clock_system: string | null;
  clock_system_status: string;
  anchor_text: string | null;
};

type GeneratedClaim = {
  candidate_id: string;
  extraction_index: number | null;
  statement: string;
  claim_type: string;
  temporal: ClaimTemporal;
  location_text: string | null;
  named_entities: string[];
  evidence: string[];
  confidence: number;
  knowledge_notes: string;
};

type GeneratedExtraction = {
  format_version: string;
  provenance: ExtractionProvenance;
  claims: GeneratedClaim[];
};

type ImportCounts = {
  claimsInserted: number;
  claimsExisting: number;
  evidenceInserted: number;
  evidenceExisting: number;
  episodeLinksInserted: number;
  episodeLinksExisting: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describePath(filePath: string, field?: string): string {
  return field ? `${field} in ${filePath}` : filePath;
}

function requireRecord(
  value: unknown,
  label: string
): JsonRecord {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value;
}

function requireString(
  value: unknown,
  label: string
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  return value;
}

function optionalString(
  value: unknown,
  label: string
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string or null.`);
  }

  return value;
}

function requireNumber(
  value: unknown,
  label: string
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return value;
}

function optionalNumber(
  value: unknown,
  label: string
): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  return requireNumber(value, label);
}

function requireStringArray(
  value: unknown,
  label: string
): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((item, index) =>
    requireString(item, `${label}[${index}]`)
  );
}

async function readJsonFile(filePath: string): Promise<JsonRecord> {
  let raw: string;

  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Could not read ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  try {
    return requireRecord(JSON.parse(raw), filePath);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Could not parse JSON in ${filePath}: ${error.message}`);
    }

    throw error;
  }
}

function validateTemporal(
  value: unknown,
  label: string
): ClaimTemporal {
  const temporal = requireRecord(value, label);

  return {
    raw_text: optionalString(temporal.raw_text, `${label}.raw_text`),
    kind: requireString(temporal.kind, `${label}.kind`),
    relation: requireString(temporal.relation, `${label}.relation`),
    granularity: requireString(
      temporal.granularity,
      `${label}.granularity`
    ),
    certainty: requireString(temporal.certainty, `${label}.certainty`),
    calendar_system: optionalString(
      temporal.calendar_system,
      `${label}.calendar_system`
    ),
    calendar_system_status: requireString(
      temporal.calendar_system_status,
      `${label}.calendar_system_status`
    ),
    clock_system: optionalString(
      temporal.clock_system,
      `${label}.clock_system`
    ),
    clock_system_status: requireString(
      temporal.clock_system_status,
      `${label}.clock_system_status`
    ),
    anchor_text: optionalString(
      temporal.anchor_text,
      `${label}.anchor_text`
    ),
  };
}

function validateGeneratedExtraction(
  value: JsonRecord,
  filePath: string
): GeneratedExtraction {
  const formatVersion = requireString(
    value.format_version,
    describePath(filePath, "format_version")
  );
  const provenanceRecord = requireRecord(
    value.provenance,
    describePath(filePath, "provenance")
  );
  const provenance: ExtractionProvenance = {
    ...provenanceRecord,
    episode_id: requireString(
      provenanceRecord.episode_id,
      "provenance.episode_id"
    ),
    source_id: requireString(
      provenanceRecord.source_id,
      "provenance.source_id"
    ),
    source_segment_id: requireString(
      provenanceRecord.source_segment_id,
      "provenance.source_segment_id"
    ),
    source_segment_key: requireString(
      provenanceRecord.source_segment_key,
      "provenance.source_segment_key"
    ),
    episode_manifest_path: requireString(
      provenanceRecord.episode_manifest_path,
      "provenance.episode_manifest_path"
    ),
    source_manifest_path: requireString(
      provenanceRecord.source_manifest_path,
      "provenance.source_manifest_path"
    ),
    segment_manifest_path: requireString(
      provenanceRecord.segment_manifest_path,
      "provenance.segment_manifest_path"
    ),
    content_path: requireString(
      provenanceRecord.content_path,
      "provenance.content_path"
    ),
  };

  if (!Array.isArray(value.claims)) {
    throw new Error(`claims in ${filePath} must be an array.`);
  }

  const claims = value.claims.map((claimValue, index): GeneratedClaim => {
    const label = `claims[${index}]`;
    const claim = requireRecord(claimValue, label);
    const confidence = requireNumber(claim.confidence, `${label}.confidence`);

    if (confidence < 0 || confidence > 1) {
      throw new Error(`${label}.confidence must be between 0 and 1.`);
    }

    return {
      candidate_id: requireString(claim.candidate_id, `${label}.candidate_id`),
      extraction_index: optionalNumber(
        claim.extraction_index,
        `${label}.extraction_index`
      ),
      statement: requireString(claim.statement, `${label}.statement`),
      claim_type: requireString(claim.claim_type, `${label}.claim_type`),
      temporal: validateTemporal(claim.temporal, `${label}.temporal`),
      location_text: optionalString(
        claim.location_text,
        `${label}.location_text`
      ),
      named_entities:
        claim.named_entities === undefined
          ? []
          : requireStringArray(claim.named_entities, `${label}.named_entities`),
      evidence: requireStringArray(claim.evidence, `${label}.evidence`),
      confidence,
      knowledge_notes: requireText(
        claim.knowledge_notes,
        `${label}.knowledge_notes`
      ),
    };
  });

  return {
    format_version: formatVersion,
    provenance,
    claims,
  };
}

function assertEqual(
  actual: string,
  expected: string,
  label: string
): void {
  if (actual !== expected) {
    throw new Error(
      `${label} mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`
    );
  }
}

function resolveFromProject(filePath: string): string {
  return path.resolve(process.cwd(), filePath);
}

function deepMerge(existing: unknown, incoming: unknown): unknown {
  if (!isRecord(existing) || !isRecord(incoming)) {
    return incoming;
  }

  const merged: JsonRecord = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    merged[key] =
      key in existing ? deepMerge(existing[key], value) : value;
  }

  return merged;
}

function unmodeledFields(
  manifest: JsonRecord,
  modeledFields: string[]
): JsonRecord {
  const modeled = new Set(modeledFields);

  return Object.fromEntries(
    Object.entries(manifest).filter(([key]) => !modeled.has(key))
  );
}

function assignOptional(
  target: JsonRecord,
  key: string,
  value: unknown
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

type SupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

function assertSupabaseSuccess(
  operation: string,
  error: SupabaseError | null
): void {
  if (!error) {
    return;
  }

  const details = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ");
  const code = error.code ? ` [${error.code}]` : "";

  throw new Error(`${operation}${code}: ${details}`);
}

function readLegacyJwtRole(apiKey: string): string | null {
  const parts = apiKey.split(".");

  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );

    return isRecord(payload) && typeof payload.role === "string"
      ? payload.role
      : null;
  } catch {
    return null;
  }
}

function validateSupabaseAdminKey(apiKey: string): void {
  const legacyRole = readLegacyJwtRole(apiKey);

  if (
    apiKey.startsWith("sb_publishable_") ||
    legacyRole === "anon"
  ) {
    throw new Error(
      [
        "SUPABASE_SECRET_KEY is configured with a public/anon key.",
        "Use an sb_secret_ key from Supabase Settings > API Keys, or remove SUPABASE_SECRET_KEY to use the legacy SUPABASE_SERVICE_ROLE_KEY fallback.",
        "Do not grant database write access to anon.",
      ].join("\n")
    );
  }
}

async function main(): Promise<void> {
  const generatedClaimsPath = process.argv[2];

  if (!generatedClaimsPath) {
    throw new Error(
      [
        "Usage:",
        "",
        "npm run import:claims -- <generated-claims-json>",
        "",
        "Example:",
        "",
        "npm run import:claims -- data/generated/claims/titanic-1912/british-inquiry-bride-day14/q16503-16518.json",
      ].join("\n")
    );
  }

  const extractionPath = resolveFromProject(generatedClaimsPath);
  const extraction = validateGeneratedExtraction(
    await readJsonFile(extractionPath),
    generatedClaimsPath
  );
  const { provenance } = extraction;

  const episodeManifest = await readJsonFile(
    resolveFromProject(provenance.episode_manifest_path)
  );
  const sourceManifest = await readJsonFile(
    resolveFromProject(provenance.source_manifest_path)
  );
  const segmentManifest = await readJsonFile(
    resolveFromProject(provenance.segment_manifest_path)
  );

  const episodeSlug = requireString(
    episodeManifest.id,
    "episode manifest id"
  );
  const sourceSlug = requireString(sourceManifest.id, "source manifest id");
  const segmentManifestId = requireString(
    segmentManifest.id,
    "source segment manifest id"
  );
  const segmentSourceId = requireString(
    segmentManifest.source_id,
    "source segment manifest source_id"
  );
  const segmentKey = requireString(
    segmentManifest.segment_key,
    "source segment manifest segment_key"
  );
  const contentPath = requireString(
    segmentManifest.content_path,
    "source segment manifest content_path"
  );

  assertEqual(episodeSlug, provenance.episode_id, "Episode manifest/provenance");
  assertEqual(sourceSlug, provenance.source_id, "Source manifest/provenance");
  assertEqual(
    segmentManifestId,
    provenance.source_segment_id,
    "Source segment manifest/provenance"
  );
  assertEqual(
    segmentSourceId,
    provenance.source_id,
    "Source segment source/provenance"
  );
  assertEqual(
    segmentKey,
    provenance.source_segment_key,
    "Source segment key/provenance"
  );

  if (
    resolveFromProject(contentPath) !==
    resolveFromProject(provenance.content_path)
  ) {
    throw new Error(
      `Source material path mismatch: segment manifest uses ${JSON.stringify(contentPath)}, provenance uses ${JSON.stringify(provenance.content_path)}.`
    );
  }

  if (
    Array.isArray(episodeManifest.source_ids) &&
    !episodeManifest.source_ids.includes(sourceSlug)
  ) {
    throw new Error(
      `Episode manifest ${provenance.episode_manifest_path} does not list source ${sourceSlug}.`
    );
  }

  let sourceMaterial: string;

  try {
    sourceMaterial = await fs.readFile(resolveFromProject(contentPath), "utf8");
  } catch (error) {
    throw new Error(
      `Could not read source material ${contentPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is missing. Add it to .env.local.");
  }

  if (!supabaseSecretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is missing. Add it to .env.local. SUPABASE_SERVICE_ROLE_KEY is supported only as a legacy fallback."
    );
  }

  validateSupabaseAdminKey(supabaseSecretKey);

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const episodeTitle = requireString(episodeManifest.title, "episode title");
  const existingEpisodeResult = await supabase
    .from("episodes")
    .select("id,status")
    .eq("slug", episodeSlug)
    .maybeSingle();
  assertSupabaseSuccess(
    `Failed to find episode ${episodeSlug}`,
    existingEpisodeResult.error
  );

  let episodeId: string;

  if (existingEpisodeResult.data) {
    episodeId = existingEpisodeResult.data.id;
    const episodeUpdate: JsonRecord = { title: episodeTitle };
    assignOptional(episodeUpdate, "subtitle", episodeManifest.subtitle);
    assignOptional(episodeUpdate, "description", episodeManifest.description);
    assignOptional(
      episodeUpdate,
      "temporal_context",
      episodeManifest.temporal_context
    );
    assignOptional(
      episodeUpdate,
      "geographic_context",
      episodeManifest.geographic_context
    );

    const updateResult = await supabase
      .from("episodes")
      .update(episodeUpdate)
      .eq("id", episodeId);
    assertSupabaseSuccess(
      `Failed to update episode ${episodeSlug}`,
      updateResult.error
    );
  } else {
    const episodeInsert: JsonRecord = {
      slug: episodeSlug,
      title: episodeTitle,
      status: "draft",
      temporal_context: episodeManifest.temporal_context ?? {},
      geographic_context: episodeManifest.geographic_context ?? {},
    };
    assignOptional(episodeInsert, "subtitle", episodeManifest.subtitle);
    assignOptional(episodeInsert, "description", episodeManifest.description);

    const insertResult = await supabase
      .from("episodes")
      .insert(episodeInsert)
      .select("id")
      .single();
    assertSupabaseSuccess(
      `Failed to create episode ${episodeSlug}`,
      insertResult.error
    );

    if (!insertResult.data) {
      throw new Error(`Failed to create episode ${episodeSlug}: no row returned.`);
    }

    episodeId = insertResult.data.id;
  }

  console.log(`✓ Episode ready: ${episodeSlug}`);

  const sourceTitle = requireString(sourceManifest.title, "source title");
  const sourceMetadata = unmodeledFields(sourceManifest, [
    "id",
    "title",
    "source_type",
    "creator_text",
    "publisher",
    "publication_text",
    "url",
    "citation",
    "is_primary",
    "rights_notes",
    "metadata",
  ]);
  const manifestSourceMetadata = deepMerge(
    sourceManifest.metadata ?? {},
    sourceMetadata
  );
  const existingSourceResult = await supabase
    .from("sources")
    .select("id,metadata")
    .eq("slug", sourceSlug)
    .maybeSingle();
  assertSupabaseSuccess(
    `Failed to find source ${sourceSlug}`,
    existingSourceResult.error
  );

  let sourceId: string;

  if (existingSourceResult.data) {
    sourceId = existingSourceResult.data.id;
    const sourceUpdate: JsonRecord = {
      title: sourceTitle,
      metadata: deepMerge(
        existingSourceResult.data.metadata ?? {},
        manifestSourceMetadata
      ),
    };

    for (const field of [
      "source_type",
      "creator_text",
      "publisher",
      "publication_text",
      "url",
      "citation",
      "is_primary",
      "rights_notes",
    ]) {
      assignOptional(sourceUpdate, field, sourceManifest[field]);
    }

    const updateResult = await supabase
      .from("sources")
      .update(sourceUpdate)
      .eq("id", sourceId);
    assertSupabaseSuccess(
      `Failed to update source ${sourceSlug}`,
      updateResult.error
    );
  } else {
    const sourceInsert: JsonRecord = {
      slug: sourceSlug,
      title: sourceTitle,
      is_primary: sourceManifest.is_primary ?? false,
      metadata: manifestSourceMetadata,
    };

    for (const field of [
      "source_type",
      "creator_text",
      "publisher",
      "publication_text",
      "url",
      "citation",
      "rights_notes",
    ]) {
      assignOptional(sourceInsert, field, sourceManifest[field]);
    }

    const insertResult = await supabase
      .from("sources")
      .insert(sourceInsert)
      .select("id")
      .single();
    assertSupabaseSuccess(
      `Failed to create source ${sourceSlug}`,
      insertResult.error
    );

    if (!insertResult.data) {
      throw new Error(`Failed to create source ${sourceSlug}: no row returned.`);
    }

    sourceId = insertResult.data.id;
  }

  console.log(`✓ Source ready: ${sourceSlug}`);

  const episodeSourceResult = await supabase
    .from("episode_sources")
    .select("episode_id")
    .eq("episode_id", episodeId)
    .eq("source_id", sourceId)
    .maybeSingle();
  assertSupabaseSuccess(
    `Failed to find episode/source link for ${episodeSlug} and ${sourceSlug}`,
    episodeSourceResult.error
  );

  if (!episodeSourceResult.data) {
    const linkResult = await supabase.from("episode_sources").insert({
      episode_id: episodeId,
      source_id: sourceId,
      relationship_type: "evidence",
    });
    assertSupabaseSuccess(
      `Failed to link source ${sourceSlug} to episode ${episodeSlug}`,
      linkResult.error
    );
  }

  const contentHash = createHash("sha256")
    .update(sourceMaterial, "utf8")
    .digest("hex");
  const segmentMetadataFromManifest = {
    ...unmodeledFields(segmentManifest, [
      "id",
      "source_id",
      "segment_key",
      "title",
      "locator",
      "sequence_index",
      "content_path",
      "content_status",
      "temporal_context",
      "notes",
      "metadata",
    ]),
    manifest_id: segmentManifestId,
    content_path: contentPath,
    content_status:
      segmentManifest.content_status ?? provenance.content_status ?? null,
    temporal_context: segmentManifest.temporal_context ?? {},
    notes: segmentManifest.notes ?? null,
  };
  const manifestSegmentMetadata = deepMerge(
    segmentManifest.metadata ?? {},
    segmentMetadataFromManifest
  );
  const existingSegmentResult = await supabase
    .from("source_segments")
    .select("id,metadata")
    .eq("source_id", sourceId)
    .eq("segment_key", segmentKey)
    .maybeSingle();
  assertSupabaseSuccess(
    `Failed to find source segment ${segmentKey}`,
    existingSegmentResult.error
  );

  let sourceSegmentId: string;
  const segmentFields: JsonRecord = {
    raw_text: sourceMaterial,
    content_hash: contentHash,
  };
  assignOptional(segmentFields, "title", segmentManifest.title);
  assignOptional(segmentFields, "locator", segmentManifest.locator);
  assignOptional(segmentFields, "sequence_index", segmentManifest.sequence_index);

  if (existingSegmentResult.data) {
    sourceSegmentId = existingSegmentResult.data.id;
    const updateResult = await supabase
      .from("source_segments")
      .update({
        ...segmentFields,
        metadata: deepMerge(
          existingSegmentResult.data.metadata ?? {},
          manifestSegmentMetadata
        ),
      })
      .eq("id", sourceSegmentId);
    assertSupabaseSuccess(
      `Failed to update source segment ${segmentKey}`,
      updateResult.error
    );
  } else {
    const insertResult = await supabase
      .from("source_segments")
      .insert({
        source_id: sourceId,
        segment_key: segmentKey,
        ...segmentFields,
        metadata: manifestSegmentMetadata,
      })
      .select("id")
      .single();
    assertSupabaseSuccess(
      `Failed to create source segment ${segmentKey}`,
      insertResult.error
    );

    if (!insertResult.data) {
      throw new Error(
        `Failed to create source segment ${segmentKey}: no row returned.`
      );
    }

    sourceSegmentId = insertResult.data.id;
  }

  console.log(`✓ Source segment ready: ${segmentKey}`);

  const counts: ImportCounts = {
    claimsInserted: 0,
    claimsExisting: 0,
    evidenceInserted: 0,
    evidenceExisting: 0,
    episodeLinksInserted: 0,
    episodeLinksExisting: 0,
  };

  for (const [claimIndex, claim] of extraction.claims.entries()) {
    const existingClaimResult = await supabase
      .from("claims")
      .select("id")
      .eq("extraction_key", claim.candidate_id)
      .maybeSingle();
    assertSupabaseSuccess(
      `Failed to find claim ${claim.candidate_id}`,
      existingClaimResult.error
    );

    let claimId: string;

    if (existingClaimResult.data) {
      claimId = existingClaimResult.data.id;
      counts.claimsExisting += 1;
    } else {
      const claimInsertResult = await supabase
        .from("claims")
        .insert({
          statement: claim.statement,
          claim_type: claim.claim_type,
          location_text: claim.location_text,
          confidence: claim.confidence,
          knowledge_notes: claim.knowledge_notes,
          temporal_raw_text: claim.temporal.raw_text,
          temporal_kind: claim.temporal.kind,
          temporal_relation: claim.temporal.relation,
          temporal_granularity: claim.temporal.granularity,
          temporal_certainty: claim.temporal.certainty,
          calendar_system: claim.temporal.calendar_system,
          calendar_system_status: claim.temporal.calendar_system_status,
          clock_system: claim.temporal.clock_system,
          clock_system_status: claim.temporal.clock_system_status,
          temporal_anchor_text: claim.temporal.anchor_text,
          review_status: "pending",
          extraction_key: claim.candidate_id,
          extraction_version: optionalString(
            provenance.extractor_version,
            "provenance.extractor_version"
          ),
          extraction_model: optionalString(
            provenance.extraction_model,
            "provenance.extraction_model"
          ),
          generation_meta: {
            candidate_id: claim.candidate_id,
            extraction_index: claim.extraction_index ?? claimIndex,
            raw_named_entities: claim.named_entities,
            source_segment_id: provenance.source_segment_id,
            source_segment_key: provenance.source_segment_key,
            content_status:
              provenance.content_status ??
              segmentManifest.content_status ??
              null,
            extraction_provenance: provenance,
          },
        })
        .select("id")
        .single();
      assertSupabaseSuccess(
        `Failed to import claim ${claim.candidate_id}`,
        claimInsertResult.error
      );

      if (!claimInsertResult.data) {
        throw new Error(
          `Failed to import claim ${claim.candidate_id}: no row returned.`
        );
      }

      claimId = claimInsertResult.data.id;
      counts.claimsInserted += 1;
    }

    for (const [evidenceIndex, evidenceText] of claim.evidence.entries()) {
      const existingEvidenceResult = await supabase
        .from("claim_evidence")
        .select("id")
        .eq("claim_id", claimId)
        .eq("source_segment_id", sourceSegmentId)
        .eq("sequence_index", evidenceIndex)
        .limit(1)
        .maybeSingle();
      assertSupabaseSuccess(
        `Failed to find evidence ${evidenceIndex} for claim ${claim.candidate_id}`,
        existingEvidenceResult.error
      );

      if (existingEvidenceResult.data) {
        counts.evidenceExisting += 1;
      } else {
        const evidenceInsertResult = await supabase
          .from("claim_evidence")
          .insert({
            claim_id: claimId,
            source_segment_id: sourceSegmentId,
            evidence_text: evidenceText,
            evidence_type: "direct",
            sequence_index: evidenceIndex,
          });
        assertSupabaseSuccess(
          `Failed to import evidence ${evidenceIndex} for claim ${claim.candidate_id}`,
          evidenceInsertResult.error
        );
        counts.evidenceInserted += 1;
      }
    }

    const existingEpisodeClaimResult = await supabase
      .from("episode_claims")
      .select("episode_id")
      .eq("episode_id", episodeId)
      .eq("claim_id", claimId)
      .maybeSingle();
    assertSupabaseSuccess(
      `Failed to find episode link for claim ${claim.candidate_id}`,
      existingEpisodeClaimResult.error
    );

    if (existingEpisodeClaimResult.data) {
      counts.episodeLinksExisting += 1;
    } else {
      const episodeClaimInsertResult = await supabase
        .from("episode_claims")
        .insert({
          episode_id: episodeId,
          claim_id: claimId,
          inclusion_status: "candidate",
        });
      assertSupabaseSuccess(
        `Failed to link claim ${claim.candidate_id} to episode ${episodeSlug}`,
        episodeClaimInsertResult.error
      );
      counts.episodeLinksInserted += 1;
    }
  }

  console.log("");
  console.log("Claims:");
  console.log(`  inserted: ${counts.claimsInserted}`);
  console.log(`  existing: ${counts.claimsExisting}`);
  console.log("");
  console.log("Evidence rows:");
  console.log(`  inserted: ${counts.evidenceInserted}`);
  console.log(`  existing: ${counts.evidenceExisting}`);
  console.log("");
  console.log("Episode links:");
  console.log(`  inserted: ${counts.episodeLinksInserted}`);
  console.log(`  existing: ${counts.episodeLinksExisting}`);
  console.log("");
  console.log("✓ Claim import complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
