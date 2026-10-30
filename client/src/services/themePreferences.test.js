import assert from "node:assert/strict";
import test from "node:test";
import { getThemePreference, saveThemePreference } from "./themePreferences.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
};

test("persists a user's theme across login sessions", () => {
  const previousLocalStorage = globalThis.localStorage;
  const previousSessionStorage = globalThis.sessionStorage;
  globalThis.localStorage = createStorage();
  globalThis.sessionStorage = createStorage();

  try {
    const user = { id: 42, role: "MANAGER" };
    saveThemePreference("dark", user);
    assert.equal(getThemePreference(user), "dark");

    globalThis.sessionStorage.setItem("user", JSON.stringify(user));
    assert.equal(getThemePreference(), "dark");
    globalThis.sessionStorage.setItem("user", "");
    assert.equal(getThemePreference(user), "dark");
  } finally {
    globalThis.localStorage = previousLocalStorage;
    globalThis.sessionStorage = previousSessionStorage;
  }
});

test("restores a cashier's existing saved theme", () => {
  const previousLocalStorage = globalThis.localStorage;
  const previousSessionStorage = globalThis.sessionStorage;
  globalThis.localStorage = createStorage();
  globalThis.sessionStorage = createStorage();

  try {
    const user = { id: 7, role: "CASHIER" };
    globalThis.localStorage.setItem(
      "smartpos-cashier-settings-7",
      JSON.stringify({ theme: "dark" })
    );

    assert.equal(getThemePreference(user), "dark");
    saveThemePreference(getThemePreference(user), user);
    assert.equal(globalThis.localStorage.getItem("smartpos-theme-7"), "dark");
  } finally {
    globalThis.localStorage = previousLocalStorage;
    globalThis.sessionStorage = previousSessionStorage;
  }
});
