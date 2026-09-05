import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Fontes auto-hospedadas: sem requisição a terceiros no carregamento — o CSS
// externo do Google era bloqueante e enviava o IP de cada visitante (FRONT-014).
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/funnel-sans/300.css";
import "@fontsource/funnel-sans/400.css";
import "@fontsource/funnel-sans/500.css";
import "@fontsource/funnel-sans/600.css";
import "@fontsource/funnel-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
