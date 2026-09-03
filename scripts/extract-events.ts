import { config } from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

config({ path: ".env.local" });

const eventSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          occurred_at: { type: ["string", "null"] },
          time_precision: {
            type: "string",
            enum: ["exact", "approximate", "date_only", "unknown"],
          },
          location_text: { type: ["string", "null"] },
          participants: {
            type: "array",
            items: { type: "string" },
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          evidence: {
            type: "array",
            items: { type: "string" },
          },
          knowledge_notes: { type: "string" },
        },
        required: [
          "title",
          "summary",
          "occurred_at",
          "time_precision",
          "location_text",
          "participants",
          "confidence",
          "evidence",
          "knowledge_notes",
        ],
      },
    },
  },
  required: ["events"],
} as const;

async function main() {
  const inputPath =
    process.argv[2] ??
    "data/source-notes/british-inquiry-assistance.md";

  const outputPath =
    process.argv[3] ??
    "data/generated/extracted-events.json";

  console.log(`Reading source: ${inputPath}`);

  const sourceText = await fs.readFile(inputPath, "utf8");

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to .env.local in the project root."
    );
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log("Extracting historical events...");

  const response = await openai.responses.create({
    model: process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-5.6-terra",

    instructions: `
You are the historical fact-extraction stage for Scroll Through History.

Extract only claims supported by the supplied source material.

Rules:
- Never fill gaps using outside knowledge.
- Never invent quotations.
- Never invent people who are not supported by the supplied material.
- If a time is approximate, label it approximate.
- If the source does not establish a location, return null.
- Evidence entries must be short paraphrases of the supplied source.
- Do not turn inference into fact.

Historical knowledge boundaries are critical.

An event happening does NOT mean every person knows about it.

Use knowledge_notes to distinguish:
1. what physically happened,
2. who could reasonably know it at that moment,
3. what ordinary passengers or the wider public would not yet know.

The current episode is:
RMS Titanic, April 1912.

The current development slice focuses on:
April 14, 1912 10:30 PM through April 15, 1912 12:30 AM.
`,

    input: sourceText,

    text: {
      format: {
        type: "json_schema",
        name: "historical_event_extraction",
        strict: true,
        schema: eventSchema,
      },
    },
  });

  if (!response.output_text) {
    throw new Error("OpenAI returned no output_text.");
  }

  const parsed = JSON.parse(response.output_text);

  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  await fs.writeFile(
    outputPath,
    JSON.stringify(parsed, null, 2) + "\n"
  );

  console.log("");
  console.log(`✓ Extracted ${parsed.events.length} event(s).`);
  console.log(`✓ Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error("");
  console.error("Event extraction failed:");
  console.error(error);

  process.exit(1);
});