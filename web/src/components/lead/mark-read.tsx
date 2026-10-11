"use client";

import { useEffect } from "react";
import { markReadAction } from "@/app/actions";

/** Ao abrir uma conversa com mensagens não lidas, zera o contador. */
export function MarkRead({ slug, conversationId, unread }: { slug: string; conversationId: string; unread: number }) {
  useEffect(() => {
    if (unread > 0) void markReadAction(slug, conversationId);
  }, [slug, conversationId, unread]);
  return null;
}
