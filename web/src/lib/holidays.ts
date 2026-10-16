/* Feriados nacionais do Brasil (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023) e datas móveis da Páscoa.
   "facultativo" = ponto facultativo nacional (Carnaval, Quarta de Cinzas até 14h, Corpus Christi). */

export type Holiday = { date: string; name: string; kind: "nacional" | "facultativo" };

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano) */
function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const plus = (d: Date, days: number) => new Date(d.getTime() + days * 864e5);

export function holidays(year: number): Holiday[] {
  const p = easter(year);
  const fixed: [string, string][] = [
    ["01-01", "Confraternização Universal"],
    ["04-21", "Tiradentes"],
    ["05-01", "Dia do Trabalho"],
    ["09-07", "Independência do Brasil"],
    ["10-12", "Nossa Senhora Aparecida"],
    ["11-02", "Finados"],
    ["11-15", "Proclamação da República"],
    ["11-20", "Dia da Consciência Negra"],
    ["12-25", "Natal"],
  ];
  return [
    ...fixed.map(([md, name]) => ({ date: `${year}-${md}`, name, kind: "nacional" as const })),
    { date: ymd(plus(p, -48)), name: "Carnaval", kind: "facultativo" as const },
    { date: ymd(plus(p, -47)), name: "Carnaval", kind: "facultativo" as const },
    { date: ymd(plus(p, -46)), name: "Quarta-feira de Cinzas", kind: "facultativo" as const },
    { date: ymd(plus(p, -2)), name: "Sexta-feira Santa", kind: "nacional" as const },
    { date: ymd(p), name: "Páscoa", kind: "facultativo" as const },
    { date: ymd(plus(p, 60)), name: "Corpus Christi", kind: "facultativo" as const },
  ].sort((a, b) => a.date.localeCompare(b.date));
}

/** mapa "AAAA-MM-DD" → feriado, para os anos pedidos */
export function holidayMap(years: number[]) {
  const m = new Map<string, Holiday>();
  for (const y of new Set(years)) for (const h of holidays(y)) m.set(h.date, h);
  return m;
}
