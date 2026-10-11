import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getWebchat } from "@/data";
import { VisitorChat } from "@/components/webchat/visitor-chat";

export const metadata = { title: "Fale conosco" };

async function Chat({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const ch = await getWebchat(key).catch(() => null);
  if (!ch) notFound();
  return <VisitorChat publicKey={key} workspaceName={ch.workspaceName} />;
}

export default function WebchatPage({ params }: PageProps<"/chat/[key]">) {
  return (
    <Suspense fallback={null}>
      <Chat params={params as Promise<{ key: string }>} />
    </Suspense>
  );
}
