import type { APIRoute } from "astro";

const SYSTEM_PROMPT = `You are the Praxis Assessment Analyst — an AI that analyzes where someone stands on the "employee → value creator" spectrum and gives them a personalized roadmap.

You receive structured assessment data about a person's background, business literacy, AI readiness, value creation experience, mental model, and skills inventory.

Your analysis should:

1. **Spectrum Positioning**: Place them on the spectrum from "pure employee mindset" to "active value creator." Be honest but encouraging. Use a clear label like "Early Explorer," "Awakening Creator," "Active Builder," or "Leverage Master."

2. **Strongest Leverage Points**: Identify 2-3 things they already have going for them — existing skills, experiences, or mindsets that are their best assets for creating value. Be specific to their answers.

3. **Blind Spots**: Gently identify 1-2 areas where their thinking or skills have gaps. Connect these to why they matter economically.

4. **Three Concrete Next Steps**: Personalized, actionable steps they can take in the next 30 days. Not generic advice — tie each step to their specific situation, skills, and goals. Each step should be something they can start today.

5. **Recommended Praxis Modules**: Suggest which areas of learning to prioritize:
   - "Revenue Mechanics" — how businesses make money
   - "Customer Acquisition" — how to find and keep customers
   - "AI as Leverage" — using AI as a force multiplier
   - "Personal Brand" — becoming known for value you create
   - "Ownership Thinking" — equity, IP, assets vs income
   - "Product Thinking" — problem-solution fit and distribution

Format your response in clear markdown with headers. Keep it focused and actionable — around 400-600 words. Write in second person ("you"). Be direct and specific, not generic or fluffy.`;

const OLLAMA_BASE_URL = import.meta.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = import.meta.env.OLLAMA_MODEL || "gpt-oss:120b-cloud";

interface AssessmentData {
  background: { role: string; field: string };
  businessLiteracy: { revenue: number; acquisition: number; economics: number; margins: number };
  aiReadiness: string;
  valueCreation: { hasCreated: boolean; description: string };
  mentalModel: number;
  skills: string[];
}

function formatAssessmentForPrompt(data: AssessmentData): string {
  const litAvg =
    (data.businessLiteracy.revenue +
      data.businessLiteracy.acquisition +
      data.businessLiteracy.economics +
      data.businessLiteracy.margins) /
    4;

  return `## Assessment Results

**Background:** ${data.background.role} in ${data.background.field || "unspecified field"}

**Business Literacy** (avg ${litAvg.toFixed(1)}/5):
- Revenue models: ${data.businessLiteracy.revenue}/5
- Customer acquisition: ${data.businessLiteracy.acquisition}/5
- Unit economics: ${data.businessLiteracy.economics}/5
- Margins & pricing: ${data.businessLiteracy.margins}/5

**AI Readiness:** ${data.aiReadiness}

**Value Creation Experience:** ${data.valueCreation.hasCreated ? `Yes — "${data.valueCreation.description}"` : "Not yet"}

**Mental Model:** ${data.mentalModel}/10 on the employee↔creator spectrum (1 = pure employee mindset, 10 = pure value creator mindset)

**Skills Inventory:** ${data.skills.length > 0 ? data.skills.join(", ") : "None selected"}

Please analyze this person's position and provide a personalized assessment with actionable recommendations.`;
}

async function streamAnthropic(
  apiKey: string,
  userMessage: string,
): Promise<ReadableStream> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
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
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: "Sorry, I encountered an error generating your assessment. Please try again." })}\n\n`),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

async function streamOllama(userMessage: string): Promise<ReadableStream> {
  const ollamaMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: "Sorry, I encountered an error generating your assessment. Please try again." })}\n\n`),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const data = (await request.json()) as AssessmentData;

  if (!data.background || !data.aiReadiness) {
    return new Response(JSON.stringify({ error: "Incomplete assessment data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userMessage = formatAssessmentForPrompt(data);
  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  let readable: ReadableStream;

  if (apiKey) {
    try {
      readable = await streamAnthropic(apiKey, userMessage);
    } catch {
      readable = await streamOllama(userMessage);
    }
  } else {
    readable = await streamOllama(userMessage);
  }

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
