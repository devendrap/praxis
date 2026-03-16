import { createSignal, createMemo, For, Show } from "solid-js";
import { renderMarkdown } from "../lib/markdown";

const TOTAL_STEPS = 6;

const ROLE_OPTIONS = [
  { value: "high-school", label: "High school student" },
  { value: "college", label: "College student" },
  { value: "recent-grad", label: "Recent graduate" },
  { value: "career-changer", label: "Career changer" },
  { value: "employed", label: "Currently employed" },
  { value: "freelance", label: "Freelancer / Self-employed" },
];

const AI_LEVELS = [
  { value: "never", label: "Never used it", description: "I haven't really tried AI tools yet" },
  { value: "basic", label: "Basic / Curious", description: "I've played with ChatGPT or similar a few times" },
  { value: "daily", label: "Daily tool", description: "I use AI regularly in my work or studies" },
  { value: "building", label: "Building with it", description: "I'm creating products or workflows powered by AI" },
];

const SKILLS_LIST = [
  "Writing & Communication",
  "Coding / Software Development",
  "Visual Design",
  "Sales & Persuasion",
  "Marketing & Content",
  "Data Analysis",
  "Public Speaking",
  "Project Management",
  "Financial Literacy",
  "Video / Audio Production",
  "Teaching / Mentoring",
  "Research & Synthesis",
  "Customer Service",
  "Problem Solving",
  "Networking / Relationship Building",
  "Foreign Languages",
];

interface AssessmentState {
  background: { role: string; field: string };
  businessLiteracy: { revenue: number; acquisition: number; economics: number; margins: number };
  aiReadiness: string;
  valueCreation: { hasCreated: boolean; description: string };
  mentalModel: number;
  skills: string[];
}

function LikertScale(props: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div class="space-y-2">
      <div class="flex justify-between items-center">
        <label class="text-sm text-slate-light">{props.label}</label>
        <span class="text-sm font-medium text-ember">{props.value}/5</span>
      </div>
      <div class="flex gap-2">
        <For each={[1, 2, 3, 4, 5]}>
          {(n) => (
            <button
              type="button"
              onClick={() => props.onChange(n)}
              class={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${
                n <= props.value
                  ? "bg-ember text-midnight"
                  : "bg-slate-mid/30 text-slate-light hover:bg-slate-mid/50"
              }`}
            >
              {n}
            </button>
          )}
        </For>
      </div>
      <div class="flex justify-between text-xs text-slate-light/50">
        <span>No idea</span>
        <span>Very confident</span>
      </div>
    </div>
  );
}

export default function Assessment() {
  const [step, setStep] = createSignal(1);
  const [loading, setLoading] = createSignal(false);
  const [result, setResult] = createSignal("");
  const [done, setDone] = createSignal(false);

  const [data, setData] = createSignal<AssessmentState>({
    background: { role: "", field: "" },
    businessLiteracy: { revenue: 1, acquisition: 1, economics: 1, margins: 1 },
    aiReadiness: "",
    valueCreation: { hasCreated: false, description: "" },
    mentalModel: 5,
    skills: [],
  });

  const canAdvance = createMemo(() => {
    const s = step();
    const d = data();
    if (s === 1) return d.background.role !== "";
    if (s === 2) return true;
    if (s === 3) return d.aiReadiness !== "";
    if (s === 4) return true;
    if (s === 5) return true;
    if (s === 6) return d.skills.length > 0;
    return true;
  });

  function updateData<K extends keyof AssessmentState>(key: K, value: AssessmentState[K]): void {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function next(): void {
    if (step() < TOTAL_STEPS) setStep((s) => s + 1);
  }

  function prev(): void {
    if (step() > 1) setStep((s) => s - 1);
  }

  async function submit(): Promise<void> {
    setLoading(true);
    setStep(TOTAL_STEPS + 1);

    try {
      const res = await fetch("/api/v1/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data()),
      });

      if (!res.ok) throw new Error("Assessment failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let content = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              content += parsed.text;
              setResult(content);
            }
          } catch {
            // skip
          }
        }
      }
    } catch {
      setResult("Something went wrong generating your assessment. Please try again.");
    } finally {
      setLoading(false);
      setDone(true);
    }
  }

  function restart(): void {
    setStep(1);
    setResult("");
    setDone(false);
    setLoading(false);
    setData({
      background: { role: "", field: "" },
      businessLiteracy: { revenue: 1, acquisition: 1, economics: 1, margins: 1 },
      aiReadiness: "",
      valueCreation: { hasCreated: false, description: "" },
      mentalModel: 5,
      skills: [],
    });
  }

  function toggleSkill(skill: string): void {
    setData((prev) => {
      const has = prev.skills.includes(skill);
      return {
        ...prev,
        skills: has ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill],
      };
    });
  }

  const stepLabels = ["Background", "Business Literacy", "AI Readiness", "Value Creation", "Mental Model", "Skills"];

  return (
    <div class="bg-slate-deep/50 rounded-2xl border border-slate-mid/20 overflow-hidden">
      {/* Progress bar */}
      <Show when={step() <= TOTAL_STEPS}>
        <div class="px-6 pt-6 pb-2">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-medium text-slate-light uppercase tracking-wider">
              Step {step()} of {TOTAL_STEPS}
            </span>
            <span class="text-xs text-slate-light/60">{stepLabels[step() - 1]}</span>
          </div>
          <div class="flex gap-1.5">
            <For each={Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1)}>
              {(n) => (
                <div
                  class={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                    n <= step() ? "bg-ember" : "bg-slate-mid/30"
                  }`}
                />
              )}
            </For>
          </div>
        </div>
      </Show>

      <div class="p-6 md:p-8">
        {/* Step 1: Background */}
        <Show when={step() === 1}>
          <div class="space-y-6">
            <div>
              <h3 class="font-display text-2xl italic mb-2">Tell us about yourself</h3>
              <p class="text-slate-light">Where are you in your journey right now?</p>
            </div>

            <div class="space-y-3">
              <label class="text-sm font-medium text-slate-light">I am a...</label>
              <div class="grid grid-cols-2 gap-2">
                <For each={ROLE_OPTIONS}>
                  {(opt) => (
                    <button
                      type="button"
                      onClick={() => updateData("background", { ...data().background, role: opt.value })}
                      class={`text-left text-sm rounded-xl px-4 py-3 transition-colors border ${
                        data().background.role === opt.value
                          ? "bg-ember text-midnight border-ember font-medium"
                          : "bg-slate-mid/20 text-slate-light hover:bg-slate-mid/40 border-slate-mid/10"
                      }`}
                    >
                      {opt.label}
                    </button>
                  )}
                </For>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-light" for="field-input">
                What's your field or area of interest?
              </label>
              <input
                id="field-input"
                type="text"
                value={data().background.field}
                onInput={(e) => updateData("background", { ...data().background, field: e.currentTarget.value })}
                placeholder="e.g. Computer Science, Marketing, Undecided..."
                class="w-full bg-slate-mid/20 text-ivory placeholder-slate-light/40 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-ember/50 text-[15px]"
              />
            </div>
          </div>
        </Show>

        {/* Step 2: Business Literacy */}
        <Show when={step() === 2}>
          <div class="space-y-6">
            <div>
              <h3 class="font-display text-2xl italic mb-2">Business Literacy</h3>
              <p class="text-slate-light">
                Rate your understanding of how businesses actually work. Be honest -- this helps us
                personalize your results.
              </p>
            </div>

            <div class="space-y-5">
              <LikertScale
                label="How businesses generate revenue"
                value={data().businessLiteracy.revenue}
                onChange={(v) =>
                  updateData("businessLiteracy", { ...data().businessLiteracy, revenue: v })
                }
              />
              <LikertScale
                label="How customers are acquired and retained"
                value={data().businessLiteracy.acquisition}
                onChange={(v) =>
                  updateData("businessLiteracy", { ...data().businessLiteracy, acquisition: v })
                }
              />
              <LikertScale
                label="Unit economics (cost to serve vs. revenue per customer)"
                value={data().businessLiteracy.economics}
                onChange={(v) =>
                  updateData("businessLiteracy", { ...data().businessLiteracy, economics: v })
                }
              />
              <LikertScale
                label="Margins, pricing, and profitability"
                value={data().businessLiteracy.margins}
                onChange={(v) =>
                  updateData("businessLiteracy", { ...data().businessLiteracy, margins: v })
                }
              />
            </div>
          </div>
        </Show>

        {/* Step 3: AI Readiness */}
        <Show when={step() === 3}>
          <div class="space-y-6">
            <div>
              <h3 class="font-display text-2xl italic mb-2">AI Readiness</h3>
              <p class="text-slate-light">How do you currently use AI in your work or life?</p>
            </div>

            <div class="space-y-3">
              <For each={AI_LEVELS}>
                {(level) => (
                  <button
                    type="button"
                    onClick={() => updateData("aiReadiness", level.value)}
                    class={`w-full text-left rounded-xl px-5 py-4 transition-colors border ${
                      data().aiReadiness === level.value
                        ? "bg-ember text-midnight border-ember"
                        : "bg-slate-mid/20 text-ivory hover:bg-slate-mid/40 border-slate-mid/10"
                    }`}
                  >
                    <span class={`font-medium text-sm ${data().aiReadiness === level.value ? "text-midnight" : ""}`}>
                      {level.label}
                    </span>
                    <p
                      class={`text-sm mt-0.5 ${
                        data().aiReadiness === level.value ? "text-midnight/70" : "text-slate-light"
                      }`}
                    >
                      {level.description}
                    </p>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Step 4: Value Creation */}
        <Show when={step() === 4}>
          <div class="space-y-6">
            <div>
              <h3 class="font-display text-2xl italic mb-2">Value Creation Experience</h3>
              <p class="text-slate-light">
                Have you ever created something that someone paid for, used, or benefited from? This
                could be a side project, freelance work, a product, content, or anything else.
              </p>
            </div>

            <div class="flex gap-3">
              <button
                type="button"
                onClick={() => updateData("valueCreation", { ...data().valueCreation, hasCreated: true })}
                class={`flex-1 rounded-xl px-5 py-3.5 font-medium text-sm transition-colors border ${
                  data().valueCreation.hasCreated
                    ? "bg-ember text-midnight border-ember"
                    : "bg-slate-mid/20 text-slate-light hover:bg-slate-mid/40 border-slate-mid/10"
                }`}
              >
                Yes, I have
              </button>
              <button
                type="button"
                onClick={() => updateData("valueCreation", { hasCreated: false, description: "" })}
                class={`flex-1 rounded-xl px-5 py-3.5 font-medium text-sm transition-colors border ${
                  !data().valueCreation.hasCreated
                    ? "bg-slate-mid/50 text-ivory border-slate-mid/30"
                    : "bg-slate-mid/20 text-slate-light hover:bg-slate-mid/40 border-slate-mid/10"
                }`}
              >
                Not yet
              </button>
            </div>

            <Show when={data().valueCreation.hasCreated}>
              <div class="space-y-2">
                <label class="text-sm font-medium text-slate-light" for="value-desc">
                  Tell us about it briefly
                </label>
                <textarea
                  id="value-desc"
                  value={data().valueCreation.description}
                  onInput={(e) =>
                    updateData("valueCreation", {
                      ...data().valueCreation,
                      description: e.currentTarget.value,
                    })
                  }
                  placeholder="e.g. I built a small app, sold designs on Etsy, tutored students, wrote a newsletter..."
                  rows={3}
                  class="w-full bg-slate-mid/20 text-ivory placeholder-slate-light/40 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-ember/50 text-[15px]"
                />
              </div>
            </Show>
          </div>
        </Show>

        {/* Step 5: Mental Model */}
        <Show when={step() === 5}>
          <div class="space-y-8">
            <div>
              <h3 class="font-display text-2xl italic mb-2">Your Mental Model</h3>
              <p class="text-slate-light">
                Where do you fall between these two mindsets? There's no wrong answer.
              </p>
            </div>

            <div class="space-y-6">
              <div class="flex justify-between text-sm">
                <div class="max-w-[45%]">
                  <p class="font-medium text-ivory mb-1">"I need stability"</p>
                  <p class="text-slate-light text-xs">
                    I want a stable job with a good salary, benefits, and predictable income.
                  </p>
                </div>
                <div class="max-w-[45%] text-right">
                  <p class="font-medium text-ember mb-1">"I want to create"</p>
                  <p class="text-slate-light text-xs">
                    I want to create value and capture some of it. I'll figure out stability later.
                  </p>
                </div>
              </div>

              <div class="space-y-3">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={data().mentalModel}
                  onInput={(e) => updateData("mentalModel", parseInt(e.currentTarget.value))}
                  class="w-full accent-ember"
                />
                <div class="flex justify-between text-xs text-slate-light/50">
                  <span>1</span>
                  <span>5</span>
                  <span>10</span>
                </div>
              </div>

              <div class="text-center">
                <span class="inline-block bg-slate-mid/30 text-ivory rounded-full px-4 py-1.5 text-sm">
                  {data().mentalModel <= 3
                    ? "Stability-focused"
                    : data().mentalModel <= 5
                      ? "Balanced / Exploring"
                      : data().mentalModel <= 7
                        ? "Leaning toward creation"
                        : "Creator mindset"}
                </span>
              </div>
            </div>
          </div>
        </Show>

        {/* Step 6: Skills */}
        <Show when={step() === 6}>
          <div class="space-y-6">
            <div>
              <h3 class="font-display text-2xl italic mb-2">Skills Inventory</h3>
              <p class="text-slate-light">
                Select all the skills you currently have (even at a basic level). This helps us
                identify your leverage points.
              </p>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <For each={SKILLS_LIST}>
                {(skill) => {
                  const selected = createMemo(() => data().skills.includes(skill));
                  return (
                    <button
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      class={`text-left text-sm rounded-xl px-4 py-3 transition-colors border ${
                        selected()
                          ? "bg-ember text-midnight border-ember font-medium"
                          : "bg-slate-mid/20 text-slate-light hover:bg-slate-mid/40 border-slate-mid/10"
                      }`}
                    >
                      <span class="flex items-center gap-2">
                        <Show when={selected()} fallback={<span class="w-4 h-4 rounded border border-slate-mid/40 flex-shrink-0" />}>
                          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </Show>
                        {skill}
                      </span>
                    </button>
                  );
                }}
              </For>
            </div>

            <Show when={data().skills.length > 0}>
              <p class="text-xs text-slate-light/60 text-center">
                {data().skills.length} skill{data().skills.length !== 1 ? "s" : ""} selected
              </p>
            </Show>
          </div>
        </Show>

        {/* Results */}
        <Show when={step() > TOTAL_STEPS}>
          <div class="space-y-6">
            <div>
              <h3 class="font-display text-2xl italic mb-2">Your Assessment</h3>
              <p class="text-slate-light">
                Personalized analysis based on your responses.
              </p>
            </div>

            <Show when={loading() && !result()}>
              <div class="flex items-center justify-center py-12">
                <div class="flex flex-col items-center gap-4">
                  <div class="w-12 h-12 rounded-full border-2 border-ember border-t-transparent animate-spin" />
                  <p class="text-sm text-slate-light">Analyzing your responses...</p>
                </div>
              </div>
            </Show>

            <Show when={result()}>
              <div
                class="md-content text-[15px] leading-relaxed bg-slate-mid/20 rounded-xl p-6 border border-slate-mid/10"
                innerHTML={renderMarkdown(result())}
              />
            </Show>

            <Show when={done()}>
              <div class="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={restart}
                  class="flex-1 bg-slate-mid/30 text-ivory rounded-xl px-5 py-3 text-sm font-medium hover:bg-slate-mid/50 transition-colors"
                >
                  Retake Assessment
                </button>
                <a
                  href="/#coach"
                  class="flex-1 bg-ember text-midnight rounded-xl px-5 py-3 text-sm font-medium hover:bg-ember-light transition-colors text-center"
                >
                  Talk to the Coach
                </a>
              </div>
            </Show>
          </div>
        </Show>

        {/* Navigation */}
        <Show when={step() <= TOTAL_STEPS}>
          <div class="flex justify-between items-center mt-8 pt-6 border-t border-slate-mid/20">
            <Show
              when={step() > 1}
              fallback={<div />}
            >
              <button
                type="button"
                onClick={prev}
                class="text-sm text-slate-light hover:text-ivory transition-colors flex items-center gap-1.5"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            </Show>

            <Show
              when={step() < TOTAL_STEPS}
              fallback={
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canAdvance() || loading()}
                  class="bg-ember text-midnight font-semibold rounded-xl px-6 py-3 text-sm hover:bg-ember-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Get My Assessment
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              }
            >
              <button
                type="button"
                onClick={next}
                disabled={!canAdvance()}
                class="bg-ember text-midnight font-semibold rounded-xl px-6 py-3 text-sm hover:bg-ember-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Continue
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
