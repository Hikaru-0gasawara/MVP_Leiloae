// Roteamento por URL (ARCH-002).
//
// Antes a navegação vivia só em estado React: nenhum lote tinha endereço, o
// botão Voltar do navegador saía do site e nada era indexável. Aqui o estado de
// rota é espelhado na URL com a History API, sem dependência nova.
//
// Requer reescrita de SPA no hosting (ver public/_redirects e vercel.json).

const PAGE_ROUTES = {
  "quem-somos": "quem-somos",
  carreiras: "carreiras",
  imprensa: "imprensa",
  glossario: "glossario",
  blog: "blog",
  termos: "termos",
  privacidade: "privacidade",
  taxas: "taxas",
  ajuda: "ajuda",
  contato: "contato",
};

const SIMPLE = {
  home: "/",
  listing: "/leiloes",
  "my-bids": "/meus-lances",
  saved: "/salvos",
  profile: "/conta/meus-dados",
  history: "/conta/historico",
  messages: "/conta/mensagens",
  entrar: "/entrar",
  redefinir: "/redefinir",
  payments: "/conta/pagamentos",
  settings: "/conta/configuracoes",
};

/** Estado de rota → caminho na URL. */
export function routeToPath(route) {
  if (!route) return "/";
  if (route.name === "lot" && route.lotId) return `/lote/${encodeURIComponent(route.lotId)}`;
  if (route.name === "win" && route.lotId) return `/arremate/${encodeURIComponent(route.lotId)}`;
  if (route.name === "page" && route.pageId) return `/institucional/${route.pageId}`;
  return SIMPLE[route.name] || "/";
}

/** Caminho na URL → estado de rota. */
export function pathToRoute(pathname) {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  for (const [name, p] of Object.entries(SIMPLE)) {
    if (p === path) return { name, lotId: null };
  }
  const lote = path.match(/^\/lote\/([^/]+)$/);
  if (lote) return { name: "lot", lotId: decodeURIComponent(lote[1]) };

  const arremate = path.match(/^\/arremate\/([^/]+)$/);
  if (arremate) return { name: "win", lotId: decodeURIComponent(arremate[1]) };

  const pagina = path.match(/^\/institucional\/([^/]+)$/);
  if (pagina && PAGE_ROUTES[pagina[1]]) return { name: "page", lotId: null, pageId: pagina[1] };

  return { name: "home", lotId: null };
}

/** Título do documento por rota — importa para histórico e leitores de tela. */
export function routeTitle(route, lot) {
  const base = "Leiloaê";
  switch (route?.name) {
    case "listing": return `Leilões em São Paulo · ${base}`;
    case "lot": return lot ? `${lot.title} · ${base}` : base;
    case "win": return `Arremate confirmado · ${base}`;
    case "my-bids": return `Meus lances · ${base}`;
    case "saved": return `Salvos · ${base}`;
    case "profile": return `Meus dados · ${base}`;
    case "history": return `Histórico · ${base}`;
    case "messages": return `Mensagens · ${base}`;
    case "entrar": return `Entrar · ${base}`;
    case "redefinir": return `Redefinir senha · ${base}`;
    case "payments": return `Pagamentos · ${base}`;
    case "settings": return `Configurações · ${base}`;
    case "page": return `${base}`;
    default: return `${base} — Leilão sem juridiquês`;
  }
}
