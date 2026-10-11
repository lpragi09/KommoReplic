"use client";

import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid flex-1 place-items-center" role="alert">
      <EmptyState icon={TriangleAlert} title="Algo deu errado" text="Não conseguimos carregar esta tela." action={<Button onClick={reset}>Tentar de novo</Button>} />
    </div>
  );
}
