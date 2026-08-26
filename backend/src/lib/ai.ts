import { config } from "../config.js";
import { Errors } from "./errors.js";
import { z } from "zod";

const generatedSchema = z.object({
  summary: z.string().trim().min(1).max(400),
  questions: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(1_000),
        options: z.array(z.string().trim().min(1).max(500)).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string().trim().min(1).max(400),
      }),
    )
    .min(3),
});
type Generated = z.infer<typeof generatedSchema>;

const notesSchema = z.object({
  notes: z.string().trim().min(40).max(8_000),
});

async function chatJson(
  messages: { role: "system" | "user"; content: string }[],
  maxTokens: number,
): Promise<unknown> {
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
        max_tokens: maxTokens,
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
    if (response.status === 402) {
      throw Errors.serviceUnavailable(
        "AI credits are low. Add credits at openrouter.ai/settings/credits, or try fewer questions.",
        "AI_CREDITS",
      );
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

/** Keep completion budget tight so quizzes finish quickly. */
function quizMaxTokens(count: number) {
  return Math.min(4_500, Math.max(900, count * 150 + 250));
}

export async function generateQuizFromText(title: string, text: string, count = 12): Promise<Generated> {
  const material = text.slice(0, 6_000);
  const parsed = generatedSchema.safeParse(
    await chatJson(
      [
        {
          role: "system",
          content:
            "You are a university tutor. Create multiple-choice questions using ONLY the provided material. Keep stems and explanations short. Return JSON only.",
        },
        {
          role: "user",
          content: `Document title: ${title}

Material:
${material}

Return JSON with this shape:
{
  "summary": "one sentence of the main idea",
  "questions": [
    {
      "question": "clear stem",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "one short sentence from the material"
    }
  ]
}

Create exactly ${count} questions. Each must have 4 short options. correctIndex is 0-3. Be concise.`,
        },
      ],
      quizMaxTokens(count),
    ),
  );
  if (!parsed.success) throw Errors.validation("The AI returned an invalid quiz. Try generating again.");
  return parsed.data satisfies Generated;
}

export async function generateQuizFromTopic(topic: string, count = 12): Promise<Generated> {
  const parsed = generatedSchema.safeParse(
    await chatJson(
      [
        {
          role: "system",
          content:
            "You are a university tutor. Create concise, accurate multiple-choice questions. Wrong options must be plausible. Return JSON only.",
        },
        {
          role: "user",
          content: `Topic: ${topic}

Return JSON with this shape:
{
  "summary": "one sentence introducing the topic",
  "questions": [
    {
      "question": "clear stem",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "one short teaching sentence"
    }
  ]
}

Create exactly ${count} questions. Each must have 4 short options. correctIndex is 0-3. Stay on this topic. Be concise.`,
        },
      ],
      quizMaxTokens(count),
    ),
  );
  if (!parsed.success) throw Errors.validation("The AI returned an invalid quiz. Try generating again.");
  return parsed.data satisfies Generated;
}

export async function generateNotesFromText(title: string, text: string): Promise<string> {
  const material = text.slice(0, 6_000);
  const parsed = notesSchema.safeParse(
    await chatJson(
      [
        {
          role: "system",
          content:
            "You are a university tutor. Write concise study notes using ONLY the provided material. Do not invent facts. Return JSON only.",
        },
        {
          role: "user",
          content: `Document title: ${title}

Material:
${material}

Return JSON with this shape:
{
  "notes": "study notes as plain text"
}

Write tight revision notes (about 250-500 words). Cover the main ideas only.

Use this structure with blank lines between sections:
1. Overview
2. Key terms
3. Main ideas
4. Exam takeaways

Use short headings in Title Case, then bullet points. Do not use markdown symbols like # or *.`,
        },
      ],
      1_600,
    ),
  );
  if (!parsed.success) throw Errors.validation("The AI returned invalid notes. Try generating again.");
  return parsed.data.notes;
}
