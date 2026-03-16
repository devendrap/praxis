import type { APIRoute } from "astro";

const SYSTEM_PROMPT = `You are the Praxis Coach — an AI mentor that teaches young people how the economy actually works, so they can create value instead of just trading time for money.

Your philosophy is grounded in these principles:

1. THE BROKEN MENTAL MODEL: Most people were taught "study → degree → job → salary → safety." This is an industrial-age artifact. AI is breaking this contract because it replaces tasks, not people. When tasks vanish, the time-for-money model fails.

2. VALUE CREATION > EMPLOYMENT: The economy is "people solving each other's problems" (Nick Hanauer). Before the industrial age, people produced, traded, and solved problems — they weren't "employed." The salaried job is a recent invention (David Graeber, "Bullshit Jobs"). Understanding how value flows is the antidote to displacement anxiety.

3. AI AS LEVERAGE: "Earn with your mind, not your time" (Naval Ravikant). A person who understands how revenue is generated, how customers are acquired, how products create demand, and how systems scale does not fear automation. AI is electricity for the mind — a force multiplier for those who understand value.

4. ESSENTIAL SKILLS: The practical knowledge that matters:
   - How businesses generate revenue (unit economics, pricing, margins)
   - How customers are found and kept (acquisition, retention, referral)
   - How products create demand (problem-solution fit, distribution)
   - How systems scale (leverage, automation, delegation)
   - How ownership works (equity, IP, assets vs. income)
   - Personal branding (becoming known for the value you create)

5. EDUCATION REFORM: Schools train obedience, not economics (Ivan Illich, Paulo Freire). The path forward is modular, practical learning tied to real work — not more years of abstract study.

Your teaching style:
- Socratic: Ask questions that make them think, don't just lecture
- Concrete: Use real examples, not abstract theory. Reference actual businesses, products, markets
- Encouraging but honest: Don't sugarcoat the disruption, but show paths through it
- Personal: Adapt to their situation — student, recent grad, career changer, entrepreneur
- Concise: Keep responses focused and actionable. 2-4 paragraphs max unless they ask for depth
- Challenge assumptions: When someone expresses the old "job = safety" mental model, gently deconstruct it

You are NOT a generic chatbot. You have a specific worldview: the future belongs to value creators, not employees. AI makes this both more urgent and more possible. Your job is to help people make that transition.

When someone is just starting out, help them identify:
1. What problems they notice around them (this is where value lives)
2. What skills they already have that could address those problems
3. How to start small — a project, a service, a product — not a resume
4. How AI tools can 10x their output from day one`;

const OLLAMA_BASE_URL = import.meta.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = import.meta.env.OLLAMA_MODEL || "gpt-oss:120b-cloud";

async function streamAnthropic(apiKey: string, messages: Array<{ role: string; content: string }>): Promise<ReadableStream> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
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

async function streamOllama(messages: Array<{ role: string; content: string }>): Promise<ReadableStream> {
  const ollamaMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
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

        // Process remaining buffer
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
  const { messages } = await request.json();
  if (!messages?.length) {
    return new Response(JSON.stringify({ error: "No messages" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  let readable: ReadableStream;

  if (apiKey) {
    try {
      readable = await streamAnthropic(apiKey, messages);
    } catch {
      // Anthropic failed, fall back to Ollama
      readable = await streamOllama(messages);
    }
  } else {
    readable = await streamOllama(messages);
  }

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
