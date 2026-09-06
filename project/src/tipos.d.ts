// Modelo de dados do domínio (ARCH-007).
//
// A auditoria apontou que `Lot` era um objeto de forma implícita: imóvel tem
// `area`/`bedrooms`, veículo tem `km`/`fipe`, e um campo ausente virava
// `undefined` na tela em vez de erro — foi assim que nasceu o BIZ-007 (ITBI
// cobrado de carro). Aqui `Lote` é uma UNIÃO DISCRIMINADA por `category`:
// perguntar `lote.km` sem antes checar a categoria passa a ser erro de tipo.
//
// Declarado em .d.ts e consumido por JSDoc: tipagem incremental, sem reescrever
// arquivo nenhum (era exatamente a recomendação — `allowJs` + migração aos
// poucos).

export type Categoria = "imovel" | "carro";

/** Campos comuns a qualquer lote em leilão. */
interface LoteBase {
  id: string;
  title: string;
  city: string;
  address: string;
  region?: string;
  vendor: string;
  auctionType: string;
  praca: string;
  /** Valores em reais inteiros. Nunca centavos, nunca ponto flutuante. */
  minBid: number;
  currentBid: number;
  bids: number;
  /** Instante absoluto de encerramento, em milissegundos (BIZ-003). */
  endsAt: number;
  photo: string;
  photoIds: string[];
  glyph?: string;
  saved?: boolean;
  docs: string[];
  rules: string;
  description: string;
  /** Contador de escrita do servidor; ausente no modo demonstração. */
  versao?: number;
}

export interface LoteImovel extends LoteBase {
  category: "imovel";
  /** Valor de avaliação — a referência de desconto de um imóvel. */
  appraised: number;
  area: number;
  bedrooms: number;
  parking?: number;
  floor?: number;
  year?: number;
  type?: string;
  occupancy: string;
}

export interface LoteCarro extends LoteBase {
  category: "carro";
  /** Tabela FIPE — a referência de desconto de um veículo. */
  fipe: number;
  km: number;
  year: number;
  transmission: string;
  fuel: string;
  color: string;
  plate: string;
  condition: string;
}

export type Lote = LoteImovel | LoteCarro;

/** Um lance registrado. `id` é do servidor; no modo demonstração é local. */
export interface Lance {
  id: string;
  lotId: string;
  value: number;
  autoMax: number | null;
  placedAt: number;
  /** Fim da janela de arrependimento, ou null quando não é o primeiro lance. */
  cancelableUntil: number | null;
  canceled: boolean;
  canceledAt?: number | null;
}

export interface LinhaDeCusto {
  key: "lance" | "comissao" | "taxa" | "itbi" | "registro";
  label: string;
  value: number;
}

export interface CustoSimulado {
  lance: number;
  comissao: number;
  taxa: number;
  itbi: number;
  registro: number;
  total: number;
  lines: LinhaDeCusto[];
}

export type MotivoRecusa = "ended" | "below-min" | "invalid" | "no-lot";

export type ResultadoValidacao =
  | { ok: true }
  | { ok: false; reason: MotivoRecusa; message: string; min?: number };

export type SituacaoDoLance = "canceled" | "won" | "lost" | "winning" | "outbid";

export interface Usuario {
  id: string;
  email: string;
  nome: string;
}
