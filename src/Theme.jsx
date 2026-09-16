export const finderTheme = {
  colors: {
    // Moldura do admin (barra lateral + topo) — tema escuro "vidro".
    bg: "#0A0E17",
    bgSoft: "#0D1728",
    panel: "#12172A",
    panelSoft: "#161C32",
    railBg: "#080B13",

    // Área de conteúdo (Clientes, Leads, Diagnósticos, Tributário...) —
    // continua clara: são dezenas de milhares de linhas já escritas
    // assumindo texto escuro (textDark) sobre fundo claro (panelLight).
    // Trocar isso exigiria revisar cada tela; por ora, a transformação
    // visual fica concentrada na moldura, que já é sempre nova.
    panelLight: "#F5F7FB",
    card: "#FFFFFF",

    text: "#EEF1F8",
    textDark: "#17233D",
    muted: "#8FA1BC",
    mutedDark: "#5B667A",

    border: "rgba(255,255,255,.08)",
    borderLight: "#E3E7EF",

    primary: "#4F7CFF",
    primarySoft: "#EAF0FF",
    cyan: "#16C7D9",
    cyanSoft: "#E7FBFD",
    coral: "#FF6B4A",
    coralSoft: "#FFF1EC",
    violet: "#8B6BFF",
    success: "#27C499",
    warning: "#F4B740",
    danger: "#EF5B5B",
    white: "#FFFFFF",

    gradient: "linear-gradient(135deg,#4F7CFF,#8B6BFF 55%,#FF6B4A)",
  },

  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
  },
};

const C = finderTheme.colors;

export const finderStyles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top right, rgba(79,124,255,.15), transparent 26%), linear-gradient(180deg,#07111F 0%,#0A1424 100%)",
  },

  shell: {
    display: "grid",
    gridTemplateColumns:
      "250px minmax(0,1fr)",
    minHeight: "100vh",
  },

  content: {
    minWidth: 0,
    background: C.panelLight,
    borderTopLeftRadius: 26,
    borderBottomLeftRadius: 26,
    overflow: "hidden",
    boxShadow:
      "-10px 0 30px rgba(0,0,0,.06)",
  },
};

// Card "de vidro" para quem for construir novas telas já no padrão escuro
// (ex.: um Dashboard futuro). Não é usado pelas telas existentes.
export const glassCard = {
  background: `linear-gradient(165deg, ${C.panel}, ${C.panelSoft})`,
  border: `1px solid ${C.border}`,
  borderRadius: 22,
  boxShadow: "0 20px 44px rgba(0,0,0,.28)",
  color: C.text,
};

export const finderGlobalCss = `
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: ${C.panelLight};
  }

  button,
  input,
  select,
  textarea {
    transition:
      border-color .18s ease,
      box-shadow .18s ease,
      transform .18s ease,
      background .18s ease;
  }

  button:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  input:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: #4F7CFF !important;
    box-shadow: 0 0 0 3px rgba(79,124,255,.10);
  }

  @media (max-width: 1100px) {
    .finder-search-global {
      display: none !important;
    }
  }

  @media (max-width: 880px) {
    .finder-sidebar {
      position: static !important;
      height: auto !important;
    }

    .finder-topbar {
      position: static !important;
    }
  }
`;
