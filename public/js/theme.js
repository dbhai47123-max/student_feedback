// Loaded in <head> so the saved theme applies before the page paints (no flash).
(function () {
  try {
    var saved = localStorage.getItem('fb_theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
  } catch (e) { /* storage unavailable: follow the system theme */ }
})();
