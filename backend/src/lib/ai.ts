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

export async function generateQuizFromText(title: string, text: string, count = 50): Promise<Generated> {
  if (!config.openaiKey) {
    throw Errors.validation(
      "Add OPENAI_API_KEY in your environment (Vercel → Settings → Environment Variables, or backend/.env locally), then redeploy or restart.",
    );
  }

  const material = text.slice(0, 14000);
  let response: Response;
  try {
    response = await fetch(`${config.openaiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(config.aiTimeoutMs),
      headers: {
        Authorization: `Bearer ${config.openaiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": config.frontendUrl,
        "X-Title": "StudyForge",
      },
      body: JSON.stringify({
        model: config.openaiModel,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a university tutor. Create study notes and multiple-choice questions using ONLY the provided material. Do not invent facts that are not in the text. Return JSON only.",
          },
          {
            role: "user",
            content: `Document title: ${title}

Material:
${material}

Return JSON with this shape:
{
  "summary": "150-220 word study notes covering the main ideas",
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
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw Errors.serviceUnavailable("Quiz generation timed out. Try again with a shorter document.", "AI_TIMEOUT");
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Errors.validation("The AI returned invalid JSON. Try generating again.");
  }

  const generated = generatedSchema.safeParse(parsed);
  if (!generated.success) throw Errors.validation("The AI returned an invalid quiz. Try generating again.");
  return generated.data satisfies Generated;
}
