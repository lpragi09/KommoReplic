import { Landing } from "@/components/marketing/landing";

/* Landing estática: sai pronta da CDN, sem esperar checagem de login.
   Quem já tem sessão é desviado para /app pelo proxy (src/proxy.ts). */
export default function Root() {
  return <Landing />;
}
