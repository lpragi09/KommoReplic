import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/forms";
import { currentUser } from "@/data/session";

export const metadata = { title: "Sua empresa" };

async function Gate() {
  if (!(await currentUser())) redirect("/login");
  return <OnboardingForm />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  );
}
