const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (cents: number) => brl.format(cents / 100);
/** valor para campo editável: 1250050 → "12.500,50" */
export const moneyInput = (cents: number) => (cents ? brl2.format(cents / 100) : "");

const TZ = "America/Sao_Paulo";

export function when(iso: string, nowMs = Date.now()) {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString("pt-BR", { timeZone: TZ });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  const today = new Date(nowMs);
  const yesterday = new Date(nowMs - 864e5);
  const tomorrow = new Date(nowMs + 864e5);
  if (day(d) === day(today)) return `Hoje ${time}`;
  if (day(d) === day(yesterday)) return `Ontem ${time}`;
  if (day(d) === day(tomorrow)) return `Amanhã ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: TZ }).replace(".", "")} ${time}`;
}

export const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

export function dayLabel(iso: string, nowMs = Date.now()) {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString("pt-BR", { timeZone: TZ });
  if (day(d) === day(new Date(nowMs))) return "Hoje";
  if (day(d) === day(new Date(nowMs - 864e5))) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: TZ });
}

export const leadTitle = (l: { name: string; number: number }) => l.name.trim() || `Lead #${l.number}`;

export function phone(v: string) {
  const m = v.match(/^\+55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : v;
}
