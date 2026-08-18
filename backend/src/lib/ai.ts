import { config } from "../config.js";
import { Errors } from "./errors.js";
import { z } from "zod";

const generatedSchema = z.object({
  summary: z.string().trim().min(1).max(4_000),
  questions: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(1_000),
        options: z.array(z.string().trim().min(1).max(500)).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string().trim().min(1).max(2_000),
      }),
    )
    .min(3),
});
type Generated = z.infer<typeof generatedSchema>;

const notesSchema = z.object({
  notes: z.string().trim().min(80).max(20_000),
});

async function chatJson(messages: { role: "system" | "user"; content: string }[]): Promise<unknown> {
  if (!config?.openaiKey) {
    throw Errors.validation(
      "Add OPENAI_API_KEY in your environment (Vercel → Settings → Environment Variables, or backend/.env locally), then redeploy or restart.",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${config.openaiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(config.aiTimeoutMs),
      headers: {
        Authorization: `Bearer ${config.openaiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": config.frontendUrl,
        "X-Title": "Aether",
      },
      body: JSON.stringify({
        model: config.openaiModel,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages,
      }),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw Errors.serviceUnavailable("The AI request timed out. Try again with a shorter document.", "AI_TIMEOUT");
    }
    throw Errors.serviceUnavailable("The AI provider could not be reached. Try again shortly.", "AI_UNAVAILABLE");
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`AI provider error ${response.status}: ${detail.slice(0, 500)}`);
    if (response.status === 401 || response.status === 403) {
      throw Errors.serviceUnavailable("The AI provider credentials are invalid.", "AI_AUTH");
    }
    if (response.status === 429) {
      throw Errors.serviceUnavailable("The AI provider is rate limited. Try again shortly.", "AI_RATE_LIMIT");
    }
    throw Errors.serviceUnavailable("The AI provider rejected the request. Try again shortly.", "AI_PROVIDER");
  }

  const payload = z
    .object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) })
    .safeParse(await response.json());
  const raw = payload.success ? payload.data.choices[0]?.message.content : undefined;
  if (!raw) throw Errors.validation("The AI returned an empty response. Try a shorter document.");

  try {
    return JSON.parse(raw);
  } catch {
    throw Errors.validation("The AI returned invalid JSON. Try generating again.");
  }
}

export async function generateQuizFromText(title: string, text: string, count = 50): Promise<Generated> {
  const material = text.slice(0, 14000);
  const parsed = generatedSchema.safeParse(
    await chatJson([
      {
        role: "system",
        content:
          "You are a university tutor. Create multiple-choice questions using ONLY the provided material. Do not invent facts that are not in the text. Return JSON only.",
      },
      {
        role: "user",
        content: `Document title: ${title}

Material:
${material}

Return JSON with this shape:
{
  "summary": "one short paragraph (80-120 words) of the main ideas",
  "questions": [
    {
      "question": "clear stem",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "one or two sentences from the material"
    }
  ]
}

Create exactly ${count} questions. Each must have 4 options. correctIndex is 0-3.`,
      },
    ]),
  );
  if (!parsed.success) throw Errors.validation("The AI returned an invalid quiz. Try generating again.");
  return parsed.data satisfies Generated;
}

export async function generateNotesFromText(title: string, text: string): Promise<string> {
  const material = text.slice(0, 24000);
  const parsed = notesSchema.safeParse(
    await chatJson([
      {
        role: "system",
        content:
          "You are a university tutor. Write detailed study notes using ONLY the provided material. Do not invent facts that are not in the text. Return JSON only.",
      },
      {
        role: "user",
        content: `Document title: ${title}

Material:
${material}

Return JSON with this shape:
{
  "notes": "long study notes as plain text"
}

Write comprehensive revision notes. Prefer 800-1500 words when the material supports it; if the source is shorter, cover everything it contains.

Use this structure with blank lines between sections:
1. Overview
2. Key terms and definitions
3. Main ideas and explanations
4. Processes, examples, or important details from the text
5. Exam takeaways

Use short headings in Title Case, then bullet points or short paragraphs. Do not use markdown symbols like # or *.`,
      },
    ]),
  );
  if (!parsed.success) throw Errors.validation("The AI returned invalid notes. Try generating again.");
  return parsed.data.notes;
}
