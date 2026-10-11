import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/data/session";
import { workspacesOf } from "@/data";
import { Landing } from "@/components/marketing/landing";

export const instant = false; // lê a sessão para decidir entre landing e app

async function Home() {
  const user = await currentUser();
  if (!user) return <Landing />;
  const [first] = await workspacesOf(user.id);
  redirect(first ? `/${first.slug}/leads` : "/onboarding");
}

export default function Root() {
  return (
    <Suspense fallback={<div className="fx-aurora min-h-dvh" />}>
      <Home />
    </Suspense>
  );
}
