import { NewPasswordForm } from "@/components/auth/forms";

export const metadata = { title: "Senha nova", robots: { index: false } };

export default function NewPasswordPage() {
  return <NewPasswordForm />;
}
