// Configuração por ambiente (DEVOPS-004).
//
// Nada aqui é segredo: tudo que entra no bundle é público por definição.
// Chaves de terceiros que exijam sigilo devem ficar no backend, nunca aqui.

const env = import.meta.env ?? {};

/**
 * Modo demonstração. Ligado por padrão — o sistema só deixa de se anunciar
 * como demo quando alguém desliga explicitamente, o que evita publicar
 * conteúdo fictício como real por esquecimento (SEC-001).
 */
export const IS_DEMO = env.VITE_DEMO_MODE !== "false";

/**
 * Canais de atendimento. Sem valor configurado, a interface esconde o canal
 * em vez de exibir um número fictício que ninguém atende (SEC-001).
 */
export const CONTACT = {
  whatsappUrl: env.VITE_WHATSAPP_URL || "",
  email: env.VITE_CONTACT_EMAIL || "",
  pressEmail: env.VITE_PRESS_EMAIL || "",
  privacyEmail: env.VITE_PRIVACY_EMAIL || "",
};

/** Endpoint que recebe o formulário de contato. Vazio = formulário desativado (SEC-002). */
export const CONTACT_FORM_ENDPOINT = env.VITE_CONTACT_FORM_ENDPOINT || "";

/** Dados da empresa exibidos no rodapé. Vazio em demo, para não publicar CNPJ fictício. */
export const COMPANY = {
  legalName: env.VITE_COMPANY_LEGAL_NAME || "",
  cnpj: env.VITE_COMPANY_CNPJ || "",
};

export const hasWhatsApp = () => Boolean(CONTACT.whatsappUrl);

/** Abre link externo sem expor `window.opener` (SEC-005). */
export function openExternal(url) {
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
