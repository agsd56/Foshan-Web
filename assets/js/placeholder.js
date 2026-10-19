/* ==========================================================================
   图片占位回退（需在 <head> 中同步加载，先于任何 <img> 的 error 事件）
   页面中图片写成真实文件名，例如 assets/img/hero-foshan.jpg。
   文件尚不存在时，自动渲染一张同风格占位图；把真实图片按同名放入后刷新即可生效。
   ========================================================================== */
(function () {
  var FLAG = 'data-ph';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.phFallback = function (img) {
    if (!img || img.getAttribute(FLAG) === 'done') return;
    img.setAttribute(FLAG, 'done');

    var src = img.getAttribute('src') || '';
    var file = src.split('/').pop();
    var label = img.getAttribute('data-label') || '图片占位';
    var hint = img.getAttribute('data-hint') || '';
    var style = img.getAttribute('data-ph-style') || 'card';
    var svg;

    var grid =
      '<defs>' +
        '<pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">' +
          '<path d="M40 0H0V40" fill="none" stroke="#d8b45a" stroke-opacity="0.055"/>' +
        '</pattern>' +
        '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#161d1a"/>' +
          '<stop offset="1" stop-color="#0c100f"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<rect width="1200" height="675" fill="url(#bg)"/>' +
      '<rect width="1200" height="675" fill="url(#g)"/>';

    if (style === 'hero') {
      /* Hero 首屏：只留极淡的网格与右侧标注，不与标题争夺视线 */
      svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">' +
          grid +
          '<text x="1040" y="286" text-anchor="end" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="15" fill="#d8b45a" fill-opacity="0.5" letter-spacing="4">' + esc(label) + '</text>' +
          '<text x="1040" y="310" text-anchor="end" font-family="Consolas,monospace" font-size="10.5" fill="#8b948c" fill-opacity="0.55" letter-spacing="2">' + esc(file) + ' · ' + esc(hint) + '</text>' +
        '</svg>';
    } else {
      svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">' +
          grid +
          '<rect x="26" y="26" width="1148" height="623" fill="none" stroke="#d8b45a" stroke-opacity="0.2" stroke-dasharray="12 10"/>' +
          '<g fill="none" stroke="#d8b45a" stroke-opacity="0.5" stroke-width="2" transform="translate(600 250)">' +
            '<rect x="-38" y="-22" width="76" height="52" rx="3"/>' +
            '<path d="M-16 -22 L-10 -32 L10 -32 L16 -22"/>' +
            '<circle cx="0" cy="4" r="14"/>' +
          '</g>' +
          '<text x="600" y="360" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="23" fill="#d8b45a" fill-opacity="0.88" letter-spacing="5">' + esc(label) + '</text>' +
          '<text x="600" y="398" text-anchor="middle" font-family="Consolas,monospace" font-size="13" fill="#6d7871" letter-spacing="2">' + esc(file) + '</text>' +
          (hint
            ? '<text x="600" y="426" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="12" fill="#4f5852" letter-spacing="2">' + esc(hint) + '</text>'
            : '') +
          '<text x="600" y="596" text-anchor="middle" font-family="Consolas,monospace" font-size="10" fill="#3d4540" letter-spacing="4">PLACEHOLDER · REPLACE WITH REAL SCREENSHOT</text>' +
        '</svg>';
    }

    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    img.classList.add('is-placeholder');
    img.removeAttribute('srcset');
  };
})();
