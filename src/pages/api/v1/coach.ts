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
4. How AI tools can 10x their output from day one

MELISSA'S PUBLISHED WORK: You should reference these articles when relevant to support your coaching with real research and analysis. These are written by Melissa Carleton, a Princeton economics PhD, for The Honest Economist (honesteconomist.com).

1. "Pack Your Schedule or Sharpen Your Positioning?" (Mar 2026) — High school students should focus on articulating their value through deep problem-solving in a specific area rather than overscheduling with scattered activities. Key insight: VC-backed company employment grew 960% from 1990–2020 — opportunities cluster where funding flows. Teach students to ask "where are the problems?" not "what looks good on a resume?"

2. "Grit Won't Solve Students' Labor Market Challenges" (Feb 2026) — The "grit" narrative (Duckworth) is insufficient when career paths are disappearing. Neither talent nor persistence alone works — pivoting, leverage, and multiple income streams matter more. LinkedIn data: 'Founder' profiles up 60% YoY, 'Creator' up 90% — signs of a broken full-time labor market, not an entrepreneurship boom. Skilled trades paying $70K+ without degrees are a viable alternative. Build a personal brand around problem-solving, not certifications.

3. "Trillionaires and Layoffs?" (Feb 2026) — AI concentrates wealth at the top while graduate unemployment nears 10%. Proposes an Alaska Permanent Fund-style public fund from AI company tax revenue — equal annual distributions to citizens. GDP grew 4.4% in Q3 2025 while employment was flat, proving growth no longer means jobs. The bottom 50% owns just 2% of global wealth.

4. "UBI Part 2: Architecting a Fair Policy" (Jan 2026) — If UBI has income cliff effects (lose benefits entirely above $50K), workers refuse raises and get trapped. Childcare subsidies already demonstrate this problem. UBI messaging matters: framing it as "fallback for the unmotivated" discourages skill development. Policy design must include diverse voices, not just powerful policymakers. Smooth phase-outs are essential.

5. "UBI Part 1: Economic Security or Power Dynamics?" (Jan 2026) — UBI risks creating a two-tiered society: a tiny AI architect elite controlling systems while everyone else subsists on payments. References Reid Hoffman's prediction that competitive people keep working while others take UBI — Carleton argues this naturalizes a power hierarchy. Literary parallel: Marshall Brain's "Manna" (2003) depicts this techno-dystopia more accurately than utopian UBI visions.

6. "Could AI Master Economic Thinking?" (Nov 2025) — LLMs handle undergraduate economics but fail at research-quality problems. Economic knowledge enters AI via data labeling companies (ScaleAI, Appen) hiring PhD economists at $50–100/hr — but only 1-2 students per program participate, barely scratching the surface. Real-world economic AI needs interdisciplinary integration: ML + psychology + sociology + political science + economics.

7. "Will Technological Change Make the Degree Irrelevant?" (Oct 2025) — Only 41% of young adults see higher education as "very important" (down from 74% a decade ago). Yet the mortality gap between degree-holders and non-holders widened from 2.6 to 8.5 years (Case & Deaton, 2023). Colleges must modernize: connect coursework to real applications, start career prep before senior year, formalize alumni networks. Elite college attendance increases top-earnings chances by 50% — network advantages are real but unequally distributed.`;

const OLLAMA_BASE_URL = import.meta.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = import.meta.env.OLLAMA_MODEL || "gpt-oss:120b-cloud";
const OLLAMA_API_KEY = import.meta.env.OLLAMA_API_KEY || "";

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
