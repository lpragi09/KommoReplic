/* Tema claro/escuro por pessoa, guardado no navegador. O padrão continua claro.
   O script em THEME_SCRIPT roda antes da página pintar (layout raiz), para não piscar branco no modo escuro. */

export type ThemePref = "claro" | "escuro" | "auto";
export const THEME_KEY = "netzer-tema";

export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="escuro"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}`;
