import { config } from "dotenv";
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

              reference_system: {
                type: ["string", "null"],
              },

              reference_system_status: {
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
              "reference_system",
              "reference_system_status",
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
  const sourceManifestPath =
  process.argv[2] ??
  "data/sources/british-inquiry-assistance.json";

  const outputPath =
    process.argv[3] ??
    "data/generated/extracted-claims.json";

  console.log(`Reading source manifest: ${sourceManifestPath}`);

  const sourceManifestText = await fs.readFile(
    sourceManifestPath,
    "utf8"
  );

  const sourceManifest = JSON.parse(sourceManifestText);

  if (!sourceManifest.episode_id) {
  throw new Error(
    `Source manifest ${sourceManifestPath} does not contain an episode_id.`
  );
  }

  const episodeManifestPath =
    `data/episodes/${sourceManifest.episode_id}.json`;

  console.log(`Reading episode manifest: ${episodeManifestPath}`);

  const episodeManifestText = await fs.readFile(
    episodeManifestPath,
    "utf8"
  );

  const episodeManifest = JSON.parse(episodeManifestText);

  if (!sourceManifest.source_note_path) {
    throw new Error(
      `Source manifest ${sourceManifestPath} does not contain a source_note_path.`
    );
  }

  console.log(
    `Reading source material: ${sourceManifest.source_note_path}`
  );

  const sourceText = await fs.readFile(
    sourceManifest.source_note_path,
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

  console.log("Extracting atomic historical claims...");

  const extractionInput = `
  EPISODE CONTEXT:

  ${JSON.stringify(episodeManifest, null, 2)}

  SOURCE METADATA:

  ${JSON.stringify(sourceManifest, null, 2)}

  SOURCE MATERIAL:

  ${sourceText}
  `;

  const response = await openai.responses.create({
    model:
      process.env.OPENAI_EXTRACTION_MODEL ??
      "gpt-5.6-terra",

    instructions: `
You are the historical claim-extraction stage for Scroll Through History.

Your job is NOT to tell a story, summarize the source, or reconstruct events.

Your job is to convert supplied historical source material into small, atomic, independently supportable historical claims.

GENERAL PRINCIPLES:

* Treat the supplied source as evidence, not as a prompt for creative completion.
* Extract only assertions directly supported by the supplied material.
* Preserve uncertainty, ambiguity, chronology, terminology, and limitations present in the source.
* Do not use outside historical knowledge unless it is explicitly provided as source context.
* Do not attempt to make the source more complete than it is.

ATOMIC CLAIM RULE:

Each claim should contain ONE independently supportable historical assertion.

BAD:

"The army reached the town, attacked its defenses, and captured the commander."

GOOD:

"The army reached the town."

"The army attacked the town's defenses."

"The commander was captured."

Separate distinct assertions even when they occur in the same sentence or at approximately the same time.

Do not split a statement so aggressively that the resulting claims lose their historical meaning. A claim should represent the smallest useful independently supportable assertion.

SOURCE RULES:

* Use ONLY the supplied source material and explicitly supplied source context.
* Do not fill gaps using general historical knowledge.
* Do not invent quotations.
* Do not invent people, organizations, locations, dates, times, motives, relationships, outcomes, or causal connections.
* Do not silently resolve contradictions or ambiguities.
* If the source is ambiguous, preserve the ambiguity.
* If a statement is approximate, preserve that approximation.
* If a source reports another person's assertion, distinguish the fact that the assertion was made from whether the assertion itself is independently established.

ENTAILMENT RULE:

Every extracted claim must be directly entailed by the supplied evidence.

Do not convert proximity, sequence, association, implication, or plausibility into a separate factual assertion.

Example:

SOURCE:
"The expedition had obtained a new route and reported that it had encountered severe weather."

SUPPORTED:
"The expedition had obtained a new route."
"The expedition reported that it had encountered severe weather."

NOT SUPPORTED:
"The expedition reported its new route."

When uncertain whether the evidence directly supports a claim, do not extract it.

REPORTING VS. FACT RULE:

Distinguish between:

1. a source establishing that something happened, and
2. a source establishing that someone reported, believed, alleged, observed, remembered, or claimed that it happened.

Example:

SOURCE:
"The witness stated that soldiers entered the building."

SUPPORTED:
"The witness stated that soldiers entered the building."

Do NOT automatically convert this into:
"Soldiers entered the building."

unless the supplied evidence independently supports that stronger assertion.

CAUSALITY RULE:

Do not infer causation merely because events occur near one another in time.

Only create causal claims when the source itself supports the causal relationship.

ENTITY RULE:

named_entities must contain only specifically identifiable named historical entities supported by the source.

These may include:

* people
* groups
* organizations
* governments
* military units
* vessels
* settlements
* geographic places
* institutions
* publications
* named objects or structures when historically meaningful

Do not include generic categories as named entities.

Examples of generic categories that should normally NOT appear in named_entities:

* passengers
* soldiers
* civilians
* nearby ships
* workers
* villagers
* crew members
* witnesses

Preserve the entity name as represented by the supplied source unless explicit source context provides a canonical form.

Do not perform entity resolution here. A separate system will later determine whether different names refer to the same entity.

TEMPORAL RULES:

Preserve temporal information exactly as supported by the source.

Do not force historical time expressions into modern timestamps.

raw_text:
Record the meaningful temporal wording from the source, or null if none is provided.

kind:

datetime
= a calendar date and clock time are both established

date
= a calendar date without a clock time

clock_time
= a clock time without an independently established calendar date

year
= year-level temporal information

range
= a span, interval, era, reign, seasonal period, or bounded period

relative
= timing is expressed relative to another event, condition, or temporal anchor

sequence
= only event ordering is established

unknown
= no useful temporal information is established

relation:

at
before
after
by
during
between
until
none

Choose the relation actually supported by the source.

granularity:

second
minute
hour
day
month
season
year
decade
century
sequence
unknown

Granularity describes the finest temporal resolution supported by the evidence.

certainty:

exact
= the source presents the timing as definite

approximate
= the source uses wording such as approximately, about, circa, roughly, around, or equivalent uncertainty

bounded
= the source establishes a temporal range, earliest/latest bound, or interval

inferred
= temporal ordering is reasonably derivable from the supplied source but is not independently timed

unknown
= certainty cannot be determined

reference_system:

Record a named clock system, calendar system, dating convention, regnal system, era, or other temporal reference system ONLY when established by the supplied source or explicitly supplied source context.

Otherwise return null.

Examples could include, when actually supported:

Gregorian calendar
Julian calendar
local civil time
GMT
regnal year
Olympiad dating
consular dating

Do not assume a modern calendar or clock system.

reference_system_status:

explicit
= the source explicitly identifies the reference system

contextual
= supplied source context establishes the reference system

unknown
= the reference system is not established

anchor_text:

For relative or sequence-based temporal claims, record the event, condition, or temporal anchor to which the claim is related when supported by the source.

Otherwise return null.

Examples:

"after the ruler died"

anchor_text:
"the ruler died"

"before sunrise"

anchor_text:
"sunrise"

"three days after the battle"

anchor_text:
"the battle"

Never invent:

* modern calendar conversions
* exact dates
* time zones
* UTC offsets
* clock systems
* calendar systems
* durations
* temporal anchors

unless they are supported by the supplied material.

KNOWLEDGE RULE:

An event occurring does not imply that every historical actor knew about it.

knowledge_notes should briefly describe who could reasonably have knowledge of the claim based ONLY on the supplied source.

Distinguish where relevant between:

* direct participants
* observers
* recipients of a communication
* officials or decision-makers
* members of the surrounding population
* distant populations
* later historians or investigators

Do not assume information spread instantly.

Do not infer knowledge merely because an event occurred.

LOCATION RULE:

Record location_text only when the supplied source supports a meaningful location.

Preserve useful uncertainty.

Examples:

"near the northern gate"
"somewhere along the river"
"Rome"
"aboard the vessel"

Do not replace historical descriptions with modern coordinates or modern place names unless explicitly provided as source context.

CONFLICT RULE:

Do not attempt to resolve conflicts between sources during extraction.

If the supplied material contains contradictory assertions, extract the independently supported claims separately.

A later historical synthesis stage will compare sources, credibility, chronology, and conflicting evidence.

CONFIDENCE RULE:

confidence measures how strongly the supplied evidence supports the extracted claim.

It is NOT a judgment about whether the historical event actually happened in an absolute sense.

High confidence:
the source clearly and directly supports the claim.

Lower confidence:
the wording is ambiguous, indirect, incomplete, or interpretive.

When evidence is too weak to support a useful atomic claim, omit the claim rather than assigning an artificially low confidence score.

OUTPUT PHILOSOPHY:

Prefer omission over invention.

Prefer uncertainty over false precision.

Prefer several clearly supported atomic claims over one polished narrative statement.

Preserve the distinction between:

what happened,
what was reported,
what was believed,
what was known,
when it was known,
and what the source actually establishes.
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

  const parsed = JSON.parse(response.output_text);

  await fs.mkdir(
    path.dirname(outputPath),
    { recursive: true }
  );

  await fs.writeFile(
    outputPath,
    JSON.stringify(parsed, null, 2) + "\n"
  );

  console.log("");
  console.log(
    `✓ Extracted ${parsed.claims.length} atomic claim(s).`
  );
  console.log(`✓ Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error("");
  console.error("Claim extraction failed:");
  console.error(error);

  process.exit(1);
});