import { createSignal, createMemo, For, Show } from "solid-js";
import { renderMarkdown } from "../lib/markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTER_PROMPTS = [
  "How do businesses actually make money?",
  "I just graduated — how do I create value instead of just job hunting?",
  "How can I use AI as leverage in my career?",
  "What skills actually matter in an AI economy?",
];

export default function Chat() {
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [input, setInput] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  let messagesEndRef: HTMLDivElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;

  function scrollToBottom(): void {
    messagesEndRef?.scrollIntoView({ behavior: "smooth" });
  }

  function resizeTextarea(): void {
    if (!textareaRef) return;
    textareaRef.style.height = "auto";
    textareaRef.style.height = Math.min(textareaRef.scrollHeight, 160) + "px";
  }

  async function sendMessage(text?: string): Promise<void> {
    const content = text ?? input().trim();
    if (!content || loading()) return;

    setInput("");
    if (textareaRef) textareaRef.style.height = "auto";

    const userMsg: Message = { role: "user", content };
    setMessages((prev) => [...prev, userMsg]);

    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/v1/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages(), userMsg] }),
      });

      if (!res.ok) throw new Error("Coach unavailable");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

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
              assistantContent += parsed.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
              scrollToBottom();
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm having trouble connecting right now. Please try again." },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div class="bg-slate-deep/50 rounded-2xl border border-slate-mid/20 overflow-hidden flex flex-col" style="height: 600px">
      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <Show when={messages().length === 0}>
          <div class="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div class="w-14 h-14 rounded-full bg-ember/10 flex items-center justify-center">
              <svg class="w-7 h-7 text-ember" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            </div>
            <div>
              <p class="text-ivory font-medium mb-1">What do you want to understand?</p>
              <p class="text-sm text-slate-light">Ask about business, value creation, AI, or your career path.</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              <For each={STARTER_PROMPTS}>
                {(prompt) => (
                  <button
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    class="text-left text-sm text-slate-light hover:text-ivory bg-slate-mid/20 hover:bg-slate-mid/40 rounded-xl px-4 py-3 transition-colors border border-slate-mid/10"
                  >
                    {prompt}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        <For each={messages()}>
          {(msg) => (
            <div class={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                class={`max-w-[85%] rounded-2xl px-5 py-3.5 ${
                  msg.role === "user"
                    ? "bg-ember text-midnight"
                    : "bg-slate-mid/30 text-ivory"
                }`}
              >
                {msg.role === "user" ? (
                  <p class="whitespace-pre-wrap leading-relaxed text-[15px]">{msg.content}</p>
                ) : (
                  <div class="md-content text-[15px] leading-relaxed" innerHTML={renderMarkdown(msg.content)} />
                )}
              </div>
            </div>
          )}
        </For>

        <Show when={loading() && messages().length > 0 && messages()[messages().length - 1]?.role === "user"}>
          <div class="flex justify-start">
            <div class="bg-slate-mid/30 rounded-2xl px-5 py-3.5">
              <div class="flex gap-1.5">
                <div class="w-2 h-2 bg-slate-light/40 rounded-full animate-bounce" style="animation-delay: 0ms" />
                <div class="w-2 h-2 bg-slate-light/40 rounded-full animate-bounce" style="animation-delay: 150ms" />
                <div class="w-2 h-2 bg-slate-light/40 rounded-full animate-bounce" style="animation-delay: 300ms" />
              </div>
            </div>
          </div>
        </Show>

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div class="border-t border-slate-mid/20 p-4">
        <div class="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input()}
            onInput={(e) => {
              setInput(e.currentTarget.value);
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about value creation, business, AI leverage..."
            rows={1}
            class="flex-1 bg-slate-mid/20 text-ivory placeholder-slate-light/40 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-ember/50 text-[15px]"
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={loading() || !input().trim()}
            class="bg-ember text-midnight rounded-xl p-3 hover:bg-ember-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
