import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/data/session";
import { workspacesOf } from "@/data";

export const instant = false;

/* Porta de entrada de quem já está logado: o proxy manda "/" para cá quando há sessão. */
async function Go() {
  const user = await currentUser();
  if (!user) redirect("/sair"); // cookie de sessão vencido: limpa e mostra a landing
  const [first] = await workspacesOf(user.id);
  redirect(first ? `/${first.slug}/home` : "/onboarding");
  return null;
}

export default function AppEntry() {
  return (
    <Suspense fallback={null}>
      <Go />
    </Suspense>
  );
}
