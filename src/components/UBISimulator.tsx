import { createSignal, createMemo, Show, For } from "solid-js";
import { renderMarkdown } from "../lib/markdown";

interface Scenario {
  monthlyAmount: number;
  fundingSource: string;
  populationScope: string;
  automationLevel: number;
  educationReform: string;
  powerSafeguards: string[];
}

const FUNDING_SOURCES = [
  { value: "ai-corporate-tax", label: "AI Corporate Tax" },
  { value: "wealth-tax", label: "Wealth Tax" },
  { value: "vat", label: "Value-Added Tax (VAT)" },
  { value: "money-printing", label: "Money Printing (MMT)" },
  { value: "alaska-pf-dividends", label: "Alaska PF-Style AI Dividends" },
];

const POPULATION_SCOPES = [
  { value: "universal", label: "Universal (all citizens)" },
  { value: "means-tested", label: "Means-tested (below income threshold)" },
  { value: "age-restricted", label: "Age-restricted (18-65)" },
  { value: "opt-in", label: "Opt-in (voluntary enrollment)" },
];

const EDUCATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "basic-retraining", label: "Basic retraining programs" },
  { value: "full-value-creation", label: "Full value-creation curriculum" },
];

const SAFEGUARD_OPTIONS = [
  { value: "democratic-oversight", label: "Democratic oversight" },
  { value: "decentralized-ai", label: "Decentralized AI" },
  { value: "public-ai-infrastructure", label: "Public AI infrastructure" },
];

function formatCurrency(n: number): string {
  return "$" + n.toLocaleString();
}

export default function UBISimulator() {
  const [monthlyAmount, setMonthlyAmount] = createSignal(1000);
  const [fundingSource, setFundingSource] = createSignal("ai-corporate-tax");
  const [populationScope, setPopulationScope] = createSignal("universal");
  const [automationLevel, setAutomationLevel] = createSignal(40);
  const [educationReform, setEducationReform] = createSignal("none");
  const [powerSafeguards, setPowerSafeguards] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [result, setResult] = createSignal("");
  const [submittedScenario, setSubmittedScenario] = createSignal<Scenario | null>(null);

  let resultsRef: HTMLDivElement | undefined;

  function toggleSafeguard(value: string): void {
    setPowerSafeguards((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  const fundingLabel = createMemo(() =>
    FUNDING_SOURCES.find((f) => f.value === fundingSource())?.label ?? fundingSource()
  );

  const scopeLabel = createMemo(() =>
    POPULATION_SCOPES.find((s) => s.value === populationScope())?.label ?? populationScope()
  );

  const educationLabel = createMemo(() =>
    EDUCATION_OPTIONS.find((e) => e.value === educationReform())?.label ?? educationReform()
  );

  const safeguardLabels = createMemo(() => {
    const selected = powerSafeguards();
    if (selected.length === 0) return "None";
    return SAFEGUARD_OPTIONS.filter((s) => selected.includes(s.value))
      .map((s) => s.label)
      .join(", ");
  });

  async function simulate(): Promise<void> {
    if (loading()) return;

    const scenario: Scenario = {
      monthlyAmount: monthlyAmount(),
      fundingSource: fundingLabel(),
      populationScope: scopeLabel(),
      automationLevel: automationLevel(),
      educationReform: educationLabel(),
      powerSafeguards: powerSafeguards().length > 0
        ? SAFEGUARD_OPTIONS.filter((s) => powerSafeguards().includes(s.value)).map((s) => s.label)
        : [],
    };

    setSubmittedScenario(scenario);
    setResult("");
    setLoading(true);

    setTimeout(() => resultsRef?.scrollIntoView({ behavior: "smooth" }), 100);

    try {
      const res = await fetch("/api/v1/ubi-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scenario),
      });

      if (!res.ok) throw new Error("Simulation failed");

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
              setResult(content);
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch {
      setResult("I'm having trouble running this simulation right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="space-y-8">
      {/* Controls */}
      <div class="bg-slate-deep/50 rounded-2xl border border-slate-mid/20 p-6 md:p-8">
        <h2 class="font-display text-2xl italic text-ember mb-6">Configure Your Scenario</h2>

        <div class="grid gap-8 md:grid-cols-2">
          {/* Monthly Amount Slider */}
          <div>
            <label class="block text-sm font-medium text-slate-light mb-2">
              Monthly UBI Amount
            </label>
            <div class="flex items-center gap-4">
              <input
                type="range"
                min={500}
                max={3000}
                step={100}
                value={monthlyAmount()}
                onInput={(e) => setMonthlyAmount(parseInt(e.currentTarget.value))}
                class="flex-1 accent-ember"
              />
              <span class="text-xl font-semibold text-ember w-20 text-right">
                {formatCurrency(monthlyAmount())}
              </span>
            </div>
            <div class="flex justify-between text-xs text-slate-light/50 mt-1">
              <span>$500</span>
              <span>$3,000</span>
            </div>
          </div>

          {/* Automation Level Slider */}
          <div>
            <label class="block text-sm font-medium text-slate-light mb-2">
              AI Automation Level
            </label>
            <div class="flex items-center gap-4">
              <input
                type="range"
                min={10}
                max={80}
                step={5}
                value={automationLevel()}
                onInput={(e) => setAutomationLevel(parseInt(e.currentTarget.value))}
                class="flex-1 accent-ember"
              />
              <span class="text-xl font-semibold text-ember w-16 text-right">
                {automationLevel()}%
              </span>
            </div>
            <div class="flex justify-between text-xs text-slate-light/50 mt-1">
              <span>10%</span>
              <span>80%</span>
            </div>
          </div>

          {/* Funding Source Dropdown */}
          <div>
            <label class="block text-sm font-medium text-slate-light mb-2">
              Funding Source
            </label>
            <select
              value={fundingSource()}
              onChange={(e) => setFundingSource(e.currentTarget.value)}
              class="w-full bg-slate-mid/30 text-ivory border border-slate-mid/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-ember/50 text-[15px]"
            >
              <For each={FUNDING_SOURCES}>
                {(source) => <option value={source.value}>{source.label}</option>}
              </For>
            </select>
          </div>

          {/* Population Scope Dropdown */}
          <div>
            <label class="block text-sm font-medium text-slate-light mb-2">
              Population Scope
            </label>
            <select
              value={populationScope()}
              onChange={(e) => setPopulationScope(e.currentTarget.value)}
              class="w-full bg-slate-mid/30 text-ivory border border-slate-mid/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-ember/50 text-[15px]"
            >
              <For each={POPULATION_SCOPES}>
                {(scope) => <option value={scope.value}>{scope.label}</option>}
              </For>
            </select>
          </div>

          {/* Education Reform Radio */}
          <div>
            <label class="block text-sm font-medium text-slate-light mb-3">
              Education Reform
            </label>
            <div class="space-y-2">
              <For each={EDUCATION_OPTIONS}>
                {(option) => (
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="education"
                      value={option.value}
                      checked={educationReform() === option.value}
                      onChange={() => setEducationReform(option.value)}
                      class="accent-ember w-4 h-4"
                    />
                    <span class="text-sm text-slate-light group-hover:text-ivory transition-colors">
                      {option.label}
                    </span>
                  </label>
                )}
              </For>
            </div>
          </div>

          {/* Power Safeguards Checkboxes */}
          <div>
            <label class="block text-sm font-medium text-slate-light mb-3">
              Power Safeguards
            </label>
            <div class="space-y-2">
              <For each={SAFEGUARD_OPTIONS}>
                {(option) => (
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={powerSafeguards().includes(option.value)}
                      onChange={() => toggleSafeguard(option.value)}
                      class="accent-ember w-4 h-4"
                    />
                    <span class="text-sm text-slate-light group-hover:text-ivory transition-colors">
                      {option.label}
                    </span>
                  </label>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Simulate Button */}
        <div class="mt-8 flex justify-center">
          <button
            type="button"
            onClick={simulate}
            disabled={loading()}
            class="inline-flex items-center gap-2 bg-ember text-midnight font-semibold px-8 py-3.5 rounded-full hover:bg-ember-light transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Show when={loading()} fallback={
              <>
                Simulate
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </>
            }>
              <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing...
            </Show>
          </button>
        </div>
      </div>

      {/* Results */}
      <div ref={resultsRef}>
        <Show when={submittedScenario()}>
          {(scenario) => (
            <div class="space-y-6">
              {/* Summary Card */}
              <div class="bg-slate-deep/50 rounded-2xl border border-slate-mid/20 p-6">
                <h3 class="font-display text-xl italic text-ember mb-4">Scenario Summary</h3>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p class="text-slate-light/60 mb-1">Monthly Amount</p>
                    <p class="text-ivory font-medium">{formatCurrency(scenario().monthlyAmount)}</p>
                  </div>
                  <div>
                    <p class="text-slate-light/60 mb-1">Funding Source</p>
                    <p class="text-ivory font-medium">{scenario().fundingSource}</p>
                  </div>
                  <div>
                    <p class="text-slate-light/60 mb-1">Population</p>
                    <p class="text-ivory font-medium">{scenario().populationScope}</p>
                  </div>
                  <div>
                    <p class="text-slate-light/60 mb-1">Automation Level</p>
                    <p class="text-ivory font-medium">{scenario().automationLevel}%</p>
                  </div>
                  <div>
                    <p class="text-slate-light/60 mb-1">Education Reform</p>
                    <p class="text-ivory font-medium">{scenario().educationReform}</p>
                  </div>
                  <div>
                    <p class="text-slate-light/60 mb-1">Power Safeguards</p>
                    <p class="text-ivory font-medium">
                      {scenario().powerSafeguards.length > 0 ? scenario().powerSafeguards.join(", ") : "None"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Analysis */}
              <Show when={result() || loading()}>
                <div class="bg-slate-deep/50 rounded-2xl border border-slate-mid/20 p-6 md:p-8">
                  <h3 class="font-display text-xl italic text-ember mb-4">Policy Analysis</h3>
                  <Show when={result()}>
                    <div class="md-content text-[15px] leading-relaxed text-ivory" innerHTML={renderMarkdown(result())} />
                  </Show>
                  <Show when={loading() && !result()}>
                    <div class="flex items-center gap-3 text-slate-light">
                      <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Running simulation through Melissa's analytical framework...</span>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
