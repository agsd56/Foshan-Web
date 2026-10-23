/* ==========================================================================
   站点内容渲染
   - 首页：城市卡片（content/site.json）
   - 相册：相册列表 + 相册详情 + 灯箱（content/site.json）
   - 教程 / 加入页：加载 content/guide-body.html、content/join-body.html
   ========================================================================== */
(function () {
  'use strict';

  var page = document.body.getAttribute('data-page');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function $(id) { return document.getElementById(id); }

  /* ================= 首页：城市卡片 ================= */
  function renderCities(data) {
    var grid = $('cityGrid');
    if (!grid || !Array.isArray(data.cities)) return;

    grid.innerHTML = data.cities.map(function (c, i) {
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
  }

  /* ================= 相册 ================= */
  var ALBUMS = [];

  function normalizeAlbums(d) {
    var list = Array.isArray(d.albums) ? d.albums.slice() : [];

    // 兼容旧数据结构（顶层 photos）
    if (!list.length && Array.isArray(d.photos) && d.photos.length) {
      list = [{
        id: 'album-default',
        title: '未分类',
        desc: '',
        cover: d.photos[0].src || '',
        photos: d.photos
      }];
    }

    return list.filter(function (a) {
      return a && Array.isArray(a.photos);
    }).map(function (a) {
      if (!a.id) a.id = 'album-' + Math.random().toString(36).slice(2, 8);
      a.photos = a.photos.filter(function (p) { return p && p.src; });
      return a;
    });
  }

  function coverOf(a) {
    if (a.cover) return a.cover;
    return a.photos.length ? a.photos[0].src : '';
  }

  function renderAlbumList() {
    var grid = $('albumGrid');
    var empty = $('albumEmpty');
    var desc = $('galleryDesc');
    if (!grid) return;

    if (!ALBUMS.length) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      if (desc) desc.textContent = '';
      return;
    }

    if (empty) empty.hidden = true;

    var total = ALBUMS.reduce(function (n, a) { return n + a.photos.length; }, 0);
    if (desc) {
      desc.textContent = '共 ' + ALBUMS.length + ' 个相册、' + total + ' 张照片。点击相册查看。';
    }

    grid.innerHTML = ALBUMS.map(function (a) {
      var cover = coverOf(a);
      var coverHtml = cover
        ? '<img src="' + esc(cover) + '" alt="' + esc(a.title) + '" loading="lazy" ' +
          'onerror="this.style.display=\'none\'">'
        : '<div class="no-cover">NO COVER</div>';

      return '' +
        '<button class="album-card" data-album="' + esc(a.id) + '">' +
          '<div class="album-cover">' + coverHtml +
            '<span class="album-count">' + a.photos.length + ' 张</span>' +
          '</div>' +
          '<div class="album-card-body">' +
            '<h3 class="album-name">' + esc(a.title || '未命名相册') + '</h3>' +
            '<p class="album-sub">' + esc(a.desc || '') + '</p>' +
          '</div>' +
        '</button>';
    }).join('');
  }

  function showAlbumList() {
    var lv = $('albumListView');
    var av = $('albumView');
    if (!lv || !av) return;
    lv.hidden = false;
    av.hidden = true;
    var t = $('galleryTitle');
    if (t) t.innerHTML = '精选照片<small>SELECTED PHOTOS</small>';
    renderAlbumList();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function showAlbum(id) {
    var a = null;
    for (var i = 0; i < ALBUMS.length; i++) {
      if (ALBUMS[i].id === id) { a = ALBUMS[i]; break; }
    }
    if (!a) { showAlbumList(); return; }

    var lv = $('albumListView');
    var av = $('albumView');
    lv.hidden = true;
    av.hidden = false;

    $('albumTitle').textContent = a.title || '未命名相册';
    $('albumDesc').textContent = a.desc || '';

    // 页头保持「精选照片」不变，避免与下方相册标题重复
    var gd = $('galleryDesc');
    if (gd) gd.textContent = '';

    var wall = $('photoWall');
    var empty = $('photoEmpty');

    if (!a.photos.length) {
      wall.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    wall.innerHTML = a.photos.map(function (p, idx) {
      return '' +
        '<figure class="ph-item" data-index="' + idx + '">' +
          '<img src="' + esc(p.src) + '" alt="' + esc(p.title || '照片') + '" loading="lazy">' +
          '<figcaption>' +
            (p.title ? '<b>' + esc(p.title) + '</b>' : '') +
            (p.caption ? '<span>' + esc(p.caption) + '</span>' : '') +
          '</figcaption>' +
        '</figure>';
    }).join('');

    setLightboxList(a.photos);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ================= 灯箱 ================= */
  var lbList = [];
  var lbIndex = 0;
  var lbBound = false;

  function setLightboxList(list) {
    lbList = list || [];
  }

  function lbShow(i) {
    var box = $('lightbox');
    var img = $('lbImage');
    var cap = $('lbCaption');
    if (!box || !img || !lbList.length) return;

    if (i < 0) i = lbList.length - 1;
    if (i >= lbList.length) i = 0;
    lbIndex = i;

    var p = lbList[i];
    img.src = p.src;
    img.alt = p.title || '照片';
    if (cap) cap.textContent = [p.title, p.caption].filter(Boolean).join(' · ');

    box.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    var hint = $('lbHint');
    if (hint) {
      hint.textContent = lbList.length > 1
        ? '点击空白处关闭 · 左右滑动切换'
        : '点击空白处或按 ESC 关闭';
    }
  }

  function lbClose() {
    var box = $('lightbox');
    if (!box) return;
    box.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  function bindLightbox() {
    if (lbBound) return;
    lbBound = true;

    var box = $('lightbox');
    var wall = $('photoWall');
    if (!box) return;

    if (wall) {
      wall.addEventListener('click', function (e) {
        var fig = e.target.closest ? e.target.closest('.ph-item') : null;
        if (!fig) return;
        lbShow(parseInt(fig.getAttribute('data-index'), 10) || 0);
      });
    }

    var c = $('lbClose'), p = $('lbPrev'), n = $('lbNext');
    if (c) c.addEventListener('click', function (e) { e.stopPropagation(); lbClose(); });
    if (p) p.addEventListener('click', function (e) { e.stopPropagation(); lbShow(lbIndex - 1); });
    if (n) n.addEventListener('click', function (e) { e.stopPropagation(); lbShow(lbIndex + 1); });

    // 点击空白关闭（点图片本身不关）
    box.addEventListener('click', function (e) {
      if (e.target === box) lbClose();
    });

    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') lbClose();
      else if (e.key === 'ArrowLeft') lbShow(lbIndex - 1);
      else if (e.key === 'ArrowRight') lbShow(lbIndex + 1);
    });

    var sx = 0, sy = 0, tracking = false;

    box.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });

    box.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - sx;
      var dy = t.clientY - sy;

      if (Math.abs(dy) > 90 && Math.abs(dy) > Math.abs(dx)) {
        if (dy > 0) lbClose();
        return;
      }
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        lbShow(lbIndex + (dx < 0 ? 1 : -1));
      }
    }, { passive: true });
  }

  /* ================= 相册路由 ================= */
  function currentAlbumId() {
    var h = location.hash.replace(/^#\/?/, '');
    if (h.indexOf('album/') === 0) return decodeURIComponent(h.slice(6));
    return '';
  }

  function route() {
    var id = currentAlbumId();
    if (id) showAlbum(id);
    else showAlbumList();
  }

  function initGallery(data) {
    ALBUMS = normalizeAlbums(data);
    bindLightbox();

    var grid = $('albumGrid');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var card = e.target.closest ? e.target.closest('.album-card') : null;
        if (!card) return;
        location.hash = 'album/' + encodeURIComponent(card.getAttribute('data-album'));
      });
    }

    var back = $('albumBack');
    if (back) {
      back.addEventListener('click', function () {
        location.hash = '';
        showAlbumList();
      });
    }

    window.addEventListener('hashchange', route);
    route();
  }

  /* ================= 教程 / 加入页内容注入 ================= */
  function loadFragment(id, path) {
    var el = $(id);
    if (!el) return;
    fetch(path, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (html) {
        if (html && html.trim()) el.innerHTML = html;
      })
      .catch(function () {
        /* 读取失败时保留页面内的静态内容 */
      });
  }

  /* ================= 启动 ================= */
  if (page === 'guide') loadFragment('guideBody', 'content/guide-body.html');
  if (page === 'join') loadFragment('joinBody', 'content/join-body.html');
  if (page === 'home' || page === 'photos') {
    fetch('content/site.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        if (page === 'home') renderCities(data);
        if (page === 'photos') initGallery(data);
      })
      .catch(function () {
        /* 读取失败时保留静态内容 */
      });
  }
})();
