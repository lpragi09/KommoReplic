import { listChannels, listFields, listPipelines, listRobots, listTemplates, listUsers } from "@/data";
import type { RobotInput, RobotTrigger } from "@/data/types";
import { requireWorkspace } from "@/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { RobotEditor } from "@/components/robots/editor";
import { PRESETS, newStep } from "@/lib/robot-meta";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export const metadata = { title: "Novo robô" };

type SP = { trigger?: string; stage?: string; pipeline?: string; preset?: string };
const TRIGGERS: RobotTrigger[] = ["stage_enter", "lead_created", "message_in", "new_contact"];

export default async function NewRobotPage({ params, searchParams }: PageProps<"/[ws]/automations/new">) {
  const { ws: slug } = await params;
  const sp = (await searchParams) as SP;
  const { ws } = await requireWorkspace(slug);
  const [pipelines, users, templates, channels, fields, robots] = await Promise.all([listPipelines(ws.id), listUsers(ws.id), listTemplates(ws.id), listChannels(ws.id), listFields(ws.id), listRobots(ws.id)]);
  const stages = pipelines.flatMap((p) => [...p.stages].sort((a, b) => a.sort - b.sort));

  let initial: RobotInput;
  const preset = PRESETS.find((p) => p.key === sp.preset);
  if (preset) {
    const p0 = pipelines[0];
    const ordered = p0 ? [...p0.stages].sort((a, b) => a.sort - b.sort) : [];
    const st = preset.stage === "won" ? ordered.find((s) => s.kind === "won") : typeof preset.stage === "number" ? ordered.filter((s) => s.kind === "open")[preset.stage] : undefined;
    // passos com ids novos: o mesmo modelo pode ser usado várias vezes
    initial = { ...structuredClone(preset.robot), steps: preset.robot.steps.map((s) => ({ ...structuredClone(s), id: newStep(s.type).id })), pipelineId: st?.pipelineId ?? null, stageId: st?.id ?? null };
  } else {
    const trigger = TRIGGERS.includes(sp.trigger as RobotTrigger) ? (sp.trigger as RobotTrigger) : "stage_enter";
    const st = stages.find((s) => s.id === sp.stage) ?? (trigger === "stage_enter" ? stages[0] : undefined);
    initial = {
      name: "",
      active: true,
      trigger,
      pipelineId: st?.pipelineId ?? (pipelines.some((p) => p.id === sp.pipeline) ? sp.pipeline! : null),
      stageId: trigger === "stage_enter" ? (st?.id ?? null) : null,
      channels: [],
      keywords: [],
      once: true,
      steps: [newStep("message")],
    };
  }

  return (
    <>
      <PageHeader title="Novo robô" crumbs={[{ label: "Automações", href: `/${slug}/automations` }]} />
      <RobotEditor
        slug={slug}
        robotId={null}
        initial={initial}
        pipelines={pipelines}
        users={users}
        templates={templates}
        runs={[]}
        connected={channels.filter((c) => c.status === "connected").map((c) => c.kind)}
        fields={fields}
        robots={robots.map((x) => ({ id: x.id, name: x.name }))}
      />
    </>
  );
}
