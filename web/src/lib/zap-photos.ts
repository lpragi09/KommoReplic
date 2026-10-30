import "server-only";
import { adminClient } from "@/lib/supabase/clients";
import { QR_PREFIX, zapOn, zapPhoto } from "@/lib/zap";

/* Foto de perfil de quem ainda não tem (contatos do WhatsApp por QR code): roda depois da resposta da caixa de
   entrada, poucas por vez, e o próximo refresh já mostra. Só no Supabase. */
export async function fillMissingPhotos(items: { contactId: string; thread: string; channelExternalId: string | null | undefined; hasPhoto: boolean }[]) {
  if (!zapOn() || process.env.NEXT_PUBLIC_DATA_BACKEND !== "supabase") return;
  const todo = items.filter((i) => !i.hasPhoto && i.channelExternalId?.startsWith(QR_PREFIX)).slice(0, 25);
  const db = adminClient();
  for (const i of todo) {
    const url = await zapPhoto(i.channelExternalId!.slice(QR_PREFIX.length), i.thread).catch(() => null);
    if (url && /^https:\/\/[a-z0-9.-]+\.whatsapp\.net\//i.test(url)) await db.from("contacts").update({ avatar_url: url }).eq("id", i.contactId);
  }
}
