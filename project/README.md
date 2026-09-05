# Leiloaê

"Leilão sem juridiquês" — marketplace de leilões de imóveis e veículos em São Paulo,
feito para quem nunca participou de um leilão.

React + Vite. Dados são mockados em `src/data.js` (8 imóveis + 6 veículos, 5 vendedores,
glossário); não há back-end.

## Rodando

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção em dist/
npm run preview  # serve o build
```

## Estrutura

| Arquivo | Conteúdo |
| --- | --- |
| `src/App.jsx` | Estado global (rota, categoria, tema, lotes, modais) e as rotas |
| `src/data.js` | Lotes, vendedores, glossário, formatadores e o simulador de custo |
| `src/nav.jsx` | Header com ticker animado, menu da conta e painel de notificações |
| `src/components.jsx` | Primitivos compartilhados (Button, Badge, LotCard, Countdown, GlossaryTerm, Icon) |
| `src/screens.jsx` | Home, tour de iniciante, listagem e Meus lances |
| `src/lotdetail.jsx` | Página do lote (galeria, abas, simulador) e tela de arremate |
| `src/bidmodal.jsx` | Modal de lance em 3 passos |
| `src/compare.jsx` | Barra e modal de comparação (até 4 lotes) |
| `src/saved.jsx`, `src/account.jsx`, `src/accountpages.jsx` | Favoritos e área da conta |
| `src/pages.jsx` | Rodapé e páginas institucionais |
| `src/index.css` | Tokens de tema (claro/escuro) e keyframes |

Os tokens de cor vivem em `src/index.css`; o tema claro sobrescreve apenas as variáveis
necessárias em `:root[data-theme="light"]`, e a escolha persiste em `localStorage`.
