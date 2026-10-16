import { PointerSensor, TouchSensor } from "@dnd-kit/core";
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from "react";

/* Sensores para arrastar o cartão inteiro, de qualquer ponto.
   Exceção: começar o gesto num campo, lista ou botão não arrasta (para digitar, selecionar texto e clicar normalmente).
   A alça [data-drag-handle] sempre arrasta. */

const NO_DRAG = "input, textarea, select, option, button, [contenteditable], [data-no-drag]";

function canDrag(target: EventTarget | null) {
  const el = target instanceof Element ? target : null;
  if (!el) return true;
  if (el.closest("[data-drag-handle]")) return true;
  return !el.closest(NO_DRAG);
}

export class CardPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: e }: ReactPointerEvent) => e.isPrimary && e.button === 0 && canDrag(e.target),
    },
  ];
}

export class CardTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: ({ nativeEvent: e }: ReactTouchEvent) => e.touches.length <= 1 && canDrag(e.target),
    },
  ];
}

/* Depois de soltar um cartão, o navegador ainda dispara o clique: sem isto, arrastar abriria o lead. */
let lastDragEnd = 0;
export const markDragEnd = () => {
  lastDragEnd = Date.now();
};
export const swallowClickAfterDrag = (e: { preventDefault(): void; stopPropagation(): void }) => {
  if (Date.now() - lastDragEnd < 250) {
    e.preventDefault();
    e.stopPropagation();
  }
};
