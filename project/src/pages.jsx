// Global footer ("batente") + all the pages it links to.
// Brand voice: plain Portuguese, anti-juridiquês, warm. All content fictional.

const { useState: useStateP, useMemo: useMemoP } = React;

// =====================================================================
// FOOTER
// =====================================================================
function Footer({ onOpenPage, onTour, onNavigate }) {
  const cols = [
    {
      head: "Sobre o Leiloaê",
      links: [
        { label: "Quem somos", go: () => onOpenPage("quem-somos") },
        { label: "Carreiras",  go: () => onOpenPage("carreiras") },
        { label: "Imprensa",   go: () => onOpenPage("imprensa") },
      ],
    },
    {
      head: "Como funciona",
      links: [
        { label: "Tour de iniciante", go: () => onTour() },
        { label: "Glossário",         go: () => onOpenPage("glossario") },
        { label: "Blog",              go: () => onOpenPage("blog") },
      ],
    },
    {
      head: "Termos e taxas",
      links: [
        { label: "Termos de uso",  go: () => onOpenPage("termos") },
        { label: "Privacidade",    go: () => onOpenPage("privacidade") },
        { label: "Tabela de taxas", go: () => onOpenPage("taxas") },
      ],
    },
    {
      head: "Suporte",
      links: [
        { label: "Central de ajuda", go: () => onOpenPage("ajuda") },
        { label: "WhatsApp",         go: () => { window.open("https://wa.me/5511999999999", "_blank"); window.dispatchEvent(new CustomEvent("leiloe:toast", { detail: "Abrindo conversa no WhatsApp…" })); } },
        { label: "Fale com a gente", go: () => onOpenPage("contato") },
      ],
    },
  ];

  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--bg)", marginTop: 24 }}>
      <div style={{
        maxWidth: 1280, margin: "0 auto", padding: "56px 40px 36px",
        display: "grid", gridTemplateColumns: "1.3fr repeat(4, minmax(0, 1fr))", gap: 32,
      }}>
        <div style={{ maxWidth: 280 }}>
          <button onClick={() => onNavigate("home")} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", marginBottom: 16, display: "block" }}>
            <Wordmark size={26} />
          </button>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-mute)", margin: 0 }}>
            Leilão sem juridiquês. Imóveis e veículos abaixo do mercado, explicados em português.
          </p>
        </div>
        {cols.map(col => (
          <div key={col.head}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.13em", color: "var(--text-mute)", marginBottom: 16 }}>{col.head}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
              {col.links.map(l => (
                <button key={l.label} onClick={l.go} style={{
                  background: "transparent", border: "none", padding: 0, cursor: "pointer",
                  fontSize: 14, color: "var(--text-dim)", textAlign: "left", lineHeight: 1.3, whiteSpace: "nowrap",
                  transition: "color 0.15s ease",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; }}
                >{l.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 40px", fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-mute)", fontFamily: "var(--mono)" }}>
          Leiloaê · CNPJ Fictício 00.000.000/0001-00 · Atendimento via WhatsApp
        </div>
      </div>
    </footer>
  );
}

// =====================================================================
// SHARED PAGE SHELL + bits
// =====================================================================
function PageShell({ overline, title, subtitle, onBack, children, max = 880 }) {
  return (
    <div style={{ maxWidth: max, margin: "0 auto", padding: "32px 40px 80px", animation: "leiloe-fadein 0.3s ease" }}>
      <button onClick={onBack} style={{
        display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 28,
        background: "transparent", border: "1px solid var(--border-2)", color: "var(--text-dim)",
        borderRadius: 999, padding: "7px 14px", fontSize: 13, cursor: "pointer",
      }}>
        <Icon.arrowL size={13} /> Voltar
      </button>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--accent-ink)", marginBottom: 14 }}>{overline}</div>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 48, lineHeight: 1.05, margin: "0 0 16px", letterSpacing: "-0.5px", fontWeight: 400 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 18, lineHeight: 1.6, color: "var(--text-dim)", margin: 0, maxWidth: 620, textWrap: "pretty" }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, ...style }}>{children}</div>;
}

function Lead({ children }) {
  return <p style={{ fontSize: 16.5, lineHeight: 1.72, color: "var(--text-dim)", marginTop: 0, textWrap: "pretty" }}>{children}</p>;
}

// =====================================================================
// QUEM SOMOS
// =====================================================================
function QuemSomos({ onBack, onTour }) {
  return (
    <PageShell overline="Quem somos" title={<>Leilão não precisa<br/>ser bicho de sete cabeças.</>} subtitle="Nascemos pra tirar o juridiquês do caminho entre você e um imóvel ou carro abaixo do preço de mercado." onBack={onBack}>
      <Lead>
        O Leiloaê começou com uma frustração simples: editais escritos pra advogado, prazos confusos e taxas que ninguém explica. A gente traduz tudo isso pro português — com tooltips, simulador de custo total e um primeiro lance que pode ser cancelado em 24h.
      </Lead>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, margin: "36px 0 44px" }}>
        {[
          { n: "2023", l: "Fundado em São Paulo" },
          { n: "+8.000", l: "Lotes já explicados" },
          { n: "47 dias", l: "Média até a chave na mão" },
        ].map(s => (
          <Card key={s.l} style={{ padding: "22px 24px" }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 38, lineHeight: 1, color: "var(--accent-ink)" }}>{s.n}</div>
            <div style={{ fontSize: 13, color: "var(--text-mute)", marginTop: 8 }}>{s.l}</div>
          </Card>
        ))}
      </div>

      <h2 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 400, margin: "0 0 20px" }}>No que acreditamos</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          { t: "Português, não juridiquês", b: "Toda palavra técnica vira um tooltip. Se a gente não consegue explicar, a gente reescreve." },
          { t: "Sem surpresa no custo", b: "Comissão, ITBI, registro — tudo somado antes do lance. O preço da tela é o preço de verdade." },
          { t: "Começar sem medo", b: "Seu primeiro lance tem 24h de arrependimento, sem multa. Pra você aprender fazendo." },
        ].map(v => (
          <div key={v.t} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", marginTop: 9, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{v.t}</div>
              <div style={{ fontSize: 14.5, color: "var(--text-dim)", lineHeight: 1.6 }}>{v.b}</div>
            </div>
          </div>
        ))}
      </div>

      <Card style={{ marginTop: 40, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Primeira vez em leilão?</div>
          <div style={{ fontSize: 14, color: "var(--text-dim)" }}>O tour de 5 passos explica como tudo funciona em 2 minutos.</div>
        </div>
        <Button variant="primary" onClick={onTour} iconRight={<Icon.arrowR />}>Fazer o tour</Button>
      </Card>
    </PageShell>
  );
}

// =====================================================================
// CARREIRAS
// =====================================================================
function Carreiras({ onBack }) {
  const roles = [
    { title: "Product Designer Sênior", area: "Design", place: "São Paulo · Híbrido" },
    { title: "Engenheiro(a) Back-end (Go)", area: "Engenharia", place: "Remoto · Brasil" },
    { title: "Analista de Leilões Jurídicos", area: "Operações", place: "São Paulo · Presencial" },
    { title: "Especialista em Atendimento", area: "Suporte", place: "Remoto · Brasil" },
    { title: "Redator(a) — Conteúdo & Glossário", area: "Marketing", place: "Remoto · Brasil" },
  ];
  const apply = (r) => window.dispatchEvent(new CustomEvent("leiloe:toast", { detail: `Candidatura para ${r.title} — em breve!` }));
  return (
    <PageShell overline="Carreiras" title="Venha traduzir leilão pro Brasil." subtitle="Somos um time pequeno e obcecado em deixar o complicado simples. Se isso te anima, dá uma olhada nas vagas abertas." onBack={onBack}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 36 }}>
        {[
          { t: "100% transparente", b: "Faixas salariais públicas internamente." },
          { t: "Trabalho flexível", b: "Remoto-first, com encontros em SP." },
          { t: "Equity desde o dia 1", b: "Todo mundo é dono de um pedaço." },
        ].map(p => (
          <Card key={p.t} style={{ flex: "1 1 200px", padding: "18px 20px" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>{p.t}</div>
            <div style={{ fontSize: 13.5, color: "var(--text-mute)", lineHeight: 1.5 }}>{p.b}</div>
          </Card>
        ))}
      </div>

      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-mute)", marginBottom: 14 }}>{roles.length} vagas abertas</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {roles.map(r => (
          <button key={r.title} onClick={() => apply(r)} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, width: "100%", textAlign: "left",
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 22px", cursor: "pointer",
            transition: "border-color 0.15s ease", color: "inherit",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            <div>
              <div style={{ fontSize: 16.5, fontWeight: 500, marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-mute)" }}>{r.area} · {r.place}</div>
            </div>
            <Icon.arrowR size={16} />
          </button>
        ))}
      </div>
    </PageShell>
  );
}

// =====================================================================
// IMPRENSA
// =====================================================================
function Imprensa({ onBack }) {
  const press = [
    { outlet: "Folha de S.Paulo", quote: "A startup que quer descomplicar os leilões judiciais.", when: "Mar 2025" },
    { outlet: "Exame", quote: "Como o Leiloaê coloca o ITBI na conta antes do lance.", when: "Jan 2025" },
    { outlet: "InfoMoney", quote: "Imóveis abaixo do mercado, sem o medo do edital.", when: "Nov 2024" },
  ];
  return (
    <PageShell overline="Imprensa" title="Sala de imprensa." subtitle="Materiais, dados e contato pra quem quer falar sobre o Leiloaê." onBack={onBack}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 40 }}>
        <Card>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Contato de imprensa</div>
          <div style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.6 }}>imprensa@leiloae.com.br<br/>Resposta em até 1 dia útil.</div>
        </Card>
        <Card style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Kit de marca</div>
            <div style={{ fontSize: 14, color: "var(--text-mute)", lineHeight: 1.6, marginBottom: 14 }}>Logos, cores e fotos em alta resolução.</div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent("leiloe:toast", { detail: "Download do kit — em breve!" }))} icon={<Icon.book size={14} />}>Baixar kit</Button>
        </Card>
      </div>

      <h2 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 400, margin: "0 0 20px" }}>Na mídia</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {press.map(p => (
          <div key={p.outlet} style={{ display: "flex", gap: 18, alignItems: "flex-start", padding: "18px 22px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
            <div style={{ minWidth: 150 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{p.outlet}</div>
              <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 2 }}>{p.when}</div>
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontStyle: "italic", color: "var(--text-dim)", lineHeight: 1.4 }}>“{p.quote}”</div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

// =====================================================================
// GLOSSÁRIO
// =====================================================================
function GlossarioPage({ onBack }) {
  const [q, setQ] = useStateP("");
  const terms = useMemoP(() => {
    const all = Object.keys(GLOSSARY).sort((a, b) => a.localeCompare(b, "pt"));
    if (!q.trim()) return all;
    const n = q.trim().toLowerCase();
    return all.filter(t => t.toLowerCase().includes(n) || GLOSSARY[t].toLowerCase().includes(n));
  }, [q]);

  return (
    <PageShell overline="Glossário" title="O juridiquês, traduzido." subtitle="Toda palavra que aparece num edital, explicada em português de gente." onBack={onBack} max={760}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 999, padding: "12px 18px", marginBottom: 28, color: "var(--text-mute)" }}>
        <Icon.search size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar termo… (ex: praça, ITBI, matrícula)"
          style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 15, flex: 1 }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {terms.map(t => (
          <div key={t} style={{ padding: "18px 22px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, textTransform: "capitalize" }}>{t}</div>
            <div style={{ fontSize: 14.5, color: "var(--text-dim)", lineHeight: 1.6 }}>{GLOSSARY[t]}</div>
          </div>
        ))}
        {terms.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-mute)" }}>Nenhum termo encontrado pra “{q}”.</div>
        )}
      </div>
    </PageShell>
  );
}

// =====================================================================
// BLOG
// =====================================================================
function BlogPage({ onBack }) {
  const featured = { cat: "Guia", title: "Como ler um edital de leilão sem entrar em pânico", read: "8 min", excerpt: "Os 6 campos que realmente importam — e o que você pode ignorar com segurança." };
  const posts = [
    { cat: "Imóveis", title: "1ª ou 2ª praça: quando vale a pena esperar o desconto", read: "5 min" },
    { cat: "Custos", title: "ITBI, comissão e registro: a conta completa de um arremate", read: "6 min" },
    { cat: "Veículos", title: "Carro de leilão vale a pena? Checklist antes do lance", read: "7 min" },
    { cat: "Jurídico", title: "Imóvel ocupado: como funciona a desocupação", read: "9 min" },
    { cat: "História real", title: "Comprei meu primeiro apê em leilão aos 26", read: "4 min" },
    { cat: "Guia", title: "Matrícula do imóvel: o que checar antes de dar lance", read: "6 min" },
  ];
  const open = (t) => window.dispatchEvent(new CustomEvent("leiloe:toast", { detail: "Artigo completo — em breve!" }));
  return (
    <PageShell overline="Blog" title="Leilão explicado, post a post." subtitle="Guias, histórias reais e o passo a passo que ninguém te conta sobre arrematar imóvel e carro." onBack={onBack} max={1040}>
      <button onClick={() => open(featured.title)} style={{
        display: "block", width: "100%", textAlign: "left", cursor: "pointer", marginBottom: 28,
        background: "linear-gradient(135deg, var(--accent-dim) 0%, var(--surface) 70%)",
        border: "1px solid var(--border-2)", borderRadius: "var(--radius-lg)", padding: 32, color: "inherit",
      }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent-ink)" }}>{featured.cat} · {featured.read}</span>
        <div style={{ fontFamily: "var(--serif)", fontSize: 32, fontWeight: 400, lineHeight: 1.15, margin: "12px 0 10px", maxWidth: 640 }}>{featured.title}</div>
        <div style={{ fontSize: 15.5, color: "var(--text-dim)", maxWidth: 560, lineHeight: 1.55 }}>{featured.excerpt}</div>
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {posts.map(p => (
          <button key={p.title} onClick={() => open(p.title)} style={{
            display: "flex", flexDirection: "column", gap: 12, textAlign: "left", cursor: "pointer", minHeight: 168,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "22px 22px", color: "inherit",
            transition: "border-color 0.15s ease",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent-ink)" }}>{p.cat}</span>
            <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.3, flex: 1 }}>{p.title}</div>
            <span style={{ fontSize: 12.5, color: "var(--text-mute)" }}>{p.read} de leitura</span>
          </button>
        ))}
      </div>
    </PageShell>
  );
}

// =====================================================================
// TERMOS DE USO + PRIVACIDADE (shared legal layout)
// =====================================================================
function DocSection({ n, title, summary, children }) {
  return (
    <div style={{ paddingBottom: 28, marginBottom: 28, borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", gap: 14, alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent-ink)" }}>{n}</span>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{title}</h2>
      </div>
      {summary && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--accent-dim)", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-ink)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2, whiteSpace: "nowrap" }}>Em miúdos</span>
          <span style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.55 }}>{summary}</span>
        </div>
      )}
      <div style={{ fontSize: 14.5, color: "var(--text-dim)", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function TermosPage({ onBack }) {
  return (
    <PageShell overline="Termos de uso" title="Termos de uso." subtitle="Última atualização: 12 de fevereiro de 2025. Documento fictício, para fins de demonstração." onBack={onBack} max={740}>
      <DocSection n="01" title="O que é o Leiloaê" summary="Somos uma vitrine que organiza e explica leilões — não somos o leiloeiro.">
        O Leiloaê é uma plataforma que reúne, traduz e organiza informações de leilões judiciais e extrajudiciais de imóveis e veículos. A venda em si é conduzida pelo leiloeiro ou órgão responsável indicado em cada lote.
      </DocSection>
      <DocSection n="02" title="Cadastro e verificação" summary="Você precisa ser maior de 18 anos e dar dados verdadeiros.">
        Para dar lances é necessário cadastro com CPF válido e verificação de identidade. Você é responsável por manter seus dados corretos e pela segurança da sua conta.
      </DocSection>
      <DocSection n="03" title="Lances e o arrependimento de 24h" summary="Seu primeiro lance pode ser cancelado em 24h, sem multa. Os demais valem de verdade.">
        Lances são ofertas firmes. Como exceção, o seu primeiro lance na plataforma pode ser cancelado em até 24 horas, sem custo. Após esse prazo, ou nos lances seguintes, valem as regras do edital de cada lote.
      </DocSection>
      <DocSection n="04" title="Taxas" summary="A gente sempre mostra o custo total antes do lance.">
        Sobre o valor do arremate podem incidir comissão do leiloeiro, ITBI, custas de registro e a taxa de serviço do Leiloaê. Todos esses valores são apresentados no simulador antes da confirmação. Veja a Tabela de taxas.
      </DocSection>
      <DocSection n="05" title="Responsabilidades" summary="Confira o edital e a matrícula. A decisão de arrematar é sua.">
        O Leiloaê se esforça pela exatidão das informações, mas o documento oficial é sempre o edital. Recomendamos a leitura do edital e da matrícula antes de qualquer lance.
      </DocSection>
    </PageShell>
  );
}

function PrivacidadePage({ onBack }) {
  return (
    <PageShell overline="Privacidade" title="Política de privacidade." subtitle="Última atualização: 12 de fevereiro de 2025. Documento fictício, para fins de demonstração." onBack={onBack} max={740}>
      <DocSection n="01" title="Dados que coletamos" summary="Só o necessário pra você dar lances e a gente te avisar do que importa.">
        Coletamos dados de cadastro (nome, CPF, contato), dados de verificação de identidade e dados de uso (lotes vistos, lances, favoritos) para operar a plataforma.
      </DocSection>
      <DocSection n="02" title="Como usamos" summary="Pra te deixar dar lance, te notificar e melhorar o produto.">
        Usamos seus dados para viabilizar lances, enviar avisos que você escolheu receber (ex.: lance superado, leilão encerrando) e melhorar a experiência. Não vendemos seus dados.
      </DocSection>
      <DocSection n="03" title="Compartilhamento" summary="Compartilhamos o mínimo com leiloeiros e parceiros de verificação.">
        Compartilhamos dados estritamente necessários com o leiloeiro responsável pelo lote arrematado e com parceiros de verificação de identidade e pagamento.
      </DocSection>
      <DocSection n="04" title="Seus direitos (LGPD)" summary="Você pode acessar, corrigir e apagar seus dados quando quiser.">
        Conforme a LGPD, você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados a qualquer momento pelo e-mail privacidade@leiloae.com.br.
      </DocSection>
      <DocSection n="05" title="Cookies" summary="Usamos cookies pra manter você logado e entender o uso.">
        Utilizamos cookies essenciais (para login e segurança) e analíticos (para entender o uso de forma agregada). Você pode gerenciar preferências no seu navegador.
      </DocSection>
    </PageShell>
  );
}

// =====================================================================
// TABELA DE TAXAS
// =====================================================================
function TaxasPage({ onBack }) {
  const rows = [
    { item: "Comissão do leiloeiro", val: "5%", base: "sobre o valor do arremate", who: "Leiloeiro oficial" },
    { item: "ITBI", val: "3%", base: "sobre o valor do arremate (SP)", who: "Prefeitura" },
    { item: "Registro em cartório", val: "~1,5%", base: "varia por faixa de valor", who: "Cartório de Registro" },
    { item: "Taxa de serviço Leiloaê", val: "1,5%", base: "sobre o valor do arremate", who: "Leiloaê" },
    { item: "Arrependimento (1º lance)", val: "Grátis", base: "cancelamento em até 24h", who: "—" },
  ];
  const ex = window.simulateCost ? window.simulateCost(150000) : null;
  return (
    <PageShell overline="Termos e taxas" title="Tabela de taxas." subtitle="Tudo que entra na conta de um arremate — sem letra miúda. Percentuais ilustrativos para o estado de São Paulo." onBack={onBack} max={820}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: 32 }}>
        {rows.map((r, i) => (
          <div key={r.item} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.8fr 1.4fr", gap: 16, alignItems: "center", padding: "16px 22px", borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{r.item}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-mute)", marginTop: 2 }}>{r.base}</div>
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--accent-ink)" }}>{r.val}</div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", textAlign: "right" }}>{r.who}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 400, margin: "0 0 16px" }}>Exemplo: arremate de R$ 150.000</h2>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {[
          ["Valor do arremate", "R$ 150.000"],
          ["Comissão do leiloeiro (5%)", "R$ 7.500"],
          ["ITBI (3%)", "R$ 4.500"],
          ["Registro (~1,5%)", "R$ 2.250"],
          ["Taxa Leiloaê (1,5%)", "R$ 2.250"],
        ].map((r, i) => (
          <div key={r[0]} style={{ display: "flex", justifyContent: "space-between", padding: "13px 22px", borderBottom: "1px solid var(--border)", fontSize: 14.5, color: "var(--text-dim)" }}>
            <span>{r[0]}</span><span style={{ fontFamily: "var(--mono)" }}>{r[1]}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 22px", background: "var(--accent-dim)", fontSize: 16, fontWeight: 600 }}>
          <span>Custo total estimado</span><span style={{ fontFamily: "var(--mono)", color: "var(--accent-ink)" }}>R$ 166.500</span>
        </div>
      </Card>
      <p style={{ fontSize: 13, color: "var(--text-mute)", marginTop: 16, lineHeight: 1.6 }}>Valores ilustrativos e fictícios. As taxas reais constam sempre no edital de cada lote e são recalculadas no simulador antes de cada lance.</p>
    </PageShell>
  );
}

// =====================================================================
// CENTRAL DE AJUDA (FAQ)
// =====================================================================
function AjudaPage({ onBack, onOpenPage }) {
  const groups = [
    {
      cat: "Primeiros passos",
      items: [
        { q: "Preciso ser advogado pra arrematar?", a: "Não. Qualquer pessoa maior de 18 anos com CPF válido pode dar lances. A gente traduz todo o juridiquês em tooltips." },
        { q: "Como faço meu primeiro lance?", a: "Escolha um lote, toque em ‘Dar lance’ e confirme. Seu primeiro lance pode ser cancelado em até 24h, sem multa." },
      ],
    },
    {
      cat: "Pagamento e taxas",
      items: [
        { q: "Quais taxas eu pago além do lance?", a: "Comissão do leiloeiro, ITBI, registro e a taxa de serviço do Leiloaê. Tudo aparece somado no simulador antes de você confirmar." },
        { q: "Como pago o arremate?", a: "Pelos meios indicados no edital do lote — geralmente boleto, PIX ou transferência, dentro do prazo definido." },
      ],
    },
    {
      cat: "Depois do arremate",
      items: [
        { q: "Quando recebo as chaves?", a: "Depende do lote. Imóveis desocupados saem em ~47 dias na média; ocupados podem exigir desocupação judicial." },
        { q: "E se o imóvel estiver ocupado?", a: "O lote informa a situação de ocupação. Quando há ocupante, pode ser necessária ação de desocupação — explicamos o passo a passo no Glossário." },
      ],
    },
  ];
  const [open, setOpen] = useStateP("0-0");
  return (
    <PageShell overline="Suporte" title="Central de ajuda." subtitle="As dúvidas mais comuns, respondidas sem enrolação. Não achou? Fale com a gente." onBack={onBack} max={780}>
      {groups.map((g, gi) => (
        <div key={g.cat} style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-mute)", marginBottom: 12 }}>{g.cat}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.items.map((it, ii) => {
              const key = `${gi}-${ii}`;
              const isOpen = open === key;
              return (
                <div key={key} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                  <button onClick={() => setOpen(isOpen ? null : key)} style={{
                    width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
                    padding: "16px 20px", background: "transparent", border: "none", cursor: "pointer", color: "inherit", textAlign: "left",
                  }}>
                    <span style={{ fontSize: 15.5, fontWeight: 500 }}>{it.q}</span>
                    <span style={{ fontSize: 20, color: "var(--text-mute)", transform: isOpen ? "rotate(45deg)" : "none", transition: "transform 0.2s ease", lineHeight: 1 }}>+</span>
                  </button>
                  {isOpen && <div style={{ padding: "0 20px 18px", fontSize: 14.5, color: "var(--text-dim)", lineHeight: 1.65 }}>{it.a}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Ainda com dúvida?</div>
          <div style={{ fontSize: 14, color: "var(--text-dim)" }}>Nosso time responde em português, de gente.</div>
        </div>
        <Button variant="primary" onClick={() => onOpenPage("contato")} iconRight={<Icon.arrowR />}>Fale com a gente</Button>
      </Card>
    </PageShell>
  );
}

// =====================================================================
// FALE COM A GENTE (contato)
// =====================================================================
function ContatoPage({ onBack }) {
  const [form, setForm] = useStateP({ nome: "", email: "", assunto: "Dúvida sobre um lote", msg: "" });
  const [sent, setSent] = useStateP(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    setSent(true);
    window.dispatchEvent(new CustomEvent("leiloe:toast", { detail: "Mensagem enviada! Respondemos em até 1 dia útil." }));
  };
  const field = { background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 12, padding: "13px 16px", fontSize: 15, color: "var(--text)", outline: "none", width: "100%" };

  return (
    <PageShell overline="Suporte" title="Fale com a gente." subtitle="Dúvida, sugestão ou problema? Escolha o canal ou mande uma mensagem direto por aqui." onBack={onBack} max={900}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 28, alignItems: "start" }}>
        {/* channels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { icon: <Icon.whatsapp size={18} />, t: "WhatsApp", d: "Seg a sex, 9h–18h", go: () => { window.open("https://wa.me/5511999999999", "_blank"); } },
            { icon: <Icon.bell size={16} />, t: "E-mail", d: "oi@leiloae.com.br", go: () => window.dispatchEvent(new CustomEvent("leiloe:toast", { detail: "oi@leiloae.com.br" })) },
            { icon: <Icon.user size={16} />, t: "Imprensa", d: "imprensa@leiloae.com.br", go: () => window.dispatchEvent(new CustomEvent("leiloe:toast", { detail: "imprensa@leiloae.com.br" })) },
          ].map(c => (
            <button key={c.t} onClick={c.go} style={{
              display: "flex", gap: 14, alignItems: "center", textAlign: "left", cursor: "pointer",
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", color: "inherit",
            }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--accent-dim)", color: "var(--accent-ink)", flexShrink: 0 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{c.t}</div>
                <div style={{ fontSize: 13, color: "var(--text-mute)" }}>{c.d}</div>
              </div>
            </button>
          ))}
        </div>

        {/* form */}
        <Card>
          {sent ? (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--success-dim)", color: "var(--success-ink)", display: "grid", placeItems: "center", margin: "0 auto 18px" }}><Icon.check size={26} /></div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 26, marginBottom: 8 }}>Recebemos sua mensagem!</div>
              <div style={{ fontSize: 14.5, color: "var(--text-dim)", marginBottom: 22 }}>A gente responde em até 1 dia útil, em português de gente.</div>
              <Button variant="ghost" onClick={() => { setSent(false); setForm({ nome: "", email: "", assunto: "Dúvida sobre um lote", msg: "" }); }}>Enviar outra</Button>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12.5, color: "var(--text-mute)", display: "block", marginBottom: 6 }}>Nome</label>
                  <input required value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Seu nome" style={field} />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, color: "var(--text-mute)", display: "block", marginBottom: 6 }}>E-mail</label>
                  <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="voce@email.com" style={field} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12.5, color: "var(--text-mute)", display: "block", marginBottom: 6 }}>Assunto</label>
                <select value={form.assunto} onChange={(e) => set("assunto", e.target.value)} style={field}>
                  <option>Dúvida sobre um lote</option>
                  <option>Pagamento e taxas</option>
                  <option>Conta e verificação</option>
                  <option>Sou vendedor / leiloeiro</option>
                  <option>Outro assunto</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12.5, color: "var(--text-mute)", display: "block", marginBottom: 6 }}>Mensagem</label>
                <textarea required value={form.msg} onChange={(e) => set("msg", e.target.value)} rows={5} placeholder="Conta pra gente o que houve…" style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
              </div>
              <Button type="submit" variant="primary" full iconRight={<Icon.arrowR />}>Enviar mensagem</Button>
            </form>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

// =====================================================================
// ROUTER
// =====================================================================
function PageScreen({ pageId, onNavigate, onOpenPage, onTour }) {
  const onBack = () => onNavigate("home");
  switch (pageId) {
    case "quem-somos":   return <QuemSomos onBack={onBack} onTour={onTour} />;
    case "carreiras":    return <Carreiras onBack={onBack} />;
    case "imprensa":     return <Imprensa onBack={onBack} />;
    case "glossario":    return <GlossarioPage onBack={onBack} />;
    case "blog":         return <BlogPage onBack={onBack} />;
    case "termos":       return <TermosPage onBack={onBack} />;
    case "privacidade":  return <PrivacidadePage onBack={onBack} />;
    case "taxas":        return <TaxasPage onBack={onBack} />;
    case "ajuda":        return <AjudaPage onBack={onBack} onOpenPage={onOpenPage} />;
    case "contato":      return <ContatoPage onBack={onBack} />;
    default:             return <QuemSomos onBack={onBack} onTour={onTour} />;
  }
}

Object.assign(window, { Footer, PageScreen });
