const themeKey = "absign-theme";
const preferredTheme = localStorage.getItem(themeKey)
  || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(themeKey, theme);
  const button = document.querySelector("#themeToggle");
  if (button) {
    const dark = theme === "dark";
    button.setAttribute("aria-label", dark ? "Activar tema claro" : "Activar tema oscuro");
    button.querySelector(".theme-icon").textContent = dark ? "☀" : "☾";
    button.querySelector(".theme-label").textContent = dark ? "Claro" : "Oscuro";
  }
}

applyTheme(preferredTheme);
addEventListener("DOMContentLoaded", () => {
  applyTheme(document.documentElement.dataset.theme);
  document.querySelector("#themeToggle")?.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
});
