import { createSignal, onMount } from "solid-js";

export default function ThemeToggle() {
  const [light, setLight] = createSignal(false);

  onMount(() => {
    const stored = localStorage.getItem("praxis-theme");
    if (stored === "light") {
      document.documentElement.classList.add("light");
      setLight(true);
    }
  });

  function toggle(): void {
    const next = !light();
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    localStorage.setItem("praxis-theme", next ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light() ? "Switch to dark mode" : "Switch to light mode"}
      class="w-9 h-9 flex items-center justify-center rounded-full border border-slate-mid/20 text-slate-light hover:text-ivory transition-colors"
    >
      {light() ? (
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
    </button>
  );
}
