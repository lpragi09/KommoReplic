/* Quem responde pelo produto (Decreto 7.962/2013, art. 2º, e LGPD, art. 41). Preencher aqui atualiza
   rodapé, termos, privacidade e checkout, e o aviso de rascunho das páginas legais some quando estiver completo. */
export const LEGAL = {
  /** nome empresarial (ou nome completo, se for pessoa física) */
  company: "",
  /** CNPJ ou CPF */
  document: "",
  address: "",
  /** email de atendimento, arrependimento e dados pessoais */
  email: "",
  /** cidade/UF da sede, para o foro entre empresas */
  city: "",
};

export const legalComplete = () => Object.values(LEGAL).every(Boolean);
export const LEGAL_UPDATED = "30 de outubro de 2026";
