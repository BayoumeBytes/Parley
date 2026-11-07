// Apply before styles and Angular load, so a saved dark theme never flashes light.
(() => {
  let preference = null;
  try {
    const saved = localStorage.getItem('parley-theme');
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {
    // Private/blocked storage still allows the system preference to work.
  }
  const theme =
    preference ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#141917' : '#f6f6f2';
})();
