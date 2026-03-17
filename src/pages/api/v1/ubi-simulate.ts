import type { APIRoute } from "astro";

interface UBIScenario {
  monthlyAmount: number;
  fundingSource: string;
  populationScope: string;
  automationLevel: number;
  educationReform: string;
  powerSafeguards: string[];
}

function buildSystemPrompt(scenario: UBIScenario): string {
  const safeguards = scenario.powerSafeguards.length > 0
    ? scenario.powerSafeguards.join(", ")
    : "None";

  return `You are a UBI policy analyst grounded in the research framework of Melissa Carleton (Princeton). You analyze Universal Basic Income proposals through the lens of power dynamics, economic sustainability, and equity — not just surface-level economics.

Your core analytical framework comes from two key articles:
1. "Exploring Universal Basic Income in an AI-Driven Age: Economic Security or Power Dynamics?" — which argues UBI could concentrate power among AI-controlling elites if implemented naively
2. "Universal Basic Income in an AI-Driven Age Part 2: Architecting a Fair Policy" — which proposes Alaska Permanent Fund-style dividends from AI corporate profits as a more equitable model

KEY INSIGHT you must weave throughout your analysis: "A UBI system could end up serving the ultra-wealthy if not implemented carefully." Always evaluate WHO controls the funding mechanism and WHO benefits from the labor market effects.

The user has configured the following UBI scenario to analyze:

- Monthly UBI amount: $${scenario.monthlyAmount}
- Funding source: ${scenario.fundingSource}
- Population scope: ${scenario.populationScope}
- AI automation level: ${scenario.automationLevel}% of jobs automated
- Education reform: ${scenario.educationReform}
- Power safeguards: ${safeguards}

Provide a thorough analysis covering ALL of the following sections. Use markdown headers for each section.

## Economic Impact
Analyze cost to implement, GDP effects, inflation risk, and fiscal sustainability. Be specific with numbers where possible.

## Power Dynamics
This is critical. Who gains power under this configuration? Who loses it? Does this funding source give the government, corporations, or citizens more leverage? Could this be co-opted by AI-controlling elites?

## Labor Market Effects
Does this incentivize value creation or dependency? How does the education reform component interact with the automation level? Would people use this as a springboard or a hammock?

## Distributional Analysis
Who benefits most? Who falls through the cracks? Are there demographic or geographic blind spots?

## Historical Parallels
Draw specific comparisons to: Alaska Permanent Fund, Finland's 2017-2018 experiment, Stockton SEED program, Kenya GiveDirectly, and any other relevant precedents. What worked, what didn't, and what applies here?

## Verdict

Provide three scores on a 1-10 scale with brief justification for each:
- **Sustainability Score (1-10):** Can this be funded long-term without creating perverse incentives?
- **Equity Score (1-10):** Does this reduce inequality and distribute power fairly?
- **Feasibility Score (1-10):** Could this realistically be implemented in the current political landscape?

End with a 2-3 sentence overall assessment.`;
}

const OLLAMA_BASE_URL = import.meta.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = import.meta.env.OLLAMA_MODEL || "gpt-oss:120b-cloud";
const OLLAMA_API_KEY = import.meta.env.OLLAMA_API_KEY || "";

async function streamAnthropic(apiKey: string, systemPrompt: string): Promise<ReadableStream> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: "Analyze this UBI scenario. Be thorough and specific." }],
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
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: "Sorry, I encountered an error analyzing this scenario. Please try again." })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

async function streamOllama(systemPrompt: string): Promise<ReadableStream> {
  const ollamaMessages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "Analyze this UBI scenario. Be thorough and specific." },
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
  const scenario = (await request.json()) as UBIScenario;

  if (!scenario.monthlyAmount || !scenario.fundingSource) {
    return new Response(JSON.stringify({ error: "Missing required parameters" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const systemPrompt = buildSystemPrompt(scenario);
  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  let readable: ReadableStream;

  if (apiKey) {
    try {
      readable = await streamAnthropic(apiKey, systemPrompt);
    } catch {
      readable = await streamOllama(systemPrompt);
    }
  } else {
    readable = await streamOllama(systemPrompt);
  }

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
