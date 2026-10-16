/* CPF e CNPJ: limpeza, máscara e dígitos verificadores. Roda no navegador e no servidor.
   O banco confere de novo (private.valid_doc) — quem decide é o servidor. */

export type DocType = "cpf" | "cnpj";

export const digits = (s: string) => s.replace(/\D/g, "");

const allSame = (d: string) => /^(\d)\1+$/.test(d);

export function validCPF(raw: string) {
  const d = digits(raw);
  if (d.length !== 11 || allSame(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function validCNPJ(raw: string) {
  const d = digits(raw);
  if (d.length !== 14 || allSame(d)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * w[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export const validDoc = (type: DocType, raw: string) => (type === "cpf" ? validCPF(raw) : validCNPJ(raw));

/** máscara enquanto digita: 000.000.000-00 / 00.000.000/0000-00 */
export function maskDoc(type: DocType, raw: string) {
  const d = digits(raw).slice(0, type === "cpf" ? 11 : 14);
  if (type === "cpf") return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** (11) 98888-1234 */
export function maskPhone(raw: string) {
  const d = digits(raw).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

/* Provedores de email descartável mais usados para criar contas em série. */
const DISPOSABLE = new Set([
  "mailinator.com", "10minutemail.com", "10minutemail.net", "guerrillamail.com", "guerrillamail.net", "sharklasers.com",
  "temp-mail.org", "tempmail.com", "tempmail.net", "tempmailo.com", "yopmail.com", "yopmail.net", "trashmail.com",
  "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "mintemail.com", "throwawaymail.com", "fakeinbox.com",
  "emailondeck.com", "mohmal.com", "moakt.com", "tempail.com", "mailnesia.com", "spamgourmet.com", "burnermail.io",
  "inboxkitten.com", "tmail.ws", "tmpmail.org", "tmpmail.net", "emailfake.com", "fakemail.net", "mytemp.email",
  "luxusmail.org", "minuteinbox.com", "dropmail.me", "10mail.org", "mail.tm", "mailpoof.com", "trash-mail.com",
]);
export const isDisposableEmail = (email: string) => DISPOSABLE.has(email.trim().toLowerCase().split("@")[1] ?? "");
