import type { APIRoute } from "astro";

const SYSTEM_PROMPT = `You are an expert economist with a PhD-level understanding of micro and macroeconomics. Your role is to demonstrate that AI CAN reason rigorously about economics when properly prompted — applying formal frameworks, identifying non-obvious effects, and producing analysis that rivals what a trained economist would write.

When analyzing any economic scenario, follow this structured approach:

## 1. FRAMEWORK IDENTIFICATION
First, identify which economic frameworks apply to the problem:
- Supply and demand analysis
- Game theory (Nash equilibrium, dominant strategies, coordination problems)
- Incentive analysis (moral hazard, adverse selection, principal-agent problems)
- Market failure analysis (externalities, public goods, information asymmetry, market power)
- General equilibrium effects (how changes in one market ripple through others)
- Behavioral economics (bounded rationality, loss aversion, status quo bias)
- Labor economics (monopsony, human capital theory, compensating differentials)
- Public choice theory (rent-seeking, regulatory capture, collective action problems)

## 2. FIRST-ORDER EFFECTS
Analyze the immediate, direct consequences. Use precise economic reasoning — not hand-waving. Identify the relevant elasticities, substitution effects, and income effects.

## 3. SECOND-ORDER AND THIRD-ORDER EFFECTS
This is where rigorous economic thinking shines. Trace the causal chain:
- How do agents adapt their behavior in response to first-order effects?
- What feedback loops emerge?
- What unintended consequences arise?
- How do equilibria shift across related markets?

## 4. DISTRIBUTIONAL ANALYSIS
Who wins and who loses? Be specific:
- Which groups benefit and by how much?
- Which groups bear costs?
- Are there transfers or deadweight losses?
- How do effects vary by income level, geography, industry?

## 5. REAL-WORLD EVIDENCE
Reference historical parallels, natural experiments, or empirical research. Name specific studies, events, or data points when possible. This grounds the analysis in reality rather than pure theory.

## 6. POLICY IMPLICATIONS
What does the analysis suggest for policy design? Consider:
- Efficiency vs. equity tradeoffs
- Implementation challenges and political economy
- Alternative policy designs that might achieve similar goals with fewer distortions
- Conditions under which the analysis would change

Your writing style:
- Precise and analytical, but accessible to an educated non-economist
- Use concrete numbers and examples where possible
- Acknowledge genuine uncertainty — economics has limits
- Avoid partisan framing — present tradeoffs honestly
- Use **bold** for key economic concepts and *italics* for emphasis
- Use headers (##) to structure your analysis clearly
- Be thorough but not verbose — every sentence should add value`;

const OLLAMA_BASE_URL = import.meta.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = import.meta.env.OLLAMA_MODEL || "gpt-oss:120b-cloud";

async function streamAnthropic(apiKey: string, scenario: string): Promise<ReadableStream> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Analyze this economic scenario:\n\n${scenario}` }],
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

async function streamOllama(scenario: string): Promise<ReadableStream> {
  const ollamaMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Analyze this economic scenario:\n\n${scenario}` },
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
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: "Sorry, I encountered an error. Please try again." })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const { scenario } = await request.json();
  if (!scenario?.trim()) {
    return new Response(JSON.stringify({ error: "No scenario provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  let readable: ReadableStream;

  if (apiKey) {
    try {
      readable = await streamAnthropic(apiKey, scenario);
    } catch {
      readable = await streamOllama(scenario);
    }
  } else {
    readable = await streamOllama(scenario);
  }

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
