"use client";

import { useTransition } from "react";
import { CheckCheck } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/interactive";
import { markNotificationsSeenAction } from "@/app/actions";

export function MarkAllSeen({ slug }: { slug: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      loading={pending}
      icon={<CheckCheck className="size-4" aria-hidden />}
      onClick={() =>
        start(async () => {
          const r = await markNotificationsSeenAction(slug);
          if (!r.ok) toast.show({ text: r.error, tone: "error" });
        })
      }
    >
      Marcar tudo como lido
    </Button>
  );
}
