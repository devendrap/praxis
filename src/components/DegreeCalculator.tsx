import { createSignal, For, Show } from "solid-js";
import { renderMarkdown } from "../lib/markdown";

const DEGREE_TYPES = [
  "Associate's",
  "Bachelor's",
  "Master's",
  "PhD",
  "Bootcamp",
  "Self-taught",
];

const INSTITUTION_TYPES = [
  "Ivy/Elite",
  "Top 50",
  "State University",
  "Community College",
  "Online",
];

const AI_EXPOSURE_LEVELS = [
  "None",
  "I've used ChatGPT",
  "I use AI daily",
  "I build with AI",
];

const SKILLS = [
  "Coding",
  "Writing",
  "Data Analysis",
  "Design",
  "Sales",
  "Marketing",
  "Leadership",
  "Research",
  "Public Speaking",
  "Financial Literacy",
];

export default function DegreeCalculator() {
  const [degreeType, setDegreeType] = createSignal(DEGREE_TYPES[1]);
  const [fieldOfStudy, setFieldOfStudy] = createSignal("");
  const [institutionType, setInstitutionType] = createSignal(INSTITUTION_TYPES[2]);
  const [totalCost, setTotalCost] = createSignal("");
  const [yearsRemaining, setYearsRemaining] = createSignal("");
  const [currentSkills, setCurrentSkills] = createSignal<string[]>([]);
  const [careerGoal, setCareerGoal] = createSignal("");
  const [aiExposure, setAiExposure] = createSignal(AI_EXPOSURE_LEVELS[0]);

  const [loading, setLoading] = createSignal(false);
  const [result, setResult] = createSignal("");
  const [error, setError] = createSignal("");

  function toggleSkill(skill: string): void {
    setCurrentSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  async function handleSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (loading()) return;

    if (!fieldOfStudy().trim() || !careerGoal().trim()) {
      setError("Please fill in your field of study and career goal.");
      return;
    }

    setError("");
    setResult("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/degree-value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          degreeType: degreeType(),
          fieldOfStudy: fieldOfStudy().trim(),
          institutionType: institutionType(),
          totalCost: Number(totalCost()) || 0,
          yearsRemaining: Number(yearsRemaining()) || 0,
          currentSkills: currentSkills(),
          careerGoal: careerGoal().trim(),
          aiExposure: aiExposure(),
        }),
      });

      if (!res.ok) throw new Error("Analysis unavailable");

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
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const labelClass = "block text-sm font-medium text-slate-light mb-1.5";
  const inputClass =
    "w-full bg-slate-mid/20 text-ivory placeholder-slate-light/40 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-ember/50 text-[15px] border border-slate-mid/20";
  const selectClass =
    "w-full bg-slate-mid/20 text-ivory rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-ember/50 text-[15px] border border-slate-mid/20 appearance-none";

  return (
    <div class="space-y-10">
      {/* Form */}
      <form onSubmit={handleSubmit} class="bg-slate-deep/50 rounded-2xl border border-slate-mid/20 p-6 md:p-8 space-y-6">
        <div class="grid md:grid-cols-2 gap-6">
          {/* Degree type */}
          <div>
            <label class={labelClass}>Degree Type</label>
            <select
              value={degreeType()}
              onChange={(e) => setDegreeType(e.currentTarget.value)}
              class={selectClass}
            >
              <For each={DEGREE_TYPES}>
                {(type) => <option value={type}>{type}</option>}
              </For>
            </select>
          </div>

          {/* Field of study */}
          <div>
            <label class={labelClass}>Field of Study</label>
            <input
              type="text"
              value={fieldOfStudy()}
              onInput={(e) => setFieldOfStudy(e.currentTarget.value)}
              placeholder="e.g., Computer Science, English Literature"
              class={inputClass}
            />
          </div>

          {/* Institution type */}
          <div>
            <label class={labelClass}>Institution Type</label>
            <select
              value={institutionType()}
              onChange={(e) => setInstitutionType(e.currentTarget.value)}
              class={selectClass}
            >
              <For each={INSTITUTION_TYPES}>
                {(type) => <option value={type}>{type}</option>}
              </For>
            </select>
          </div>

          {/* Total cost */}
          <div>
            <label class={labelClass}>Total Cost (tuition + living)</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-light/60 text-[15px]">$</span>
              <input
                type="number"
                value={totalCost()}
                onInput={(e) => setTotalCost(e.currentTarget.value)}
                placeholder="120000"
                min="0"
                class={`${inputClass} pl-8`}
              />
            </div>
          </div>

          {/* Years remaining */}
          <div>
            <label class={labelClass}>Years Remaining</label>
            <input
              type="number"
              value={yearsRemaining()}
              onInput={(e) => setYearsRemaining(e.currentTarget.value)}
              placeholder="0 if graduated"
              min="0"
              max="12"
              class={inputClass}
            />
          </div>

          {/* AI Exposure */}
          <div>
            <label class={labelClass}>AI Exposure</label>
            <select
              value={aiExposure()}
              onChange={(e) => setAiExposure(e.currentTarget.value)}
              class={selectClass}
            >
              <For each={AI_EXPOSURE_LEVELS}>
                {(level) => <option value={level}>{level}</option>}
              </For>
            </select>
          </div>
        </div>

        {/* Career goal - full width */}
        <div>
          <label class={labelClass}>Career Goal</label>
          <input
            type="text"
            value={careerGoal()}
            onInput={(e) => setCareerGoal(e.currentTarget.value)}
            placeholder="What do you want to do? e.g., Build AI products, become a data scientist"
            class={inputClass}
          />
        </div>

        {/* Current skills */}
        <div>
          <label class={labelClass}>Current Skills</label>
          <div class="flex flex-wrap gap-2">
            <For each={SKILLS}>
              {(skill) => (
                <button
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  class={`text-sm px-4 py-2 rounded-full border transition-colors ${
                    currentSkills().includes(skill)
                      ? "bg-ember text-midnight border-ember font-medium"
                      : "bg-slate-mid/20 text-slate-light border-slate-mid/30 hover:border-slate-light/40"
                  }`}
                >
                  {skill}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Error */}
        <Show when={error()}>
          <p class="text-red-400 text-sm">{error()}</p>
        </Show>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading()}
          class="w-full bg-ember text-midnight font-semibold px-8 py-3.5 rounded-full hover:bg-ember-light transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <Show
            when={!loading()}
            fallback={
              <>
                <div class="w-5 h-5 border-2 border-midnight/30 border-t-midnight rounded-full animate-spin" />
                Analyzing...
              </>
            }
          >
            Calculate Degree Value
          </Show>
        </button>
      </form>

      {/* Results */}
      <Show when={result()}>
        <div class="bg-slate-deep/50 rounded-2xl border border-slate-mid/20 p-6 md:p-8">
          <h3 class="font-display text-2xl italic text-ember mb-6">Your Analysis</h3>
          <div class="md-content text-[15px] leading-relaxed text-ivory" innerHTML={renderMarkdown(result())} />
        </div>
      </Show>
    </div>
  );
}
