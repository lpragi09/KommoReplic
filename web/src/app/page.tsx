import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/data/session";
import { workspacesOf } from "@/data";

async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const [first] = await workspacesOf(user.id);
  redirect(first ? `/${first.slug}/leads` : "/onboarding");
  return null;
}

export default function Root() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}
