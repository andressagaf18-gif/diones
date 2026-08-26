export const finderTheme = {
  colors: {
    bg: "#08111F",
    bgSoft: "#0D1728",
    panel: "#101C2F",
    panelSoft: "#15243A",
    panelLight: "#F6F8FC",
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
      "radial-gradient(circle at top right, rgba(79,124,255,.16), transparent 28%), linear-gradient(180deg,#08111F 0%,#0B1526 100%)",
  },

  shell: {
    display: "grid",
    gridTemplateColumns: "260px minmax(0,1fr)",
    minHeight: "100vh",
  },

  content: {
    minWidth: 0,
    background: "#F6F8FC",
    borderTopLeftRadius: 26,
    borderBottomLeftRadius: 26,
    overflow: "hidden",
  },
};
