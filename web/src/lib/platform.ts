/* Quem é dono do netzer (entra na Central da plataforma).
   Defina PLATFORM_ADMINS na Vercel com os emails separados por vírgula: "voce@x.com,socio@y.com".
   Sem a variável, só o email do dono do projeto entra. */

const FALLBACK = ["lpmragi@gmail.com"];

export function platformAdmins(): string[] {
  const raw = process.env.PLATFORM_ADMINS;
  const list = raw ? raw.split(",") : FALLBACK;
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export const isPlatformAdmin = (email: string | null | undefined) => !!email && platformAdmins().includes(email.trim().toLowerCase());
