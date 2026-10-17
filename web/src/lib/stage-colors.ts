import type { StageColor } from "@/data/types";

/** cor de cada etapa (classe do Tailwind). Fica fora dos componentes de navegador para servir também às telas do servidor. */
export const stageBar: Record<StageColor, string> = {
  "1": "bg-stage-1",
  "2": "bg-stage-2",
  "3": "bg-stage-3",
  "4": "bg-stage-4",
  "5": "bg-stage-5",
  "6": "bg-stage-6",
  "7": "bg-stage-7",
  "8": "bg-stage-8",
  won: "bg-stage-won",
  lost: "bg-stage-lost",
};
