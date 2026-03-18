import { createSignal, For, Show } from "solid-js";

interface Link {
  href: string;
  label: string;
  active: boolean;
}

interface LinkGroup {
  links: Link[];
}

interface UserInfo {
  id: string;
  email: string;
}

export default function MobileMenu(props: { groups: LinkGroup[]; user?: UserInfo }) {
  const [open, setOpen] = createSignal(false);

  return (
    <div class="relative">
      <button
        type="button"
        onClick={() => setOpen(!open())}
        aria-label={open() ? "Close menu" : "Open menu"}
        aria-expanded={open()}
        class="w-9 h-9 flex items-center justify-center rounded-full border border-slate-mid/20 text-slate-light hover:text-ivory transition-colors"
      >
        <Show
          when={!open()}
          fallback={
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          }
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Show>
      </button>

      <Show when={open()}>
        <div class="absolute right-0 top-12 w-56 rounded-xl border border-slate-mid/20 bg-[var(--bg-primary)] shadow-lg py-2 z-50">
          <For each={props.groups}>
            {(group, i) => (
              <>
                <Show when={i() > 0}>
                  <div class="border-t border-slate-mid/20 my-1" />
                </Show>
                <For each={group.links}>
                  {(link) => (
                    <a
                      href={link.href}
                      class={`block px-5 py-2.5 text-sm transition-colors ${
                        link.active
                          ? "text-ember font-semibold"
                          : "text-slate-light hover:text-ivory"
                      }`}
                    >
                      {link.label}
                    </a>
                  )}
                </For>
              </>
            )}
          </For>
          <div class="border-t border-slate-mid/20 my-1" />
          <Show
            when={props.user}
            fallback={
              <a href="/login" class="block px-5 py-2.5 text-sm text-slate-light hover:text-ivory transition-colors">
                Login
              </a>
            }
          >
            <form method="POST" action="/api/v1/auth/logout">
              <button type="submit" class="block w-full text-left px-5 py-2.5 text-sm text-slate-light hover:text-ivory transition-colors">
                Logout
              </button>
            </form>
          </Show>
        </div>
      </Show>
    </div>
  );
}
