import { redirect } from "next/navigation";

export const instant = false; // tela atrás de login: bloqueia no servidor (ver [ws]/layout.tsx)

export default async function WorkspaceIndex({ params }: PageProps<"/[ws]">) {
  const { ws } = await params;
  redirect(`/${ws}/leads`);
}
