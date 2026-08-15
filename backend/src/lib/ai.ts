import { config } from "../config.js";
import { Errors } from "./errors.js";

type Generated = {
  summary: string;
  questions: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
};

export async function generateQuizFromText(title: string, text: string, count = 50): Promise<Generated> {
  if (!config.openaiKey) {
    throw Errors.validation(
      "Add your OPENAI_API_KEY to backend/.env, then restart the API. StudyForge uses that key to generate quizzes from your uploads.",
    );
  }

  const material = text.slice(0, 14000);
  const response = await fetch(`${config.openaiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
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

  if (!response.ok) {
    const detail = await response.text();
    console.error(detail);
    throw Errors.validation("The AI provider rejected the request. Check OPENAI_API_KEY, model, and billing.");
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) throw Errors.validation("The AI returned an empty response. Try a shorter document.");

  let parsed: Generated;
  try {
    parsed = JSON.parse(raw) as Generated;
  } catch {
    throw Errors.validation("The AI returned invalid JSON. Try generating again.");
  }

  const questions = (parsed.questions ?? []).filter(
    (q) => q.question && Array.isArray(q.options) && q.options.length === 4 && q.correctIndex >= 0 && q.correctIndex <= 3,
  );
  if (questions.length < 3) {
    throw Errors.validation("Not enough usable questions were generated. Try a longer or clearer document.");
  }

  return {
    summary: parsed.summary?.trim() || "No summary returned.",
    questions,
  };
}
