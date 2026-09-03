import { config } from "dotenv";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

config({ path: ".env.local" });

const claimSchema = {
  type: "object",
  additionalProperties: false,

  properties: {
    claims: {
      type: "array",

      items: {
        type: "object",
        additionalProperties: false,

        properties: {
          statement: {
            type: "string",
          },

          claim_type: {
            type: "string",
            enum: [
              "action",
              "communication",
              "observation",
              "condition",
              "location",
              "time",
              "identity",
              "relationship",
              "other",
            ],
          },

          temporal: {
            type: "object",
            additionalProperties: false,

            properties: {
              raw_text: {
                type: ["string", "null"],
              },

              kind: {
                type: "string",
                enum: [
                  "datetime",
                  "date",
                  "clock_time",
                  "year",
                  "range",
                  "relative",
                  "sequence",
                  "unknown",
                ],
              },

              relation: {
                type: "string",
                enum: [
                  "at",
                  "before",
                  "after",
                  "by",
                  "during",
                  "between",
                  "until",
                  "none",
                ],
              },

              granularity: {
                type: "string",
                enum: [
                  "second",
                  "minute",
                  "hour",
                  "day",
                  "month",
                  "season",
                  "year",
                  "decade",
                  "century",
                  "sequence",
                  "unknown",
                ],
              },

              certainty: {
                type: "string",
                enum: [
                  "exact",
                  "approximate",
                  "bounded",
                  "inferred",
                  "unknown",
                ],
              },

              calendar_system: {
                type: ["string", "null"],
              },

              calendar_system_status: {
                type: "string",
                enum: [
                  "explicit",
                  "contextual",
                  "unknown",
                ],
              },

              clock_system: {
                type: ["string", "null"],
              },

              clock_system_status: {
                type: "string",
                enum: [
                  "explicit",
                  "contextual",
                  "unknown",
                ],
              },

              anchor_text: {
                type: ["string", "null"],
              },
            },

            required: [
              "raw_text",
              "kind",
              "relation",
              "granularity",
              "certainty",
              "calendar_system",
              "calendar_system_status",
              "clock_system",
              "clock_system_status",
              "anchor_text",
            ],
          },

          location_text: {
            type: ["string", "null"],
          },

          named_entities: {
            type: "array",
            items: {
              type: "string",
            },
          },

          evidence: {
            type: "array",
            items: {
              type: "string",
            },
          },

          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },

          knowledge_notes: {
            type: "string",
          },
        },

        required: [
          "statement",
          "claim_type",
          "temporal",
          "location_text",
          "named_entities",
          "evidence",
          "confidence",
          "knowledge_notes",
        ],
      },
    },
  },

  required: ["claims"],
} as const;

async function main() {
  const episodeManifestPath = process.argv[2];
  const segmentManifestPath = process.argv[3];
  const explicitOutputPath = process.argv[4];

  if (!episodeManifestPath || !segmentManifestPath) {
    throw new Error(
      [
        "Usage:",
        "",
        "npm run extract:claims -- <episode-manifest> <segment-manifest> [output-path]",
        "",
        "Example:",
        "",
        "npm run extract:claims -- data/episodes/titanic-1912.json data/source-segments/british-inquiry-assistance/assistance-001.json",
      ].join("\n")
    );
  }

  console.log(
    `Reading episode manifest: ${episodeManifestPath}`
  );

  const episodeManifestText = await fs.readFile(
    episodeManifestPath,
    "utf8"
  );

  const episodeManifest = JSON.parse(
    episodeManifestText
  );

  if (!episodeManifest.id) {
    throw new Error(
      `Episode manifest ${episodeManifestPath} does not contain an id.`
    );
  }

  console.log(
    `Reading source segment manifest: ${segmentManifestPath}`
  );

  const segmentManifestText = await fs.readFile(
    segmentManifestPath,
    "utf8"
  );

  const segmentManifest = JSON.parse(
    segmentManifestText
  );

  if (!segmentManifest.source_id) {
    throw new Error(
      `Source segment manifest ${segmentManifestPath} does not contain a source_id.`
    );
  }

  if (!segmentManifest.segment_key) {
    throw new Error(
      `Source segment manifest ${segmentManifestPath} does not contain a segment_key.`
    );
  }

  if (!segmentManifest.content_path) {
    throw new Error(
      `Source segment manifest ${segmentManifestPath} does not contain a content_path.`
    );
  }

  const sourceManifestPath =
    `data/sources/${segmentManifest.source_id}.json`;

  console.log(
    `Reading source manifest: ${sourceManifestPath}`
  );

  const sourceManifestText = await fs.readFile(
    sourceManifestPath,
    "utf8"
  );

  const sourceManifest = JSON.parse(
    sourceManifestText
  );

  if (!sourceManifest.id) {
    throw new Error(
      `Source manifest ${sourceManifestPath} does not contain an id.`
    );
  }

  if (sourceManifest.id !== segmentManifest.source_id) {
    throw new Error(
      `Source manifest id ${sourceManifest.id} does not match source segment source_id ${segmentManifest.source_id}.`
    );
  }

  if (
    Array.isArray(episodeManifest.source_ids) &&
    !episodeManifest.source_ids.includes(sourceManifest.id)
  ) {
    throw new Error(
      `Episode manifest ${episodeManifestPath} does not list source ${sourceManifest.id}.`
    );
  }

  const outputPath =
    explicitOutputPath ??
    path.join(
      "data",
      "generated",
      "claims",
      episodeManifest.id,
      sourceManifest.id,
      `${segmentManifest.segment_key}.json`
    );

  console.log(
    `Reading source material: ${segmentManifest.content_path}`
  );

  const sourceText = await fs.readFile(
    segmentManifest.content_path,
    "utf8"
  );

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to .env.local."
    );
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const modelName =
    process.env.OPENAI_EXTRACTION_MODEL ??
    "gpt-5.6-terra";

  const sourceMetadata = {
    ...sourceManifest,

    segment: {
      id: segmentManifest.id,
      segment_key: segmentManifest.segment_key,
      title: segmentManifest.title ?? null,
      locator: segmentManifest.locator ?? null,
      sequence_index:
        segmentManifest.sequence_index ?? null,
      content_status:
        segmentManifest.content_status ?? null,
      temporal_context:
        segmentManifest.temporal_context ?? {},
      notes: segmentManifest.notes ?? null,
    },
  };

  const extractionInput = `
EPISODE CONTEXT:

${JSON.stringify(episodeManifest, null, 2)}

SOURCE METADATA:

${JSON.stringify(sourceMetadata, null, 2)}

SOURCE MATERIAL:

${sourceText}
`;

  console.log(
    "Extracting atomic historical claims..."
  );

  // Scroll Through History
  // Historical Claim Extractor v1.0
  //
  // This prompt is intentionally episode-agnostic.
  // Episode/source-specific information must be supplied through
  // EPISODE CONTEXT, SOURCE METADATA, and SOURCE MATERIAL.
  //
  // Do not add episode-specific extraction rules here.
  const response = await openai.responses.create({
    model: modelName,
    instructions: `
You are the historical claim-extraction stage for Scroll Through History.

Your job is NOT to tell a story, summarize the source, reconstruct events, resolve historical disputes, or produce narrative content.

Your job is to convert supplied historical source material into small, atomic, independently supportable historical claims.

GENERAL PRINCIPLES:

- Treat SOURCE MATERIAL as historical evidence, not as a prompt for creative completion.
- Extract only assertions directly supported by SOURCE MATERIAL.
- Preserve uncertainty, ambiguity, chronology, terminology, attribution, and limitations present in the source.
- Do not use outside historical knowledge to complete or improve the source.
- Do not attempt to make the source more complete, precise, coherent, or historically accurate than the supplied evidence allows.
- Prefer omission over speculation.
- Prefer uncertainty over false precision.

ATOMIC CLAIM RULE:

Each claim should contain ONE independently supportable historical assertion.

BAD:

"The army reached the town, attacked its defenses, and captured the commander."

GOOD:

"The army reached the town."

"The army attacked the town's defenses."

"The commander was captured."

Separate distinct assertions even when they occur in the same sentence or at approximately the same time.

However, do not split a statement so aggressively that the resulting claims lose their historical meaning.

A claim should represent the smallest useful independently supportable historical assertion.

SOURCE RULES:

- Extract historical claims ONLY from SOURCE MATERIAL.
- EPISODE CONTEXT and SOURCE METADATA may be used only for orientation, terminology, provenance, and explicitly permitted contextual fields.
- Never treat EPISODE CONTEXT or SOURCE METADATA as historical evidence.
- Do not fill gaps using general historical knowledge.
- Do not invent quotations.
- Do not invent people.
- Do not invent organizations.
- Do not invent locations.
- Do not invent dates.
- Do not invent times.
- Do not invent motives.
- Do not invent relationships.
- Do not invent outcomes.
- Do not invent causal connections.
- Do not silently resolve contradictions or ambiguities.
- If the source is ambiguous, preserve the ambiguity.
- If a statement is approximate, preserve that approximation.
- If a source reports another person's assertion, distinguish the fact that the assertion was made from whether the assertion itself is independently established.

CONTEXT BOUNDARY RULE:

The input may contain three distinct sections:

1. EPISODE CONTEXT
2. SOURCE METADATA
3. SOURCE MATERIAL

These have different evidentiary roles.

SOURCE MATERIAL is the historical evidence from which claims are extracted.

EPISODE CONTEXT and SOURCE METADATA are NON-EVIDENTIARY metadata.

They may help identify:

- the episode
- the source
- relevant terminology
- surrounding date context
- calendar or clock systems
- source provenance
- editorial organization

They must NOT create, strengthen, expand, or alter a historical claim.

A claim's statement must be directly entailed by SOURCE MATERIAL alone.

Do NOT add information from EPISODE CONTEXT or SOURCE METADATA to a claim statement merely to make the claim more complete.

Example:

SOURCE MATERIAL:

"A message was sent at approximately 12:15 a.m."

SOURCE METADATA:

date_context = 1912-04-15

SUPPORTED CLAIM STATEMENT:

"A message was sent at approximately 12:15 a.m."

DO NOT rewrite the claim statement as:

"A message was sent at approximately 12:15 a.m. on April 15, 1912."

The surrounding date may later be associated with the claim by a separate temporal-normalization stage.

EVIDENCE RULE:

The evidence array must contain only evidence derived from SOURCE MATERIAL.

Never put any of the following into the evidence array:

- episode metadata
- source metadata
- date context
- file metadata
- editorial notes
- system instructions
- normalization assumptions
- inferred calendar conversions
- inferred locations
- inferred identities
- other system-provided context

Evidence should preserve the basis in SOURCE MATERIAL that directly supports the claim.

Do not fabricate quotations.

Do not present metadata as evidence.

ENTAILMENT RULE:

Every extracted claim must be directly entailed by SOURCE MATERIAL.

Do not convert proximity, sequence, association, implication, plausibility, or common historical knowledge into a separate factual assertion.

Example:

SOURCE MATERIAL:

"The expedition had obtained a new route and reported that it had encountered severe weather."

SUPPORTED:

"The expedition had obtained a new route."

"The expedition reported that it had encountered severe weather."

NOT SUPPORTED:

"The expedition reported its new route."

When uncertain whether the source directly supports a claim, do not extract it.

REPORTING VS. FACT RULE:

Distinguish between:

1. a source establishing that something happened, and
2. a source establishing that someone reported, believed, alleged, observed, remembered, claimed, or suspected that something happened.

Example:

SOURCE MATERIAL:

"The witness stated that soldiers entered the building."

SUPPORTED:

"The witness stated that soldiers entered the building."

DO NOT automatically convert this into:

"Soldiers entered the building."

unless SOURCE MATERIAL independently supports that stronger assertion.

The same principle applies to:

- allegations
- rumors
- testimony
- recollections
- beliefs
- observations
- official statements
- newspaper reports
- propaganda
- secondhand accounts

Preserve attribution whenever attribution materially affects what the evidence actually establishes.

CAUSALITY RULE:

Do not infer causation merely because two events occur near one another in time or are described together.

Only create a causal claim when SOURCE MATERIAL itself supports the causal relationship.

Example:

SOURCE MATERIAL:

"The bridge collapsed shortly after the explosion."

SUPPORTED:

"The bridge collapsed."

"The explosion occurred before the bridge collapsed."

NOT AUTOMATICALLY SUPPORTED:

"The explosion caused the bridge to collapse."

Only extract the causal relationship if the source states or clearly establishes it.

ENTITY RULE:

named_entities must contain only specifically identifiable named historical entities supported by SOURCE MATERIAL.

These may include:

- people
- named groups
- organizations
- governments
- military units
- vessels
- settlements
- geographic places
- institutions
- publications
- named buildings
- named monuments
- named objects or structures when historically meaningful

Do not include generic categories as named_entities.

Examples of generic categories that should normally NOT appear in named_entities:

- passengers
- soldiers
- civilians
- nearby ships
- workers
- villagers
- crew members
- witnesses
- officials
- residents
- troops

Preserve entity names as represented by SOURCE MATERIAL.

Do not replace, expand, modernize, translate, canonicalize, or resolve entity names using EPISODE CONTEXT or SOURCE METADATA.

Example:

If SOURCE MATERIAL says:

"Gen. Grant"

preserve:

"Gen. Grant"

Do not automatically replace it with:

"Ulysses S. Grant"

If SOURCE MATERIAL says:

"the city of Byzantium"

do not automatically replace it with a later or modern name.

Entity resolution, alias handling, canonical naming, and identity matching are handled by a separate stage.

TEMPORAL RULES:

Preserve temporal information exactly as supported by SOURCE MATERIAL.

Do not force historical time expressions into modern timestamps.

The temporal object contains:

- raw_text
- kind
- relation
- granularity
- certainty
- calendar_system
- calendar_system_status
- clock_system
- clock_system_status
- anchor_text

raw_text:

Record the meaningful temporal wording from SOURCE MATERIAL.

Use null if no meaningful temporal wording is present.

Examples:

"approximately 12:15 a.m."

"three days later"

"before sunrise"

"during the summer"

"around 480 BCE"

"after the king died"

kind:

datetime

Use when both a calendar date and a clock time are established by SOURCE MATERIAL itself.

date

Use when a calendar date is established without a clock time.

clock_time

Use when a clock time is established without an independently established calendar date in SOURCE MATERIAL.

year

Use for year-level temporal information.

range

Use for a span, interval, era, reign, season, bounded period, or approximate period.

relative

Use when timing is expressed relative to another event, condition, or temporal anchor.

sequence

Use when only event ordering is established.

unknown

Use when no useful temporal information is established.

relation:

Use the relationship actually supported by SOURCE MATERIAL.

Allowed values:

- at
- before
- after
- by
- during
- between
- until
- none

granularity:

Describe the finest temporal resolution supported by SOURCE MATERIAL.

Allowed values:

- second
- minute
- hour
- day
- month
- season
- year
- decade
- century
- sequence
- unknown

certainty:

exact

Use when SOURCE MATERIAL presents the timing as definite.

approximate

Use when SOURCE MATERIAL uses wording such as:

- approximately
- about
- circa
- roughly
- around
- nearly
- shortly before
- shortly after

or equivalent uncertainty.

bounded

Use when SOURCE MATERIAL establishes a temporal range, earliest/latest boundary, or defined interval.

inferred

Use when temporal ordering is reasonably derivable from SOURCE MATERIAL but is not independently timed.

unknown

Use when temporal certainty cannot be determined.

CALENDAR AND CLOCK SYSTEM RULES:

Calendar systems and clock/time-reference systems are separate concepts.

calendar_system:

Record the calendar or dating system applicable to the temporal expression ONLY when it is established by SOURCE MATERIAL or explicitly supplied SOURCE METADATA.

Examples may include:

- Gregorian calendar
- Julian calendar
- French Republican calendar
- Roman Republican calendar
- regnal dating
- consular dating

Otherwise return null.

calendar_system_status:

explicit

Use when SOURCE MATERIAL explicitly establishes the calendar system.

contextual

Use when SOURCE METADATA explicitly establishes the calendar system.

unknown

Use when the calendar system is not established.

clock_system:

Record the clock, time standard, or time-reference system applicable to the temporal expression ONLY when established by SOURCE MATERIAL or explicitly supplied SOURCE METADATA.

Examples may include:

- GMT
- UTC
- local civil time
- ship time
- mission elapsed time
- railway time
- military time standard

Otherwise return null.

clock_system_status:

explicit

Use when SOURCE MATERIAL explicitly establishes the clock or time-reference system.

contextual

Use when SOURCE METADATA explicitly establishes the clock or time-reference system.

unknown

Use when the clock or time-reference system is not established.

IMPORTANT:

Knowing the calendar system does NOT establish the clock system.

Knowing the clock system does NOT establish the calendar system.

Contextual calendar or clock information must NOT alter:

- the claim statement
- raw_text
- kind
- relation
- granularity
- certainty
- anchor_text

Example:

SOURCE MATERIAL:

"approximately 12:15 a.m."

SOURCE METADATA:

calendar_system = Gregorian
clock_basis = source_unspecified

Correct:

kind = "clock_time"

calendar_system = "Gregorian calendar"

calendar_system_status = "contextual"

clock_system = null

clock_system_status = "unknown"

Incorrect:

kind = "datetime"

Incorrect:

claim statement gains a calendar date.

Incorrect:

clock_system = "ship time"

unless SOURCE MATERIAL or SOURCE METADATA actually establishes ship time.

A separate temporal-normalization stage will later combine historical temporal expressions with contextual metadata.

anchor_text:

For relative or sequence-based temporal claims, record the event, condition, or temporal anchor to which the claim is related when supported by SOURCE MATERIAL.

Otherwise return null.

Examples:

SOURCE MATERIAL:

"after the ruler died"

anchor_text:

"the ruler died"

SOURCE MATERIAL:

"before sunrise"

anchor_text:

"sunrise"

SOURCE MATERIAL:

"three days after the battle"

anchor_text:

"the battle"

Never invent:

- modern calendar conversions
- exact dates
- time zones
- UTC offsets
- clock systems
- calendar systems
- durations
- temporal anchors

unless supported by SOURCE MATERIAL or explicitly permitted through SOURCE METADATA for calendar_system or clock_system.

TEMPORAL CONTEXT RULE:

raw_text, kind, relation, granularity, certainty, and anchor_text describe temporal information expressed by SOURCE MATERIAL itself.

Do not upgrade a clock_time into a datetime merely because SOURCE METADATA provides a surrounding calendar date.

Do not add a date from SOURCE METADATA to the claim statement.

Do not add SOURCE METADATA to the evidence array.

SOURCE METADATA may populate calendar_system only when it explicitly establishes a calendar system.

When that occurs:

calendar_system_status = "contextual"

SOURCE METADATA may populate clock_system only when it explicitly establishes a clock or time-reference system.

When that occurs:

clock_system_status = "contextual"

A separate normalization stage will later combine source temporal expressions with source metadata.

SEQUENCE RULE:

When SOURCE MATERIAL directly establishes ordering between two atomic claims, preserve that ordering even when no clock time is given.

Example:

SOURCE MATERIAL:

"The messenger arrived and then delivered the letter."

CLAIM 1:

"The messenger arrived."

temporal:

kind = sequence
relation = before
granularity = sequence
anchor_text = "The messenger delivered the letter"

CLAIM 2:

"The messenger delivered the letter."

temporal:

kind = sequence
relation = after
granularity = sequence
anchor_text = "The messenger arrived"

Do not invent sequence when grammar or source context does not establish it.

If ordering is merely plausible but not supported, do not encode it.

KNOWLEDGE RULE:

An event occurring does not imply that every historical actor knew about it.

knowledge_notes must describe only knowledge relationships directly supported by SOURCE MATERIAL or minimally entailed by the communication, observation, decision, or action represented by the claim.

Do not speculate about who probably, likely, or reasonably knew something.

Distinguish where relevant between:

- producing information
- observing information
- receiving information
- understanding information
- believing information
- acting on information
- transmitting information
- wider dissemination

Example:

SOURCE MATERIAL:

"A sent a message to B."

Supported:

"A sent the message."

If SOURCE MATERIAL establishes receipt:

"B received the message."

Do NOT automatically infer:

"B read the message."

"B understood the message."

"B believed the message."

"B informed others."

"The public knew."

For communications, observations, decisions, and reports, preserve the difference between:

- direct participants
- observers
- senders
- recipients
- officials or decision-makers
- surrounding populations
- distant populations
- later historians or investigators

Do not assume information spread instantly.

Do not infer knowledge merely because an event occurred.

If SOURCE MATERIAL does not establish a useful knowledge relationship, knowledge_notes should briefly state that wider knowledge is not established.

LOCATION RULE:

Record location_text only when SOURCE MATERIAL supports a meaningful physical or geographic location.

Preserve useful uncertainty.

Examples of valid locations include:

"near the northern gate"

"somewhere along the river"

"Rome"

"aboard the vessel"

"approximately five miles east of the town"

Do not replace historical descriptions with:

- modern coordinates
- modern place names
- modern borders
- modern administrative divisions

unless those are explicitly present in SOURCE MATERIAL.

Do not use EPISODE CONTEXT or SOURCE METADATA to silently make location_text more precise.

Do NOT treat communication range, audience, jurisdiction, direction, organizational scope, command relationships, or relational phrases as physical locations.

Examples that are NOT locations by themselves:

"within wireless range"

"within hearing distance"

"under his command"

"among the population"

"toward the enemy"

"within the organization"

"to nearby ships"

"among the troops"

If SOURCE MATERIAL contains one of these phrases but does not establish a physical or geographic location for the claim, return:

location_text = null

CONFLICT RULE:

Do not attempt to resolve conflicts between sources during claim extraction.

If SOURCE MATERIAL contains contradictory assertions, extract independently supportable claims separately when useful.

Do not choose one version merely because it appears more plausible.

Do not silently reconcile conflicting:

- times
- dates
- identities
- casualty numbers
- locations
- motivations
- sequences
- descriptions
- outcomes

A later historical-synthesis stage will compare sources, provenance, chronology, credibility, and conflicting evidence.

CONFIDENCE RULE:

confidence measures how strongly SOURCE MATERIAL supports the extracted claim.

confidence is NOT:

- a judgment about whether the historical event absolutely happened
- a general historical-consensus score
- a source-credibility score
- a probability that the claim is objectively true

High confidence means SOURCE MATERIAL clearly and directly supports the extracted claim.

Lower confidence means the source wording is:

- ambiguous
- indirect
- incomplete
- interpretive
- qualified
- uncertain

When evidence is too weak to support a useful atomic claim, omit the claim rather than assigning an artificially low confidence score.

OUTPUT PHILOSOPHY:

Prefer omission over invention.

Prefer uncertainty over false precision.

Prefer direct attribution over silently converting reports into facts.

Prefer several clearly supported atomic claims over one polished narrative statement.

Preserve the distinction between:

- what happened
- what was reported
- what was alleged
- what was observed
- what was believed
- what was remembered
- what was known
- who knew it
- when it was known
- what was communicated
- what was received
- what was inferred
- what SOURCE MATERIAL actually establishes

Your output will become part of a larger historical data pipeline.

Do not optimize claims for storytelling.

Do not optimize claims for dramatic impact.

Do not write social-media posts.

Do not construct events.

Do not resolve entities.

Do not normalize historical dates or times.

Do not resolve contradictions.

Extract faithful, atomic historical claims only.
`,

    input: extractionInput,

    text: {
      format: {
        type: "json_schema",
        name: "historical_claim_extraction",
        strict: true,
        schema: claimSchema,
      },
    },
  });

  if (!response.output_text) {
    throw new Error(
      "OpenAI returned no output_text."
    );
  }

  const parsed = JSON.parse(
    response.output_text
  );

  const extractorVersion =
    "claim-extractor-v1.0";

  const claimsWithProvenance =
    parsed.claims.map(
      (claim: any, index: number) => {
        const extractionKeyInput =
          JSON.stringify({
            episode_id:
              episodeManifest.id,

            source_id:
              sourceManifest.id,

            source_segment_key:
              segmentManifest.segment_key,

            statement:
              claim.statement,

            claim_type:
              claim.claim_type,

            temporal:
              claim.temporal,

            evidence:
              claim.evidence,
          });

        const extractionHash =
          createHash("sha256")
            .update(extractionKeyInput)
            .digest("hex");

        return {
          candidate_id:
            `claim_${extractionHash.slice(0, 24)}`,

          extraction_index: index,

          ...claim,
        };
      }
    );

  const output = {
    format_version: "1.0",

    provenance: {
      extractor_version:
        extractorVersion,

      extraction_model:
        modelName,

      extracted_at:
        new Date().toISOString(),

      episode_id:
        episodeManifest.id,

      source_id:
        sourceManifest.id,

      source_segment_id:
        segmentManifest.id,

      source_segment_key:
        segmentManifest.segment_key,

      episode_manifest_path:
        episodeManifestPath,

      source_manifest_path:
        sourceManifestPath,

      segment_manifest_path:
        segmentManifestPath,

      content_path:
        segmentManifest.content_path,

      content_status:
        segmentManifest.content_status ?? null,
    },

    claims: claimsWithProvenance,
  };

  await fs.mkdir(
    path.dirname(outputPath),
    {
      recursive: true,
    }
  );

  await fs.writeFile(
    outputPath,
    JSON.stringify(output, null, 2) + "\n"
  );

  console.log("");
  console.log(
    `✓ Extracted ${parsed.claims.length} atomic claim(s).`
  );
  console.log(
    `✓ Wrote ${outputPath}`
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "Claim extraction failed:"
  );
  console.error(error);

  process.exit(1);
});
