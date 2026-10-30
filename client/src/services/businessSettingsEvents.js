const BUSINESS_SETTINGS_UPDATED = "smartpos:business-settings-updated";

export const publishBusinessSettingsUpdated = (settings) => {
  window.dispatchEvent(new CustomEvent(BUSINESS_SETTINGS_UPDATED, {
    detail: settings,
  }));
};

export const subscribeToBusinessSettings = (callback) => {
  const handleUpdate = (event) => callback(event.detail);
  window.addEventListener(BUSINESS_SETTINGS_UPDATED, handleUpdate);

  return () => {
    window.removeEventListener(BUSINESS_SETTINGS_UPDATED, handleUpdate);
  };
};
