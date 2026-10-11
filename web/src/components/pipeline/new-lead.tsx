"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Stage } from "@/data/types";
import { createLeadAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";

export function NewLeadButton({ slug, pipelineId, stages, defaultStageId }: { slug: string; pipelineId: string; stages: Stage[]; defaultStageId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(undefined);
    start(async () => {
      const r = await createLeadAction(slug, {
        pipelineId,
        stageId: String(f.get("stageId")),
        name: String(f.get("name") ?? ""),
        price: String(f.get("price") ?? ""),
        contactName: String(f.get("contactName") ?? ""),
        contactPhone: String(f.get("contactPhone") ?? ""),
      });
      if (!r.ok) return setError(r.error);
      setOpen(false);
      router.push(`/${slug}/leads/${r.data.id}`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Novo lead"
      description="Só o que você já sabe. O resto dá para completar no cartão."
      trigger={<Button icon={<Plus className="size-4" aria-hidden />}>Novo lead</Button>}
    >
      <form onSubmit={submit} className="flex flex-col gap-3" data-editing>
        <Field label="Nome do negócio" name="name" placeholder="Ex.: Clínica Vida — 2 implantes" autoFocus maxLength={200} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Valor" name="price" adornment="R$" inputMode="decimal" placeholder="0,00" />
          <div className="flex flex-col gap-1">
            <label htmlFor="nl-stage" className="text-sm font-medium text-fg">
              Etapa
            </label>
            <select id="nl-stage" name="stageId" defaultValue={defaultStageId} className="h-9 rounded-sm border border-border-input bg-bg px-2 text-base text-fg">
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <Field label="Nome do contato" name="contactName" maxLength={120} />
          <Field label="Telefone do contato" name="contactPhone" type="tel" placeholder="+55 11 90000-0000" maxLength={30} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Criar lead
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
