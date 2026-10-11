import { redirect } from "next/navigation";

export default async function WorkspaceIndex({ params }: PageProps<"/[ws]">) {
  const { ws } = await params;
  redirect(`/${ws}/leads`);
}
