"use client";

import { useState } from "react";
import { Popover } from "radix-ui";
import { Smile } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/* Seletor de emoji sem biblioteca: os mais usados em atendimento e vendas, por grupo.
   Insere onde está o cursor (ou no fim) e devolve o foco para o campo. */

const GROUPS: { name: string; list: string[] }[] = [
  { name: "Rostos", list: "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😎 🤩 🥳 🤗 🤔 🤨 😐 😶 🙄 😏 😬 😌 😴 😷 🤒 🤯 😮 😲 😳 🥺 😢 😭 😤 😡 🤝".split(" ") },
  { name: "Gestos", list: "👍 👎 👌 ✌️ 🤞 🤙 👏 🙌 👐 🙏 💪 👋 ✋ 👀 🫶 ☝️ 👉 👈 👇 👆".split(" ") },
  { name: "Corações", list: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💖 💕 💯 ✨ ⭐ 🌟 🔥 🎉 🎊 🎁 🏆 🥇".split(" ") },
  { name: "Negócios", list: "✅ ☑️ ❌ ⚠️ ❗ ❓ 📌 📍 📅 🗓️ ⏰ ⏳ 📞 📱 💬 📩 📧 📎 📄 📝 💰 💵 💳 🧾 📈 📉 🛒 📦 🚚 🏠 🏢 🔑 🔒 🔔 💡 🚀 🎯 🤖".split(" ") },
  { name: "Natureza", list: "☀️ 🌤️ 🌧️ ❄️ 🌈 🌱 🌿 🍀 🌸 🌻 🍎 🍕 🍔 ☕ 🍰 🍾 🥂 🐶 🐱 🦋".split(" ") },
];

/** coloca o emoji na posição do cursor de um input/textarea e devolve o texto novo */
export function insertAt(el: HTMLInputElement | HTMLTextAreaElement | null, value: string, emoji: string) {
  if (!el) return value + emoji;
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = value.slice(0, start) + emoji + value.slice(end);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + emoji.length;
    el.setSelectionRange(pos, pos);
  });
  return next;
}

export function EmojiButton({ onPick, disabled, className, side = "top" }: { onPick: (emoji: string) => void; disabled?: boolean; className?: string; side?: "top" | "bottom" }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Inserir emoji"
          title="Emoji"
          disabled={disabled}
          className={cn("grid size-8 shrink-0 place-items-center rounded-sm text-muted hover:bg-surface hover:text-fg disabled:opacity-40", className)}
        >
          <Smile className="size-5" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align="start"
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-50 w-[min(320px,calc(100vw-24px))] rounded-lg bg-bg p-2 shadow-[0_0_0_1px_var(--border),0_18px_40px_-16px_rgba(20,28,24,.45)]"
        >
          <div className="max-h-64 overflow-y-auto" role="group" aria-label="Emojis">
            {GROUPS.map((g) => (
              <section key={g.name} aria-label={g.name} className="mb-1.5">
                <p className="sticky top-0 bg-bg px-1 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">{g.name}</p>
                <div className="grid grid-cols-8 gap-0.5">
                  {g.list.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        onPick(e);
                        setOpen(false);
                      }}
                      className="grid size-9 place-items-center rounded-sm text-xl hover:bg-surface"
                      aria-label={`Emoji ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
