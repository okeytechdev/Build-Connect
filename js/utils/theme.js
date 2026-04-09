const THEME_STORAGE_KEY = 'build.connect.theme';
const DEFAULT_THEME = 'light';

export function getInitialTheme() {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
  } catch {
    return DEFAULT_THEME;
  }

  return DEFAULT_THEME;
}

export function applyTheme(theme) {
  document.body.dataset.theme = theme;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // noop
  }
}

export function toggleTheme() {
  const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  return nextTheme;
}

export function isDarkTheme() {
  return document.body.dataset.theme === 'dark';
}
