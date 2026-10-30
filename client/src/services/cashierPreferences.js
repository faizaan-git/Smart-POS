const defaultPreferences = {
  defaultPaymentMethod: "Cash",
  confirmSale: false,
  theme: "light",
};

const getStorageKey = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem("user") || "null");
    return user?.id ? `smartpos-cashier-settings-${user.id}` : null;
  } catch {
    return null;
  }
};

export const getCashierPreferences = () => {
  const key = getStorageKey();

  if (!key) {
    return defaultPreferences;
  }

  try {
    return {
      ...defaultPreferences,
      ...JSON.parse(localStorage.getItem(key) || "{}"),
    };
  } catch {
    return defaultPreferences;
  }
};

export const saveCashierPreferences = (preferences) => {
  const key = getStorageKey();

  if (!key) {
    return false;
  }

  localStorage.setItem(key, JSON.stringify(preferences));
  return true;
};