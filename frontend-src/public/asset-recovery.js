(function() {
  var reloadKey = '_bondly_asset_reload';
  window.addEventListener('error', function(e) {
    var t = e.target;
    if (!t || (t.tagName !== 'SCRIPT' && t.tagName !== 'LINK')) return;
    var src = t.src || t.href || '';
    if (src.indexOf('/assets/') === -1) return;
    if (sessionStorage.getItem(reloadKey)) return;
    sessionStorage.setItem(reloadKey, '1');
    location.reload(true);
  }, true);
  window.addEventListener('load', function() { sessionStorage.removeItem(reloadKey); });
})();
