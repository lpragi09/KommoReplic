import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/forms";
import { currentUser } from "@/data/session";
import { signupInfo } from "@/data";

export const metadata = { title: "Sua empresa" };

async function Gate() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <OnboardingForm info={await signupInfo(user.id)} />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  );
}
