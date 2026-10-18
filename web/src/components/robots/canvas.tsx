"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { DropdownMenu } from "radix-ui";
import type { RobotStep, RobotStepType } from "@/data/types";
import { IconButton } from "@/components/ui/button";
import { ArrowsOut, Lightning, Minus, Plus, Trash2, Workflow, X } from "@/components/ui/icons";
import { STEP_TYPES, newStep } from "@/lib/robot-meta";
import { cn } from "@/lib/cn";
import { StepBadge } from "./parts";
import { StepBody, type StepCtx } from "./step-fields";

/* Quadro do robô, como o Salesbot: plano infinito com pontinhos.
   - arrasta o fundo para navegar; Ctrl/⌘ + roda (ou os botões) para zoom; roda sozinha também navega
   - arrasta qualquer caixa pelo corpo (campos e botões continuam clicáveis)
   - puxa da bolinha de saída até outra caixa para ligar; soltar no vazio abre o menu e cria o passo ali
   - passa o mouse numa linha e clica no × para desligar */

export type Start = { x: number; y: number; next: string | null };
type Pt = { x: number; y: number };
type PortPt = Pt & { dir: "down" | "right" | "in" };
const NODE_W = 340;
const START_ID = "__start";

// ---------------------------------------------------------------------------
// ligações: cada passo tem saídas ("handles") que apontam para outro passo
// ---------------------------------------------------------------------------
export function handlesOf(s: RobotStep): string[] {
  switch (s.type) {
    case "message":
      return s.buttons?.length ? [...s.buttons.map((b) => b.id), "else"] : ["main"];
    case "condition":
      return [...s.rules.map((r) => r.id), "else"];
    case "wait_reply":
      return ["main", "timeout"];
    case "validate":
      return ["main", "fail"];
    case "stop":
    case "start_robot":
      return [];
    default:
      return ["main"];
  }
}
export function targetOf(s: RobotStep, h: string): string | null {
  if (h === "main") return s.next ?? null;
  if (h === "else") return (s.type === "message" || s.type === "condition" ? s.elseNext : null) ?? null;
  if (h === "timeout") return (s.type === "wait_reply" ? s.timeoutNext : null) ?? null;
  if (h === "fail") return (s.type === "validate" ? s.failNext : null) ?? null;
  if (s.type === "message") return s.buttons?.find((b) => b.id === h)?.next ?? null;
  if (s.type === "condition") return s.rules.find((r) => r.id === h)?.next ?? null;
  return null;
}
export function connect(s: RobotStep, h: string, to: string | null): RobotStep {
  if (h === "main") return { ...s, next: to };
  if (h === "else" && (s.type === "message" || s.type === "condition")) return { ...s, elseNext: to };
  if (h === "timeout" && s.type === "wait_reply") return { ...s, timeoutNext: to };
  if (h === "fail" && s.type === "validate") return { ...s, failNext: to };
  if (s.type === "message") return { ...s, buttons: s.buttons?.map((b) => (b.id === h ? { ...b, next: to } : b)) };
  if (s.type === "condition") return { ...s, rules: s.rules.map((r) => (r.id === h ? { ...r, next: to } : r)) };
  return s;
}
/** robô antigo (lista em linha reta, sem posições): liga em sequência e espalha no quadro */
export function normalizeFlow(steps: RobotStep[], start?: Partial<Start>): { steps: RobotStep[]; start: Start } {
  const linked = steps.map((s, i) => (s.next === undefined ? { ...s, next: steps[i + 1]?.id ?? null } : s));
  const st: Start = { x: start?.x ?? 60, y: start?.y ?? 80, next: start?.next !== undefined ? (start.next ?? null) : (steps[0]?.id ?? null) };
  const needLayout = linked.some((s) => s.x === undefined || s.y === undefined);
  return needLayout ? { steps: autoLayout(linked, st, {}), start: st } : { steps: linked, start: st };
}
/** organiza de cima para baixo: cada passo abaixo de quem leva até ele; caminhos alternativos ficam ao lado */
export function autoLayout(steps: RobotStep[], start: Start, heights: Record<string, number>): RobotStep[] {
  const pos = new Map<string, { col: number; row: number }>();
  const rowsUsed = new Map<number, number>(); // próxima linha livre em cada coluna
  const place = (id: string | null, col: number, row: number) => {
    if (!id || pos.has(id)) return;
    let c = col;
    while ((rowsUsed.get(c) ?? 0) > row) c++; // coluna ocupada nessa altura: desloca para a direita
    pos.set(id, { col: c, row });
    rowsUsed.set(c, row + 1);
    const s = steps.find((x) => x.id === id);
    if (!s) return;
    handlesOf(s).forEach((h, i) => place(targetOf(s, h), c + i, row + 1));
  };
  place(start.next, 0, 0);
  let extra = Math.max(0, ...[...pos.values()].map((p) => p.col)) + 1;
  for (const s of steps) if (!pos.has(s.id)) pos.set(s.id, { col: extra++, row: 0 }); // soltos: à direita
  // altura de cada linha = maior caixa da linha
  const rowH = new Map<number, number>();
  for (const s of steps) {
    const p = pos.get(s.id)!;
    rowH.set(p.row, Math.max(rowH.get(p.row) ?? 0, heights[s.id] ?? 260));
  }
  const rowY = (row: number) => {
    let y = start.y + 110;
    for (let r = 0; r < row; r++) y += (rowH.get(r) ?? 260) + 70;
    return y;
  };
  return steps.map((s) => {
    const p = pos.get(s.id)!;
    return { ...s, x: start.x + p.col * (NODE_W + 90), y: rowY(p.row) };
  });
}

// ---------------------------------------------------------------------------
// fios que contornam as caixas: caminho em ângulos retos (com cantos redondos) que nunca passa por dentro de uma caixa
// ---------------------------------------------------------------------------
type Rect = { l: number; t: number; r: number; b: number };
const GAP = 22; // folga entre o fio e a caixa
const BEND = 60; // custo de cada curva: prefere caminhos com poucas dobras

export function overlaps(rects: Rect[]) {
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const c = rects[j];
      if (a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b) return true;
    }
  return false;
}

/** pontos do caminho de a (saída) até b (entrada no topo da caixa), desviando de `rects` */
export function routeEdge(a: PortPt, b: Pt, rects: Rect[]): Pt[] | null {
  const inflated = rects.map((r) => ({ l: r.l - GAP, t: r.t - GAP, r: r.r + GAP, b: r.b + GAP }));
  const inside = (x: number, y: number) => inflated.some((r) => x > r.l + 0.5 && x < r.r - 0.5 && y > r.t + 0.5 && y < r.b - 0.5);
  a = { ...a, x: Math.round(a.x), y: Math.round(a.y) };
  b = { x: Math.round(b.x), y: Math.round(b.y) };
  const sa = a.dir === "down" ? { x: a.x, y: a.y + GAP + 4 } : { x: a.x + GAP + 4, y: a.y };
  const sb = { x: b.x, y: b.y - GAP - 4 };
  if (inside(sa.x, sa.y) || inside(sb.x, sb.y)) return null;

  // grade esparsa: bordas das caixas (com folga), as pontas e o meio entre elas
  const axis = (vals: number[]) => {
    const u = [...new Set(vals.map((v) => Math.round(v)))].sort((p, q) => p - q);
    const out: number[] = [];
    u.forEach((v, i) => {
      out.push(v);
      if (i < u.length - 1 && u[i + 1] - v > 8) out.push(Math.round((v + u[i + 1]) / 2));
    });
    return out;
  };
  const xs = axis([sa.x, sb.x, ...inflated.flatMap((r) => [r.l, r.r])]);
  const ys = axis([sa.y, sb.y, ...inflated.flatMap((r) => [r.t, r.b])]);
  const W = xs.length;
  const H = ys.length;
  const xi = xs.indexOf(Math.round(sa.x));
  const yi = ys.indexOf(Math.round(sa.y));
  const xj = xs.indexOf(Math.round(sb.x));
  const yj = ys.indexOf(Math.round(sb.y));
  if (xi < 0 || yi < 0 || xj < 0 || yj < 0) return null;

  // A* com direção no estado (0 horizontal, 1 vertical) para cobrar as curvas
  const key = (x: number, y: number, d: number) => (y * W + x) * 2 + d;
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const heap: [number, number, number][] = []; // [f, g, key]
  const push = (f: number, g: number, k: number) => {
    heap.push([f, g, k]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const h = (x: number, y: number) => Math.abs(xs[x] - xs[xj]) + Math.abs(ys[y] - ys[yj]);
  const d0 = a.dir === "down" ? 1 : 0;
  const k0 = key(xi, yi, d0);
  dist.set(k0, 0);
  push(h(xi, yi), 0, k0);
  let goal = -1;
  let guard = 0;
  while (heap.length && guard++ < 60000) {
    const [, g, k] = pop();
    if (g > (dist.get(k) ?? Infinity)) continue;
    const d = k % 2;
    const cell = (k - d) / 2;
    const x = cell % W;
    const y = (cell - x) / W;
    if (x === xj && y === yj) {
      goal = k;
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (inside(xs[nx], ys[ny]) || inside((xs[x] + xs[nx]) / 2, (ys[y] + ys[ny]) / 2)) continue;
      const nd = dy !== 0 ? 1 : 0;
      // chegar na entrada vindo de lado obriga mais uma curva
      const ng = g + Math.abs(xs[nx] - xs[x]) + Math.abs(ys[ny] - ys[y]) + (nd !== d ? BEND : 0) + (nx === xj && ny === yj && nd === 0 ? BEND : 0);
      const nk = key(nx, ny, nd);
      if (ng < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, ng);
        prev.set(nk, k);
        push(ng + h(nx, ny), ng, nk);
      }
    }
  }
  if (goal < 0) return null;
  const pts: Pt[] = [];
  for (let k: number | undefined = goal; k !== undefined; k = prev.get(k)) {
    const cell = (k - (k % 2)) / 2;
    pts.push({ x: xs[cell % W], y: ys[Math.floor(cell / W)] });
  }
  pts.reverse();
  const all = [{ x: a.x, y: a.y }, ...pts, { x: b.x, y: b.y }];
  // tira pontos no meio de retas
  return all.filter((p, i) => {
    if (i === 0 || i === all.length - 1) return true;
    const p0 = all[i - 1];
    const p1 = all[i + 1];
    return !((p0.x === p.x && p.x === p1.x) || (p0.y === p.y && p.y === p1.y));
  });
}

/** linha com cantos arredondados */
export function roundedPath(pts: Pt[], radius = 14) {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p = pts[i];
    const p1 = pts[i + 1];
    const r = Math.min(radius, Math.hypot(p.x - p0.x, p.y - p0.y) / 2, Math.hypot(p1.x - p.x, p1.y - p.y) / 2);
    const ux = Math.sign(p.x - p0.x);
    const uy = Math.sign(p.y - p0.y);
    const vx = Math.sign(p1.x - p.x);
    const vy = Math.sign(p1.y - p.y);
    d += ` L ${p.x - ux * r} ${p.y - uy * r} Q ${p.x} ${p.y} ${p.x + vx * r} ${p.y + vy * r}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

/** ponto no meio do comprimento do caminho (onde fica o botão de desligar) */
function midpoint(pts: Pt[]): Pt {
  const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let half = segs.reduce((s, x) => s + x, 0) / 2;
  for (let i = 0; i < segs.length; i++) {
    if (half <= segs[i]) {
      const t = segs[i] ? half / segs[i] : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
    }
    half -= segs[i];
  }
  return pts[pts.length - 1];
}

// ---------------------------------------------------------------------------
// quadro
// ---------------------------------------------------------------------------
type Drag =
  | { kind: "pan"; from: Pt; pan: Pt }
  | { kind: "node"; id: string; from: Pt; pos: Pt }
  | { kind: "wire"; from: string; handle: string; at: Pt };

export function FlowCanvas({
  steps,
  start,
  onChange,
  triggerText,
  ctx,
}: {
  steps: RobotStep[];
  start: Start;
  onChange: (steps: RobotStep[], start: Start) => void;
  triggerText: string;
  ctx: StepCtx;
}) {
  const box = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<Pt>({ x: 40, y: 20 });
  const [zoom, setZoom] = useState(0.9);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [ports, setPorts] = useState<Record<string, PortPt>>({});
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [menu, setMenu] = useState<{ at: Pt; screen: Pt; from?: string; handle?: string } | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  /* fio selecionado com um clique: fica vermelho e mostra "Desligar" onde foi clicado (Delete também apaga) */
  const [selEdge, setSelEdge] = useState<{ key: string; at: Pt } | null>(null);
  const [tick, setTick] = useState(0);
  const view = useRef({ pan, zoom });
  view.current = { pan, zoom };

  /* posição na tela → posição no plano */
  const toWorld = useCallback((cx: number, cy: number): Pt => {
    const r = box.current!.getBoundingClientRect();
    const { pan: p, zoom: z } = view.current;
    return { x: (cx - r.left - p.x) / z, y: (cy - r.top - p.y) / z };
  }, []);

  /* mede onde ficaram as bolinhas (portas) e o tamanho das caixas depois de cada pintura
     (sem lista de dependências de propósito; só grava quando mudou, então não entra em loop) */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const w = world.current;
    if (!w) return;
    const wr = w.getBoundingClientRect();
    const z = view.current.zoom;
    const nextPorts: Record<string, PortPt> = {};
    w.querySelectorAll<HTMLElement>("[data-port]").forEach((el) => {
      const r = el.getBoundingClientRect();
      nextPorts[el.dataset.port!] = { x: (r.left + r.width / 2 - wr.left) / z, y: (r.top + r.height / 2 - wr.top) / z, dir: (el.dataset.dir as PortPt["dir"]) ?? "right" };
    });
    const nextSizes: Record<string, { w: number; h: number }> = {};
    w.querySelectorAll<HTMLElement>("[data-node]").forEach((el) => {
      nextSizes[el.dataset.node!] = { w: el.offsetWidth, h: el.offsetHeight };
    });
    const a = JSON.stringify(nextPorts);
    if (a !== JSON.stringify(ports)) setPorts(nextPorts);
    if (JSON.stringify(nextSizes) !== JSON.stringify(sizes)) setSizes(nextSizes);
  });
  // caixas mudam de altura sozinhas (texto, botões): mede de novo
  useEffect(() => {
    const w = world.current;
    if (!w || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setTick((t) => t + 1));
    w.querySelectorAll("[data-node]").forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [steps.length]);
  void tick;

  /* roda: navega; com Ctrl/⌘ dá zoom em volta do mouse */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("textarea, select, [data-scroll]")) return;
      e.preventDefault();
      const { pan: p, zoom: z } = view.current;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const nz = Math.min(1.6, Math.max(0.25, z * (1 - e.deltaY * 0.0015)));
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        setPan({ x: mx - ((mx - p.x) / z) * nz, y: my - ((my - p.y) / z) * nz });
        setZoom(nz);
      } else setPan({ x: p.x - e.deltaX, y: p.y - e.deltaY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (f: number) => {
    const r = box.current!.getBoundingClientRect();
    const mx = r.width / 2;
    const my = r.height / 2;
    const nz = Math.min(1.6, Math.max(0.25, zoom * f));
    setPan({ x: mx - ((mx - pan.x) / zoom) * nz, y: my - ((my - pan.y) / zoom) * nz });
    setZoom(nz);
  };

  const fit = useCallback(() => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const all = [{ x: start.x, y: start.y, w: 300, h: 60 }, ...steps.map((s) => ({ x: s.x ?? 0, y: s.y ?? 0, w: sizes[s.id]?.w ?? NODE_W, h: sizes[s.id]?.h ?? 260 }))];
    const minX = Math.min(...all.map((a) => a.x));
    const minY = Math.min(...all.map((a) => a.y));
    const maxX = Math.max(...all.map((a) => a.x + a.w));
    const maxY = Math.max(...all.map((a) => a.y + a.h));
    const z = Math.min(1.2, Math.max(0.25, Math.min((r.width - 80) / (maxX - minX), (r.height - 120) / (maxY - minY))));
    setZoom(z);
    setPan({ x: (r.width - (maxX - minX) * z) / 2 - minX * z, y: 70 - minY * z });
  }, [steps, start, sizes]);

  const organize = () => {
    const heights = Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, v.h]));
    onChange(autoLayout(steps, start, heights), start);
    setRefit((n) => n + 1);
  };

  // caixas umas por cima das outras (robô antigo ou modelo pronto, posicionados antes de medir): organiza com a altura real.
  // Confere ao abrir e quando muda o número de passos; arrastar uma caixa por cima de outra de propósito não desfaz nada.
  const checkedFor = useRef(-1);
  useEffect(() => {
    if (checkedFor.current === steps.length || steps.some((s) => !sizes[s.id])) return;
    checkedFor.current = steps.length;
    const boxes = steps.map((s) => ({ l: s.x ?? 0, t: s.y ?? 0, r: (s.x ?? 0) + sizes[s.id].w, b: (s.y ?? 0) + sizes[s.id].h }));
    if (overlaps(boxes)) {
      onChange(autoLayout(steps, start, Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, v.h]))), start);
      setRefit((n) => n + 1); // enquadra de novo depois de reorganizar
    }
  }, [sizes, steps, start, onChange]);
  // enquadra depois que as posições novas chegaram (a função fit da pintura seguinte já vê os passos novos)
  const [refit, setRefit] = useState(0);
  useEffect(() => {
    if (refit) fit();
  }, [refit]); // eslint-disable-line react-hooks/exhaustive-deps

  // primeira abertura: enquadra o robô inteiro
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !Object.keys(sizes).length) return;
    fitted.current = true;
    fit();
  }, [sizes, fit]);

  /* arrastos: fundo (navegar), caixa (mover), fio (ligar) */
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      if (drag.kind === "pan") setPan({ x: drag.pan.x + e.clientX - drag.from.x, y: drag.pan.y + e.clientY - drag.from.y });
      else if (drag.kind === "node") {
        const dx = (e.clientX - drag.from.x) / zoom;
        const dy = (e.clientY - drag.from.y) / zoom;
        const pos = { x: Math.round(drag.pos.x + dx), y: Math.round(drag.pos.y + dy) };
        if (drag.id === START_ID) onChange(steps, { ...start, ...pos });
        else onChange(steps.map((s) => (s.id === drag.id ? { ...s, ...pos } : s)), start);
      } else setDrag({ ...drag, at: toWorld(e.clientX, e.clientY) });
    };
    const up = (e: PointerEvent) => {
      if (drag.kind === "wire") {
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-node]");
        const to = el?.dataset.node;
        if (to && to !== START_ID && to !== drag.from) link(drag.from, drag.handle, to);
        else if (!to) setMenu({ at: toWorld(e.clientX, e.clientY), screen: { x: e.clientX, y: e.clientY }, from: drag.from, handle: drag.handle });
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  });

  function link(from: string, handle: string, to: string | null) {
    if (from === START_ID) return onChange(steps, { ...start, next: to });
    onChange(steps.map((s) => (s.id === from ? connect(s, handle, to) : s)), start);
  }
  function addStep(type: RobotStepType, at: Pt, from?: string, handle?: string) {
    const s = { ...newStep(type), x: Math.round(at.x), y: Math.round(at.y - 24), next: null } as RobotStep;
    let next = [...steps, s];
    let st = start;
    if (from && handle) {
      if (from === START_ID) st = { ...start, next: s.id };
      else next = next.map((x) => (x.id === from ? connect(x, handle, s.id) : x));
    }
    onChange(next, st);
  }
  function removeStep(id: string) {
    const clean = steps
      .filter((s) => s.id !== id)
      .map((s) => handlesOf(s).reduce((acc, h) => (targetOf(acc, h) === id ? connect(acc, h, null) : acc), s));
    onChange(clean, start.next === id ? { ...start, next: null } : start);
  }

  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    // menus em portal (ex.: escolher o passo) também mandam o clique para cá pelo React: não é clique no fundo
    if (!box.current?.contains(t)) return;
    setSelEdge(null);
    if (t.closest("[data-node], [data-port], button, input, textarea, select, a")) return;
    setMenu(null);
    setDrag({ kind: "pan", from: { x: e.clientX, y: e.clientY }, pan });
  };
  const startNode = (e: React.PointerEvent, id: string, pos: Pt) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("input, textarea, select, button, a, label, [data-port], [contenteditable]")) return;
    e.stopPropagation();
    setDrag({ kind: "node", id, from: { x: e.clientX, y: e.clientY }, pos });
  };
  const port = (stepId: string, handle: string, dir: "down" | "right" = "right") => (
    <span
      data-port={`${stepId}:${handle}`}
      data-dir={dir}
      role="button"
      tabIndex={-1}
      aria-label="Puxe para ligar a outro passo"
      title="Puxe até outro passo para ligar"
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        setDrag({ kind: "wire", from: stepId, handle, at: toWorld(e.clientX, e.clientY) });
      }}
      className={cn(
        "absolute z-10 grid size-[18px] cursor-crosshair place-items-center rounded-pill bg-bg shadow-[0_0_0_2px_var(--accent)] transition-transform hover:scale-125",
        dir === "down" ? "-bottom-[10px] left-1/2 -translate-x-1/2" : "-right-[23px] top-1/2 -translate-y-1/2",
      )}
    >
      <span className="size-2 rounded-pill bg-accent" />
    </span>
  );

  // fios
  const edges: { key: string; from: PortPt; to: Pt; fromId: string; handle: string }[] = [];
  const inPort = (id: string) => ports[`${id}:in`];
  if (start.next && ports[`${START_ID}:main`] && inPort(start.next)) edges.push({ key: `${START_ID}:main`, from: ports[`${START_ID}:main`], to: inPort(start.next), fromId: START_ID, handle: "main" });
  for (const s of steps)
    for (const h of handlesOf(s)) {
      const t = targetOf(s, h);
      const a = ports[`${s.id}:${h}`];
      const b = t ? inPort(t) : undefined;
      if (a && b) edges.push({ key: `${s.id}:${h}`, from: a, to: b, fromId: s.id, handle: h });
    }
  // caixas como obstáculos (a do início também)
  const rects: Rect[] = [
    ...(sizes[START_ID] ? [{ l: start.x, t: start.y, r: start.x + sizes[START_ID].w, b: start.y + sizes[START_ID].h }] : []),
    ...steps.filter((s) => sizes[s.id]).map((s) => ({ l: s.x ?? 0, t: s.y ?? 0, r: (s.x ?? 0) + sizes[s.id].w, b: (s.y ?? 0) + sizes[s.id].h })),
  ];
  /* curva lisa passa livre? confere pontos ao longo dela contra as caixas (com uma folga pequena) */
  const curveIsClear = (a: PortPt, b: Pt) => {
    const k = Math.max(50, Math.min(220, Math.hypot(b.x - a.x, b.y - a.y) * 0.45));
    const c1 = a.dir === "down" ? { x: a.x, y: a.y + k } : { x: a.x + k, y: a.y };
    const c2 = { x: b.x, y: b.y - k };
    for (let i = 2; i <= 38; i++) {
      const t = i / 40;
      const u = 1 - t;
      const x = u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x;
      const y = u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y;
      if (rects.some((r) => x > r.l - 8 && x < r.r + 8 && y > r.t - 8 && y < r.b + 8)) return false;
    }
    return true;
  };
  const wires = edges.map((e) => {
    if (curveIsClear(e.from, e.to)) return { ...e, d: curve(e.from, e.to), mid: { x: (e.from.x + e.to.x) / 2, y: (e.from.y + e.to.y) / 2 } };
    const pts = routeEdge(e.from, e.to, rects);
    return { ...e, d: pts ? roundedPath(pts) : curve(e.from, e.to), mid: pts ? midpoint(pts) : { x: (e.from.x + e.to.x) / 2, y: (e.from.y + e.to.y) / 2 } };
  });
  const cut = (key: string) => {
    const w = wires.find((x) => x.key === key);
    if (w) link(w.fromId, w.handle, null);
    setSelEdge(null);
  };
  useEffect(() => {
    if (!selEdge) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        cut(selEdge.key);
      } else if (e.key === "Escape") setSelEdge(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* curva (fio sendo puxado, ou quando não há caminho livre): sai para baixo ou para o lado e entra por cima */
  function curve(a: PortPt, b: Pt) {
    const k = Math.max(50, Math.min(220, Math.hypot(b.x - a.x, b.y - a.y) * 0.45));
    const c1 = a.dir === "down" ? { x: a.x, y: a.y + k } : { x: a.x + k, y: a.y };
    const c2 = { x: b.x, y: b.y - k };
    return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
  };

  return (
    <div
      ref={box}
      onPointerDown={startPan}
      className={cn("relative min-h-[520px] flex-1 touch-none overflow-hidden bg-surface select-none", drag?.kind === "pan" ? "cursor-grabbing" : "cursor-grab")}
      style={{
        backgroundImage: "radial-gradient(circle, var(--border-input) 1.2px, transparent 1.2px)",
        backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* barra do quadro */}
      <div className="absolute left-3 top-3 z-30 flex items-center gap-1 rounded-pill bg-bg p-1 shadow-[0_0_0_1px_var(--border),0_6px_16px_-8px_rgba(14,26,58,.35)]" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => {
            const r = box.current!.getBoundingClientRect();
            setMenu({ at: toWorld(r.left + r.width / 2 - NODE_W / 2, r.top + r.height / 3), screen: { x: r.left + 80, y: r.top + 56 } });
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-accent px-3.5 text-sm font-medium text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.2)] hover:bg-accent-hover"
        >
          <Plus className="size-4" aria-hidden /> Passo
        </button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <IconButton label="Diminuir zoom" size={28} onClick={() => zoomBy(1 / 1.2)}>
          <Minus className="size-4" />
        </IconButton>
        <button type="button" onClick={() => zoomBy(1 / zoom)} title="Voltar para 100%" className="h-7 min-w-12 rounded-pill px-1 text-xs font-medium tabular-nums text-fg hover:bg-surface">
          {Math.round(zoom * 100)}%
        </button>
        <IconButton label="Aumentar zoom" size={28} onClick={() => zoomBy(1.2)}>
          <Plus className="size-4" />
        </IconButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <button type="button" onClick={fit} className="inline-flex h-7 items-center gap-1 rounded-pill px-2.5 text-xs font-medium text-fg hover:bg-surface">
          <ArrowsOut className="size-3.5" aria-hidden /> Ver tudo
        </button>
        <button type="button" onClick={organize} className="inline-flex h-7 items-center gap-1 rounded-pill px-2.5 text-xs font-medium text-fg hover:bg-surface">
          <Workflow className="size-3.5" aria-hidden /> Organizar
        </button>
      </div>
      <p className="pointer-events-none absolute bottom-3 left-3 z-20 hidden rounded-pill bg-bg/90 px-3 py-1 text-xs text-muted shadow-[0_0_0_1px_var(--border)] md:block">
        Arraste o fundo para navegar · Ctrl + roda para zoom · puxe a bolinha azul para ligar · clique numa linha para desligar
      </p>

      <div ref={world} className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        {/* fios */}
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden>
          {wires.map((e) => (
            <g
              key={e.key}
              className="pointer-events-auto cursor-pointer"
              onPointerEnter={() => setHoverEdge(e.key)}
              onPointerLeave={() => setHoverEdge((h) => (h === e.key ? null : h))}
              onPointerDown={(ev) => {
                ev.stopPropagation(); // não é arrastar o fundo
                setMenu(null);
                setSelEdge({ key: e.key, at: toWorld(ev.clientX, ev.clientY) });
              }}
            >
              <path d={e.d} fill="none" stroke="transparent" strokeWidth={22} />
              <path
                d={e.d}
                fill="none"
                style={{ stroke: selEdge?.key === e.key ? "var(--danger)" : hoverEdge === e.key ? "color-mix(in srgb, var(--danger) 70%, var(--accent))" : "var(--accent)" }}
                strokeWidth={selEdge?.key === e.key ? 4 : hoverEdge === e.key ? 3.5 : 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />
            </g>
          ))}
          {drag?.kind === "wire" && ports[`${drag.from}:${drag.handle}`] && (
            <path d={curve(ports[`${drag.from}:${drag.handle}`], { x: drag.at.x, y: drag.at.y })} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth={2.5} strokeDasharray="6 6" />
          )}
        </svg>
        {/* desligar: aparece onde a pessoa clicou no fio e fica até clicar em outro lugar */}
        {selEdge && wires.some((w) => w.key === selEdge.key) && (
          <div
            className="absolute z-40 flex items-center gap-1 whitespace-nowrap rounded-pill bg-bg p-1 shadow-[0_0_0_1px_var(--border),0_10px_24px_-8px_rgba(14,26,58,.45)]"
            style={{ left: selEdge.at.x, top: selEdge.at.y, transform: `translate(-50%, calc(-100% - 10px)) scale(${1 / zoom})`, transformOrigin: "bottom center" }}
            onPointerDown={(ev) => ev.stopPropagation()}
          >
            <button type="button" onClick={() => cut(selEdge.key)} className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-danger px-3.5 text-sm font-semibold text-on-accent hover:brightness-110">
              <X className="size-4" aria-hidden /> Desligar
            </button>
            <button type="button" onClick={() => setSelEdge(null)} className="h-8 rounded-pill px-3 text-sm text-muted hover:bg-surface hover:text-fg">
              Cancelar
            </button>
          </div>
        )}

        {/* início */}
        <div
          data-node={START_ID}
          onPointerDown={(e) => startNode(e, START_ID, { x: start.x, y: start.y })}
          className="absolute flex cursor-grab items-center gap-2 rounded-pill bg-inverse-bg py-2.5 pl-2.5 pr-5 text-sm font-medium text-on-inverse shadow-[0_10px_28px_-12px_rgba(14,26,58,.7)] active:cursor-grabbing"
          style={{ left: start.x, top: start.y }}
        >
          <span className="grid size-8 place-items-center rounded-pill bg-accent" aria-hidden>
            <Lightning className="size-4 text-on-accent" weight="fill" />
          </span>
          <span className="max-w-64 truncate">{triggerText}</span>
          {port(START_ID, "main", "down")}
        </div>

        {/* passos */}
        {steps.map((s, i) => {
          const branches = handlesOf(s);
          const hasMain = branches.includes("main");
          return (
            <section
              key={s.id}
              data-node={s.id}
              aria-label={`${i + 1}. ${STEP_TYPES[s.type].label}`}
              onPointerDown={(e) => startNode(e, s.id, { x: s.x ?? 0, y: s.y ?? 0 })}
              className={cn(
                "absolute cursor-grab rounded-xl bg-bg shadow-[0_0_0_1px_var(--border),0_14px_34px_-20px_rgba(14,26,58,.5)] active:cursor-grabbing",
                drag?.kind === "node" && drag.id === s.id && "shadow-[0_0_0_2px_var(--accent),0_24px_48px_-16px_rgba(29,78,216,.55)]",
                drag?.kind === "wire" && drag.from !== s.id && "shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_50%,transparent),0_14px_34px_-20px_rgba(14,26,58,.5)]",
              )}
              style={{ left: s.x ?? 0, top: s.y ?? 0, width: NODE_W }}
            >
              {/* entrada */}
              <span data-port={`${s.id}:in`} data-dir="in" className="absolute -top-[10px] left-1/2 size-[18px] -translate-x-1/2 rounded-pill bg-bg shadow-[0_0_0_2px_var(--border-input)]" aria-hidden />
              <header className="relative flex items-center gap-2.5 border-b border-border px-4 py-3">
                <StepBadge type={s.type} size="sm" />
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{STEP_TYPES[s.type].label}</h3>
                <IconButton label="Apagar passo" size={28} tone="danger" onClick={() => removeStep(s.id)}>
                  <Trash2 className="size-4" />
                </IconButton>
              </header>
              <div className="px-4 py-3">
                <StepBody
                  step={s}
                  onChange={(n) => onChange(steps.map((x) => (x.id === s.id ? n : x)), start)}
                  ctx={ctx}
                  port={(h) => port(s.id, h)}
                />
              </div>
              {hasMain && port(s.id, "main", "down")}
            </section>
          );
        })}
      </div>

      {/* menu para criar passo (botão "+ Passo" ou fio solto no vazio) */}
      {menu && <AddMenu screen={menu.screen} box={box} onClose={() => setMenu(null)} onPick={(t) => (addStep(t, menu.at, menu.from, menu.handle), setMenu(null))} />}
    </div>
  );
}

function AddMenu({ screen, box, onPick, onClose }: { screen: Pt; box: React.RefObject<HTMLDivElement | null>; onPick: (t: RobotStepType) => void; onClose: () => void }) {
  const r = box.current?.getBoundingClientRect();
  const left = r ? Math.min(Math.max(8, screen.x - r.left), r.width - 300) : 8;
  const top = r ? Math.min(Math.max(8, screen.y - r.top), r.height - 380) : 8;
  const groups = ["Conversa", "Fluxo", "Lead", "Equipe", "Integração"] as const;
  return (
    <DropdownMenu.Root open onOpenChange={(o) => !o && onClose()}>
      <DropdownMenu.Trigger asChild>
        <span className="absolute size-px" style={{ left, top }} aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content data-scroll sideOffset={4} align="start" className="z-50 max-h-[380px] w-72 overflow-y-auto rounded-lg border border-border bg-bg p-1 shadow-pop">
          {groups.map((g) => (
            <DropdownMenu.Group key={g}>
              <DropdownMenu.Label className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{g}</DropdownMenu.Label>
              {(Object.keys(STEP_TYPES) as RobotStepType[])
                .filter((t) => STEP_TYPES[t].group === g)
                .map((t) => (
                  <DropdownMenu.Item key={t} onSelect={() => onPick(t)} className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 outline-none data-[highlighted]:bg-surface">
                    <StepBadge type={t} size="sm" />
                    <span>
                      <span className="block text-sm font-medium text-fg">{STEP_TYPES[t].label}</span>
                      <span className="block text-xs text-muted">{STEP_TYPES[t].hint}</span>
                    </span>
                  </DropdownMenu.Item>
                ))}
            </DropdownMenu.Group>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export type { ReactNode };
