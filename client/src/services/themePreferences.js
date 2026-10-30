const GLOBAL_THEME_KEY = "smartpos-theme";
const VALID_THEMES = new Set(["light", "dark", "system"]);

const getCurrentUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const getUserThemeKey = (user) =>
  user?.id ? `smartpos-theme-${user.id}` : null;

export const getThemePreference = (user = getCurrentUser()) => {
  const userThemeKey = getUserThemeKey(user);
  if (userThemeKey) {
    const savedUserTheme = localStorage.getItem(userThemeKey);
    if (VALID_THEMES.has(savedUserTheme)) return savedUserTheme;
  }

  if (user?.role === "CASHIER" && user.id) {
    try {
      const cashierSettings = JSON.parse(
        localStorage.getItem(`smartpos-cashier-settings-${user.id}`) || "{}"
      );
      if (VALID_THEMES.has(cashierSettings.theme)) return cashierSettings.theme;
    } catch {
      // Fall through to the legacy shared preference.
    }
  }

  const savedTheme = localStorage.getItem(GLOBAL_THEME_KEY);
  return VALID_THEMES.has(savedTheme) ? savedTheme : "light";
};

export const saveThemePreference = (theme, user = getCurrentUser()) => {
  if (!VALID_THEMES.has(theme)) {
    throw new Error(`Invalid theme preference: ${theme}`);
  }

  localStorage.setItem(GLOBAL_THEME_KEY, theme);
  const userThemeKey = getUserThemeKey(user);
  if (userThemeKey) localStorage.setItem(userThemeKey, theme);
};
