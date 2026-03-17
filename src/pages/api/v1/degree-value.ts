import type { APIRoute } from "astro";

interface DegreeFormData {
  degreeType: string;
  fieldOfStudy: string;
  institutionType: string;
  totalCost: number;
  yearsRemaining: number;
  currentSkills: string[];
  careerGoal: string;
  aiExposure: string;
}

function buildUserPrompt(data: DegreeFormData): string {
  return `Analyze this student's degree path:

- **Degree type:** ${data.degreeType}
- **Field of study:** ${data.fieldOfStudy}
- **Institution type:** ${data.institutionType}
- **Total cost (tuition + living):** $${data.totalCost.toLocaleString()}
- **Years remaining:** ${data.yearsRemaining}
- **Current skills:** ${data.currentSkills.join(", ") || "None selected"}
- **Career goal:** ${data.careerGoal}
- **AI exposure level:** ${data.aiExposure}

Provide a thorough analysis following all sections described in your instructions.`;
}

const SYSTEM_PROMPT = `You are the Praxis Degree Value Analyst. Your job is to give students an honest, unflinching analysis of whether their degree path leads to real value creation or just credentialing.

Your analysis is grounded in Melissa Carleton's argument from "Will Technological Change Make the Degree Irrelevant? It's Up to Colleges to Decide." Her core thesis: colleges must adapt or degrees will lose relevance. But the student shouldn't wait for colleges to catch up — they need to take ownership now.

For every analysis, provide ALL of the following sections:

## ROI Analysis
Given the cost and field, what's the realistic financial return? Factor in how AI is disrupting this specific field. Be concrete with numbers where possible — median salaries, debt-to-income ratios, break-even timelines.

## Automation Risk
How much of this degree's typical career path is automatable in the next 5 years? Which specific tasks in this field are most vulnerable? Which are resilient? Give a percentage estimate and explain your reasoning.

## Credential vs. Skill Value
Is this degree valuable for the credential (signaling to employers) or the actual skills learned? Could those skills be acquired faster and cheaper through alternative paths? Be specific about what the credential signals vs. what the coursework teaches.

## Value Creation Score (1-10)
Rate this path on whether it teaches the student to CREATE value (build, ship, solve real problems) versus just FILL a role (follow instructions, complete assignments, get certified). Explain the score.

## Alternative Paths
What could this person do instead of or in parallel with their degree? Consider: projects, freelancing, AI-augmented work, entrepreneurship, apprenticeships, online credentials, open-source contributions. Be specific to their field and skills.

## Recommendations
Give exactly 3 concrete, actionable steps this person should take regardless of whether they continue the degree. Each should be something they can start this week.

End with a direct reference to Melissa Carleton's argument: remind the student that it's up to colleges to decide whether degrees stay relevant — but it's up to the STUDENT to decide whether they'll wait around for that answer or start creating value now.

Your tone: honest, direct, encouraging but never patronizing. You respect the student's intelligence. You don't sugarcoat — if a degree path has poor ROI, say so clearly. But always show a path forward.`;

const OLLAMA_BASE_URL = import.meta.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = import.meta.env.OLLAMA_MODEL || "gpt-oss:120b-cloud";
const OLLAMA_API_KEY = import.meta.env.OLLAMA_API_KEY || "";

async function streamAnthropic(apiKey: string, userPrompt: string): Promise<ReadableStream> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: "Sorry, I encountered an error. Please try again." })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

async function streamOllama(userPrompt: string): Promise<ReadableStream> {
  const ollamaMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(OLLAMA_API_KEY && { "Authorization": `Bearer ${OLLAMA_API_KEY}` }),
    },
    body: JSON.stringify({ model: OLLAMA_MODEL, messages: ollamaMessages, stream: true }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama error: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.message.content })}\n\n`));
              }
            } catch {
              // skip malformed lines
            }
          }
        }

        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer);
            if (parsed.message?.content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.message.content })}\n\n`));
            }
          } catch {
            // skip
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: "Sorry, I encountered an error. Please try again." })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const data = (await request.json()) as DegreeFormData;

  if (!data.fieldOfStudy || !data.careerGoal) {
    return new Response(JSON.stringify({ error: "Field of study and career goal are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userPrompt = buildUserPrompt(data);
  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  let readable: ReadableStream;

  if (apiKey) {
    try {
      readable = await streamAnthropic(apiKey, userPrompt);
    } catch {
      readable = await streamOllama(userPrompt);
    }
  } else {
    readable = await streamOllama(userPrompt);
  }

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
