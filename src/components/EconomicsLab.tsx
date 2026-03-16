import { createSignal, Show } from "solid-js";
import { renderMarkdown } from "../lib/markdown";

interface Scenario {
  title: string;
  prompt: string;
  icon: string;
  color: "ember" | "sage";
}

const SCENARIOS: Scenario[] = [
  {
    title: "Minimum Wage Shock",
    prompt: "A city wants to implement a $20/hr minimum wage. What happens?",
    icon: "dollar",
    color: "ember",
  },
  {
    title: "AI Productivity Boom",
    prompt: "An AI tool makes lawyers 10x more productive. Who wins and who loses?",
    icon: "bolt",
    color: "sage",
  },
  {
    title: "Mass Automation",
    prompt: "A company automates 60% of its workforce. Model the ripple effects.",
    icon: "cog",
    color: "ember",
  },
  {
    title: "AI Tax & UBI",
    prompt: "Should governments tax AI companies to fund UBI? Analyze the tradeoffs.",
    icon: "scale",
    color: "sage",
  },
  {
    title: "Education Disruption",
    prompt: "A college degree costs $200K but AI can teach the same skills. What's the equilibrium?",
    icon: "academic",
    color: "ember",
  },
  {
    title: "Economic Recovery",
    prompt: "A small town's main employer closes. Design an economic recovery plan.",
    icon: "map",
    color: "sage",
  },
];

function ScenarioIcon(props: { icon: string; class?: string }) {
  const paths: Record<string, string> = {
    dollar: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    bolt: "M13 10V3L4 14h7v7l9-11h-7z",
    cog: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
    scale: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3",
    academic: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222",
    map: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  };

  return (
    <svg class={props.class ?? "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d={paths[props.icon] ?? paths.dollar} />
    </svg>
  );
}

export default function EconomicsLab() {
  const [selectedScenario, setSelectedScenario] = createSignal("");
  const [customInput, setCustomInput] = createSignal("");
  const [response, setResponse] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [activeLabel, setActiveLabel] = createSignal("");
  let responseRef: HTMLDivElement | undefined;

  async function analyze(scenario: string, label?: string): Promise<void> {
    if (!scenario.trim() || loading()) return;

    setSelectedScenario(scenario);
    setActiveLabel(label ?? "Custom Scenario");
    setResponse("");
    setLoading(true);

    // Scroll to response area
    setTimeout(() => responseRef?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

    try {
      const res = await fetch("/api/v1/economics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });

      if (!res.ok) throw new Error("API error");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let content = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              content += parsed.text;
              setResponse(content);
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch {
      setResponse("I'm having trouble connecting right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCustomSubmit(e: Event): void {
    e.preventDefault();
    const text = customInput().trim();
    if (text) {
      analyze(text);
      setCustomInput("");
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCustomSubmit(e);
    }
  }

  function reset(): void {
    setSelectedScenario("");
    setResponse("");
    setActiveLabel("");
    setLoading(false);
  }

  return (
    <div class="space-y-10">
      {/* Scenario Cards */}
      <div>
        <h2 class="font-display text-2xl md:text-3xl italic mb-6">Choose a scenario</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SCENARIOS.map((s) => (
            <button
              type="button"
              onClick={() => analyze(s.prompt, s.title)}
              disabled={loading()}
              class={`group text-left rounded-2xl p-6 border transition-all duration-200 ${
                selectedScenario() === s.prompt
                  ? s.color === "ember"
                    ? "bg-ember/10 border-ember/40"
                    : "bg-sage/10 border-sage/40"
                  : "bg-slate-deep/50 border-slate-mid/20 hover:border-slate-mid/50 hover:bg-slate-deep/80"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div
                class={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${
                  s.color === "ember" ? "bg-ember/10" : "bg-sage/10"
                }`}
              >
                <ScenarioIcon icon={s.icon} class={`w-5 h-5 ${s.color === "ember" ? "text-ember" : "text-sage"}`} />
              </div>
              <h3 class="text-lg font-semibold mb-2 text-ivory group-hover:text-ember-light transition-colors">
                {s.title}
              </h3>
              <p class="text-sm text-slate-light leading-relaxed">{s.prompt}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Input */}
      <div>
        <h2 class="font-display text-2xl md:text-3xl italic mb-4">Or ask your own</h2>
        <form onSubmit={handleCustomSubmit} class="flex gap-3 items-end">
          <textarea
            value={customInput()}
            onInput={(e) => setCustomInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe an economic scenario or policy question..."
            rows={2}
            disabled={loading()}
            class="flex-1 bg-slate-deep/50 text-ivory placeholder-slate-light/40 rounded-xl px-5 py-3.5 resize-none focus:outline-none focus:ring-1 focus:ring-ember/50 text-[15px] border border-slate-mid/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading() || !customInput().trim()}
            class="bg-ember text-midnight rounded-xl px-6 py-3.5 font-semibold hover:bg-ember-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
            Analyze
          </button>
        </form>
      </div>

      {/* Response Area */}
      <Show when={selectedScenario()}>
        <div ref={responseRef} class="scroll-mt-8">
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="text-sm text-slate-light/60 uppercase tracking-wider font-medium mb-1">Analysis</p>
              <h2 class="font-display text-2xl md:text-3xl italic text-ember">{activeLabel()}</h2>
            </div>
            <button
              type="button"
              onClick={reset}
              class="text-sm text-slate-light hover:text-ivory transition-colors border border-slate-mid/30 rounded-full px-4 py-1.5"
            >
              New scenario
            </button>
          </div>

          <div class="bg-slate-deep/50 rounded-2xl border border-slate-mid/20 p-6 md:p-8">
            {/* Scenario prompt display */}
            <div class="bg-slate-mid/20 rounded-xl px-5 py-3.5 mb-6 border border-slate-mid/20">
              <p class="text-slate-light text-[15px] italic">{selectedScenario()}</p>
            </div>

            {/* AI response */}
            <Show
              when={response()}
              fallback={
                <div class="flex items-center gap-3 text-slate-light py-8 justify-center">
                  <div class="flex gap-1.5">
                    <div class="w-2 h-2 bg-ember/60 rounded-full animate-bounce" style="animation-delay: 0ms" />
                    <div class="w-2 h-2 bg-ember/60 rounded-full animate-bounce" style="animation-delay: 150ms" />
                    <div class="w-2 h-2 bg-ember/60 rounded-full animate-bounce" style="animation-delay: 300ms" />
                  </div>
                  <span class="text-sm">Applying economic frameworks...</span>
                </div>
              }
            >
              <div class="md-content text-[15px] leading-relaxed text-ivory" innerHTML={renderMarkdown(response())} />
              <Show when={loading()}>
                <div class="flex gap-1.5 mt-4">
                  <div class="w-2 h-2 bg-ember/60 rounded-full animate-bounce" style="animation-delay: 0ms" />
                  <div class="w-2 h-2 bg-ember/60 rounded-full animate-bounce" style="animation-delay: 150ms" />
                  <div class="w-2 h-2 bg-ember/60 rounded-full animate-bounce" style="animation-delay: 300ms" />
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
