export const finderTheme = {
  colors: {
    bg: "#07111F",
    bgSoft: "#0D1728",
    panel: "#101C2F",
    panelSoft: "#15243A",
    panelLight: "#F5F7FB",
    card: "#FFFFFF",
    text: "#E8EEF8",
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
    success: "#27C499",
    warning: "#F4B740",
    danger: "#EF5B5B",
    white: "#FFFFFF",
  },

  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
  },
};

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
    background: "#F5F7FB",
    borderTopLeftRadius: 26,
    borderBottomLeftRadius: 26,
    overflow: "hidden",
    boxShadow:
      "-10px 0 30px rgba(0,0,0,.06)",
  },
};

export const finderGlobalCss = `
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #F5F7FB;
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
