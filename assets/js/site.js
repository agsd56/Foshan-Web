/* ==========================================================================
   站点内容渲染 —— 从 content/site.json 读取，供首页与相册页使用
   后台（admin.html）修改的就是这个文件。
   ========================================================================== */
(function () {
  'use strict';

  var page = document.body.getAttribute('data-page');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- 首页：城市卡片 ---------------- */
  function renderCities(data) {
    var grid = document.getElementById('cityGrid');
    if (!grid || !Array.isArray(data.cities)) return;

    var html = data.cities.map(function (c, i) {
      var feature = !!c.feature;
      var order = String(i + 1).padStart(2, '0');
      var tag = c.tag
        ? '<span class="tag' + (feature ? '' : ' tag--dim') + '">' + esc(c.tag) + '</span>'
        : '';

      var body = '';
      if (c.desc) {
        body = '<p class="city-desc">' + esc(c.desc) + '</p>';
      } else if (feature) {
        body = '<div class="tbd tbd--sm" style="margin:14px 0 18px;">' +
               '<b>城市介绍</b><span>CITY PROFILE · 待补充</span></div>';
      }

      return '' +
        '<article class="card city-card' + (feature ? ' city-card--feature' : '') + '">' +
          '<figure class="photo" style="margin:0;">' +
            '<img src="' + esc(c.image) + '" alt="' + esc(c.name) + '" ' +
              'data-label="' + esc(c.name) + ' · 城市照片" data-hint="建议 1200 × 675" ' +
              'onerror="phFallback(this)">' +
          '</figure>' +
          '<div class="city-card-body">' +
            '<div class="flex-between" style="gap:12px;">' +
              '<span class="city-order">' + order + ' · ' + esc(c.founded) + '</span>' +
              tag +
            '</div>' +
            '<h3 class="city-name">' + esc(c.name) + ' <em>' + esc(c.en) + '</em></h3>' +
            body +
            '<div class="city-meta">' +
              '<span>市长 <b>' + esc(c.mayor) + '</b></span>' +
              '<span>居民 <b>' + esc(c.residents) + '</b></span>' +
              '<span>区块 <b>' + esc(c.blocks) + '</b> / ' + esc(c.maxBlocks) + '</span>' +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('');

    grid.innerHTML = html;
  }

  /* ---------------- 相册页 ---------------- */
  function renderPhotos(data) {
    var wall = document.getElementById('photoWall');
    var empty = document.getElementById('photoEmpty');
    var count = document.getElementById('photoCount');
    if (!wall) return;

    var list = (data.photos || []).filter(function (p) { return p && p.src; });

    if (count) {
      count.textContent = list.length
        ? '共 ' + list.length + ' 张照片，点击可放大查看。'
        : '';
    }

    if (!list.length) {
      if (empty) empty.hidden = false;
      return;
    }

    wall.innerHTML = list.map(function (p, i) {
      return '' +
        '<figure class="ph-item" data-index="' + i + '">' +
          '<img src="' + esc(p.src) + '" alt="' + esc(p.title || '照片') + '" loading="lazy">' +
          '<figcaption>' +
            (p.title ? '<b>' + esc(p.title) + '</b>' : '') +
            (p.caption ? '<span>' + esc(p.caption) + '</span>' : '') +
          '</figcaption>' +
        '</figure>';
    }).join('');

    initLightbox(list);
  }

  /* ---------------- Lightbox ---------------- */
  function initLightbox(list) {
    var box = document.getElementById('lightbox');
    var img = document.getElementById('lbImage');
    var cap = document.getElementById('lbCaption');
    var wall = document.getElementById('photoWall');
    if (!box || !img) return;

    var current = 0;

    function show(i) {
      if (i < 0) i = list.length - 1;
      if (i >= list.length) i = 0;
      current = i;
      var p = list[i];
      img.src = p.src;
      img.alt = p.title || '照片';
      cap.textContent = [p.title, p.caption].filter(Boolean).join(' · ');
      box.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }

    function close() {
      box.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    wall.addEventListener('click', function (e) {
      var fig = e.target.closest('.ph-item');
      if (!fig) return;
      show(parseInt(fig.getAttribute('data-index'), 10) || 0);
    });

    document.getElementById('lbClose').addEventListener('click', close);
    document.getElementById('lbPrev').addEventListener('click', function (e) { e.stopPropagation(); show(current - 1); });
    document.getElementById('lbNext').addEventListener('click', function (e) { e.stopPropagation(); show(current + 1); });

    box.addEventListener('click', function (e) {
      if (e.target === box) close();
    });

    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
  }

  /* ---------------- 启动 ---------------- */
  if (!page) return;

  fetch('content/site.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data) return;
      if (page === 'home') renderCities(data);
      if (page === 'photos') renderPhotos(data);
    })
    .catch(function () {
      /* 读取失败时保留 HTML 里的静态内容 */
    });
})();
