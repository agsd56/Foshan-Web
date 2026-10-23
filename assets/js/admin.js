/* ==========================================================================
   后台逻辑 —— 通过 GitHub Contents API 直接修改仓库
   管理内容：城市、相册、教程 / 加入页正文、站点设置
   ========================================================================== */
(function () {
  'use strict';

  var LS_KEY = 'foshan_admin_cfg';
  var SITE_PATH = 'content/site.json';
  var GUIDE_PATH = 'content/guide-body.html';
  var JOIN_PATH = 'content/join-body.html';

  var cfg = { owner: '', repo: '', branch: 'main', token: '' };
  var data = null;
  var siteSha = null;
  var contentMeta = { guide: { sha: null, original: '' }, join: { sha: null, original: '' } };
  var currentAlbumId = null;
  var dirty = false;
  var pending = new Map();   // 路径 -> base64（待上传图片）

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 基础工具 ---------------- */
  var toastTimer = null;
  function toast(msg, type) {
    var el = $('status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'admin-status is-show' + (type ? ' is-' + type : '');
    clearTimeout(toastTimer);
    if (type !== 'wait') {
      toastTimer = setTimeout(function () { el.classList.remove('is-show'); }, 3600);
    }
  }

  function b64encode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64decode(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function updateDirtyMark() {
    var el = $('dirtyMark');
    if (el) el.hidden = !dirty;
  }

  function saveDraft() {
    try {
      localStorage.setItem('foshan_draft', JSON.stringify({ data: data, ts: Date.now() }));
    } catch (e) {}
  }

  function clearDraft() {
    try { localStorage.removeItem('foshan_draft'); } catch (e) {}
  }

  function markDirty() {
    dirty = true;
    updateDirtyMark();
    saveDraft();
  }

  /* ---------------- GitHub API ---------------- */
  function apiUrl(path) {
    return 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + path;
  }

  function headers() {
    return {
      Authorization: 'Bearer ' + cfg.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  async function ghGet(path) {
    var res = await fetch(apiUrl(path) + '?ref=' + encodeURIComponent(cfg.branch), {
      headers: headers(), cache: 'no-store'
    });
    if (res.status === 404) return null;
    if (res.status === 401) throw new Error('Token 无效或已过期');
    if (res.status === 403) throw new Error('Token 权限不足（需要 Contents 读写）');
    if (!res.ok) throw new Error('读取失败：' + res.status);
    return res.json();
  }

  async function ghPut(path, base64, message, sha) {
    var body = { message: message, content: base64, branch: cfg.branch };
    if (sha) body.sha = sha;

    var res = await fetch(apiUrl(path), {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers()),
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      var detail = '';
      try { detail = (await res.json()).message || ''; } catch (e) {}
      throw new Error('提交失败：' + res.status + (detail ? ' · ' + detail : ''));
    }
    return res.json();
  }

  /* ---------------- 配置 ---------------- */
  function loadCfg() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) cfg = Object.assign(cfg, JSON.parse(raw));
    } catch (e) {}
    $('cfgOwner').value = cfg.owner || '';
    $('cfgRepo').value = cfg.repo || '';
    $('cfgBranch').value = cfg.branch || 'main';
    $('cfgToken').value = cfg.token || '';
  }

  function saveCfg() {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  }

  /* ---------------- 连接 ---------------- */
  async function connect() {
    cfg.owner = $('cfgOwner').value.trim();
    cfg.repo = $('cfgRepo').value.trim();
    cfg.branch = $('cfgBranch').value.trim() || 'main';
    cfg.token = $('cfgToken').value.trim();

    if (!cfg.owner || !cfg.repo || !cfg.token) {
      toast('三项都要填：用户名、仓库名、Token', 'error');
      return;
    }

    saveCfg();
    toast('正在读取仓库…', 'wait');

    try {
      var siteFile = await ghGet(SITE_PATH);
      if (!siteFile) throw new Error('仓库里没有 content/site.json');

      data = JSON.parse(b64decode(siteFile.content));
      siteSha = siteFile.sha;

      if (!Array.isArray(data.cities)) data.cities = [];
      if (!Array.isArray(data.albums)) data.albums = [];
      if (!data.hero) data.hero = { image: '', title: '佛山联盟' };

      // 兼容旧结构
      if (!data.albums.length && Array.isArray(data.photos) && data.photos.length) {
        data.albums.push({
          id: 'album-default',
          title: '未分类',
          desc: '',
          cover: data.photos[0].src || '',
          photos: data.photos
        });
        delete data.photos;
      }

      // 内容文件
      var g = await ghGet(GUIDE_PATH);
      var j = await ghGet(JOIN_PATH);
      contentMeta.guide.sha = g ? g.sha : null;
      contentMeta.guide.original = g ? b64decode(g.content) : '';
      contentMeta.join.sha = j ? j.sha : null;
      contentMeta.join.original = j ? b64decode(j.content) : '';

      $('connectBox').hidden = true;
      $('editor').hidden = false;
      ['btnSave', 'btnReload', 'btnLogout', 'btnExport', 'btnImport'].forEach(function (id) {
        var el = $(id);
        if (el) el.hidden = false;
      });

      // 草稿恢复
      try {
        var raw = localStorage.getItem('foshan_draft');
        if (raw) {
          var d = JSON.parse(raw);
          if (d && d.data && JSON.stringify(d.data) !== JSON.stringify(data)) {
            var when = new Date(d.ts).toLocaleString();
            if (confirm('发现上次未发布的草稿（' + when + '），要恢复吗？\n取消则保留仓库里的版本。')) {
              data = d.data;
              dirty = true;
            } else {
              clearDraft();
            }
          }
        }
      } catch (e) {}

      $('guideEditor').value = contentMeta.guide.original;
      $('joinEditor').value = contentMeta.join.original;

      renderAll();
      updateDirtyMark();
      toast('已连接 · ' + cfg.owner + '/' + cfg.repo, 'ok');
    } catch (err) {
      toast(err.message || '连接失败', 'error');
    }
  }

  async function reload() {
    if (dirty && !confirm('有未保存的修改，确定放弃并重新读取？')) return;
    dirty = false;
    currentAlbumId = null;
    await connect();
  }

  /* ---------------- 渲染 ---------------- */
  function renderAll() {
    renderCities();
    renderAlbums();
    renderSite();
    showAlbumManage();
  }

  function thumbHtml(src, alt) {
    if (!src) return '<div class="no-img">NO IMAGE</div>';
    return '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '">';
  }

  function renderCities() {
    var box = $('cityList');
    if (!data.cities.length) {
      box.innerHTML = '<div class="admin-empty">还没有城市，点下面的按钮添加。</div>';
      return;
    }

    box.innerHTML = data.cities.map(function (c, i) {
      return '' +
        '<div class="admin-item" data-i="' + i + '">' +
          '<div class="admin-thumb">' + thumbHtml(c.image, c.name) + '</div>' +
          '<div class="admin-item-body">' +
            '<div class="field-row">' +
              '<div class="field"><label>名称</label><input type="text" data-k="name" value="' + esc(c.name) + '"></div>' +
              '<div class="field"><label>英文</label><input type="text" data-k="en" value="' + esc(c.en) + '"></div>' +
              '<div class="field"><label>建城</label><input type="text" data-k="founded" value="' + esc(c.founded) + '"></div>' +
            '</div>' +
            '<div class="field-row">' +
              '<div class="field"><label>市长</label><input type="text" data-k="mayor" value="' + esc(c.mayor) + '"></div>' +
              '<div class="field"><label>居民</label><input type="number" data-k="residents" value="' + esc(c.residents) + '"></div>' +
              '<div class="field"><label>区块</label><input type="number" data-k="blocks" value="' + esc(c.blocks) + '"></div>' +
              '<div class="field"><label>上限</label><input type="number" data-k="maxBlocks" value="' + esc(c.maxBlocks) + '"></div>' +
            '</div>' +
            '<div class="field-row">' +
              '<div class="field"><label>标签</label><input type="text" data-k="tag" value="' + esc(c.tag) + '"></div>' +
              '<div class="field"><label>主卡（跨两列）</label><select data-k="feature">' +
                '<option value="0"' + (c.feature ? '' : ' selected') + '>否</option>' +
                '<option value="1"' + (c.feature ? ' selected' : '') + '>是</option>' +
              '</select></div>' +
            '</div>' +
            '<div class="field"><label>介绍（留空则不显示）</label><textarea data-k="desc">' + esc(c.desc) + '</textarea></div>' +
          '</div>' +
          '<div class="admin-item-actions">' +
            '<div class="admin-drag" draggable="true" title="拖动排序">⠿</div>' +
            '<button class="mini-btn" data-act="up">↑ 上移</button>' +
            '<button class="mini-btn" data-act="down">↓ 下移</button>' +
            '<button class="mini-btn" data-act="img">换图</button>' +
            '<button class="mini-btn mini-btn--danger" data-act="del">删除</button>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  /* ---------------- 相册 ---------------- */
  function renderAlbums() {
    var box = $('albumList');
    var empty = $('albumEmpty');
    var count = $('albumCount');

    if (count) count.textContent = '共 ' + data.albums.length + ' 个相册';

    if (!data.albums.length) {
      box.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    box.innerHTML = data.albums.map(function (a, i) {
      var cover = a.cover || (a.photos[0] && a.photos[0].src) || '';
      return '' +
        '<div class="admin-item" data-i="' + i + '">' +
          '<div class="admin-thumb">' + thumbHtml(cover, a.title) + '</div>' +
          '<div class="admin-item-body">' +
            '<div class="field-row">' +
              '<div class="field"><label>相册名称</label><input type="text" data-k="title" value="' + esc(a.title) + '"></div>' +
              '<div class="field"><label>照片数</label><input type="text" value="' + a.photos.length + ' 张" disabled></div>' +
            '</div>' +
            '<div class="field"><label>描述</label><input type="text" data-k="desc" value="' + esc(a.desc) + '"></div>' +
          '</div>' +
          '<div class="admin-item-actions">' +
            '<div class="admin-drag" draggable="true" title="拖动排序">⠿</div>' +
            '<button class="mini-btn" data-act="open">管理照片</button>' +
            '<button class="mini-btn" data-act="up">↑</button>' +
            '<button class="mini-btn" data-act="down">↓</button>' +
            '<button class="mini-btn mini-btn--danger" data-act="del">删除</button>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function currentAlbum() {
    for (var i = 0; i < data.albums.length; i++) {
      if (data.albums[i].id === currentAlbumId) return data.albums[i];
    }
    return null;
  }

  function showAlbumManage() {
    currentAlbumId = null;
    $('albumManageView').hidden = false;
    $('albumPhotoView').hidden = true;
    renderAlbums();
  }

  function openAlbum(id) {
    var a = null;
    for (var i = 0; i < data.albums.length; i++) {
      if (data.albums[i].id === id) { a = data.albums[i]; break; }
    }
    if (!a) return;

    currentAlbumId = id;
    $('albumManageView').hidden = true;
    $('albumPhotoView').hidden = false;
    $('albumNameInput').value = a.title || '';
    $('albumDescInput').value = a.desc || '';
    renderAlbumPhotos();
  }

  function renderAlbumPhotos() {
    var a = currentAlbum();
    if (!a) return;

    var box = $('albumPhotoList');
    var tb = $('albumPhotoToolbar');

    if (!a.photos.length) {
      box.innerHTML = '<div class="admin-empty">这个相册还没有照片，用上面的区域上传。</div>';
      if (tb) tb.hidden = true;
      return;
    }

    if (tb) tb.hidden = false;

    box.innerHTML = a.photos.map(function (p, i) {
      return '' +
        '<div class="admin-item" data-i="' + i + '">' +
          '<div class="admin-thumb">' +
            '<label class="photo-check"><input type="checkbox" class="photo-sel" data-i="' + i + '"></label>' +
            thumbHtml(p.src, p.title) +
          '</div>' +
          '<div class="admin-item-body">' +
            '<div class="field"><label>标题</label><input type="text" data-k="title" value="' + esc(p.title) + '"></div>' +
            '<div class="field"><label>说明（可选）</label><input type="text" data-k="caption" value="' + esc(p.caption) + '"></div>' +
          '</div>' +
          '<div class="admin-item-actions">' +
            '<div class="admin-drag" draggable="true" title="拖动排序">⠿</div>' +
            '<button class="mini-btn" data-act="cover">设为封面</button>' +
            '<button class="mini-btn" data-act="up">↑</button>' +
            '<button class="mini-btn" data-act="down">↓</button>' +
            '<button class="mini-btn mini-btn--danger" data-act="del">删除</button>' +
          '</div>' +
        '</div>';
    }).join('');

    updateAlbumSelCount();
  }

  function updateAlbumSelCount() {
    var sel = document.querySelectorAll('#albumPhotoList .photo-sel:checked');
    var all = document.querySelectorAll('#albumPhotoList .photo-sel');
    var el = $('albumSelCount');
    if (el) el.textContent = '已选 ' + sel.length + ' 张';
    var chk = $('albumCheckAll');
    if (chk) chk.checked = all.length > 0 && sel.length === all.length;
  }

  /* ---------------- 站点 ---------------- */
  function renderSite() {
    $('heroImage').value = data.hero.image || '';
    $('heroTitle').value = data.hero.title || '';
    $('heroThumb').innerHTML = thumbHtml(data.hero.image, '首屏图');
  }

  /* ---------------- 图片 ---------------- */
  function compress(file, maxW, quality) {
    maxW = maxW || 1600;
    quality = quality || 0.85;

    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);

      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (w > maxW) {
          h = Math.round(h * maxW / w);
          w = maxW;
        }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), width: w, height: h });
      };

      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
      img.src = url;
    });
  }

  function newImagePath(prefix) {
    return 'assets/img/uploads/' + prefix + '-' + Date.now() + '-' +
           Math.random().toString(36).slice(2, 6) + '.jpg';
  }

  function pickFile(multiple) {
    return new Promise(function (resolve) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = !!multiple;
      input.onchange = function () {
        resolve(Array.prototype.slice.call(input.files || []));
      };
      input.click();
    });
  }

  async function replaceCityImage(index) {
    var files = await pickFile(false);
    if (!files.length) return;

    toast('正在压缩…', 'wait');
    try {
      var out = await compress(files[0]);
      var path = newImagePath('city');
      pending.set(path, out.dataUrl.split(',')[1]);
      data.cities[index].image = path;
      markDirty();
      renderCities();
      toast('图片已就绪，点「保存并发布」上传', 'ok');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function addAlbumPhotos(files) {
    var a = currentAlbum();
    if (!a || !files.length) return;

    toast('正在压缩 ' + files.length + ' 张…', 'wait');
    try {
      for (var i = 0; i < files.length; i++) {
        var out = await compress(files[i]);
        var path = newImagePath('photo');
        pending.set(path, out.dataUrl.split(',')[1]);
        a.photos.push({ id: uid('p'), src: path, title: '', caption: '' });
      }
      if (!a.cover) a.cover = a.photos[0].src;
      markDirty();
      renderAlbumPhotos();
      toast('已添加 ' + files.length + ' 张，点「保存并发布」上传', 'ok');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  /* ---------------- 排序 ---------------- */
  function move(arr, from, to) {
    if (to < 0 || to >= arr.length) return false;
    var item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
    return true;
  }

  /* ---------------- 保存 ---------------- */
  async function save() {
    if (!data) return;

    var guideText = $('guideEditor').value;
    var joinText = $('joinEditor').value;
    var guideChanged = guideText !== contentMeta.guide.original;
    var joinChanged = joinText !== contentMeta.join.original;

    var total = pending.size;
    var done = 0;

    try {
      // 1. 上传图片
      for (var entry of pending.entries()) {
        done++;
        toast('上传图片 ' + done + '/' + total + '…', 'wait');
        await ghPut(entry[0], entry[1], 'upload: ' + entry[0], null);
      }

      // 2. 内容文件
      if (guideChanged) {
        toast('提交教程正文…', 'wait');
        var gMeta = await ghGet(GUIDE_PATH);
        await ghPut(GUIDE_PATH, b64encode(guideText), 'content: 更新新手指南', gMeta ? gMeta.sha : null);
        contentMeta.guide.original = guideText;
      }

      if (joinChanged) {
        toast('提交加入页正文…', 'wait');
        var jMeta = await ghGet(JOIN_PATH);
        await ghPut(JOIN_PATH, b64encode(joinText), 'content: 更新加入我们', jMeta ? jMeta.sha : null);
        contentMeta.join.original = joinText;
      }

      // 3. site.json
      toast('提交站点数据…', 'wait');
      var latest = await ghGet(SITE_PATH);
      siteSha = latest ? latest.sha : null;

      data.updated = new Date().toISOString().slice(0, 10);
      await ghPut(SITE_PATH, b64encode(JSON.stringify(data, null, 2)), 'content: 更新站点数据', siteSha);

      pending.clear();
      dirty = false;
      clearDraft();
      updateDirtyMark();
      toast('已发布 · Cloudflare 约 30 秒后生效', 'ok');
    } catch (err) {
      toast(err.message || '保存失败', 'error');
    }
  }

  /* ---------------- 拖拽排序 ---------------- */
  function bindDrag(listEl, getArr, rerender) {
    if (!listEl) return;
    var dragIndex = -1;

    listEl.addEventListener('dragstart', function (e) {
      var handle = e.target.closest ? e.target.closest('.admin-drag') : null;
      if (!handle) { e.preventDefault(); return; }
      var item = handle.closest('.admin-item');
      dragIndex = parseInt(item.getAttribute('data-i'), 10);
      item.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(dragIndex)); } catch (err) {}
    });

    listEl.addEventListener('dragend', function () {
      Array.prototype.forEach.call(listEl.querySelectorAll('.admin-item'), function (el) {
        el.classList.remove('is-dragging', 'is-drop-target');
      });
      dragIndex = -1;
    });

    listEl.addEventListener('dragover', function (e) {
      var item = e.target.closest ? e.target.closest('.admin-item') : null;
      if (!item || dragIndex < 0) return;
      e.preventDefault();
      Array.prototype.forEach.call(listEl.querySelectorAll('.admin-item'), function (el) {
        el.classList.remove('is-drop-target');
      });
      item.classList.add('is-drop-target');
    });

    listEl.addEventListener('drop', function (e) {
      var item = e.target.closest ? e.target.closest('.admin-item') : null;
      if (!item || dragIndex < 0) return;
      e.preventDefault();
      var to = parseInt(item.getAttribute('data-i'), 10);
      var arr = getArr();
      if (arr && to !== dragIndex) {
        move(arr, dragIndex, to);
        markDirty();
        rerender();
      }
      dragIndex = -1;
    });
  }

  /* ---------------- 预览内容 ---------------- */
  function previewContent(which) {
    var text = which === 'guide' ? $('guideEditor').value : $('joinEditor').value;
    var base = location.href.replace(/[^/]*$/, '');
    var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<link rel="stylesheet" href="' + base + 'assets/css/style.css">' +
      '<style>body{padding:40px 0}.wrap{width:min(100% - 48px,820px);margin:0 auto}</style>' +
      '</head><body><div class="wrap">' + text + '</div></body></html>';

    var w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    $('btnConnect').addEventListener('click', connect);
    $('btnReload').addEventListener('click', reload);
    $('btnSave').addEventListener('click', save);

    $('btnLogout').addEventListener('click', function () {
      if (!confirm('断开连接？配置会保留，下次直接点连接即可。')) return;
      $('editor').hidden = true;
      $('connectBox').hidden = false;
      ['btnSave', 'btnReload', 'btnLogout', 'btnExport', 'btnImport'].forEach(function (id) {
        var el = $(id);
        if (el) el.hidden = true;
      });
    });

    // Tabs
    document.querySelectorAll('.admin-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('is-active'); });
        document.querySelectorAll('.admin-panel').forEach(function (p) { p.classList.remove('is-active'); });
        tab.classList.add('is-active');
        var name = tab.getAttribute('data-tab');
        var panel = $('panel-' + name);
        if (panel) panel.classList.add('is-active');
        if (name === 'albums') showAlbumManage();
      });
    });

    /* ---------- 城市 ---------- */
    $('cityList').addEventListener('input', function (e) {
      var item = e.target.closest('.admin-item');
      var key = e.target.getAttribute('data-k');
      if (!item || !key) return;
      var i = parseInt(item.getAttribute('data-i'), 10);
      var val = e.target.value;
      if (key === 'residents' || key === 'blocks' || key === 'maxBlocks') val = parseInt(val, 10) || 0;
      data.cities[i][key] = val;
      markDirty();
    });

    $('cityList').addEventListener('change', function (e) {
      if (e.target.tagName === 'SELECT') {
        var item = e.target.closest('.admin-item');
        var i = parseInt(item.getAttribute('data-i'), 10);
        data.cities[i].feature = e.target.value === '1';
        markDirty();
      }
    });

    $('cityList').addEventListener('click', async function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var item = btn.closest('.admin-item');
      var i = parseInt(item.getAttribute('data-i'), 10);
      var act = btn.getAttribute('data-act');

      if (act === 'up') { if (move(data.cities, i, i - 1)) { markDirty(); renderCities(); } }
      if (act === 'down') { if (move(data.cities, i, i + 1)) { markDirty(); renderCities(); } }
      if (act === 'img') { await replaceCityImage(i); }
      if (act === 'del') {
        if (!confirm('删除「' + data.cities[i].name + '」？')) return;
        data.cities.splice(i, 1);
        markDirty();
        renderCities();
      }
    });

    $('btnAddCity').addEventListener('click', function () {
      data.cities.push({
        id: uid('c'), name: '新城市', en: 'CITY', founded: '', mayor: '',
        residents: 0, blocks: 0, maxBlocks: 0, image: '', tag: '', feature: false, desc: ''
      });
      markDirty();
      renderCities();
    });

    /* ---------- 相册 ---------- */
    $('btnAddAlbum').addEventListener('click', function () {
      var a = { id: uid('a'), title: '新相册', desc: '', cover: '', photos: [] };
      data.albums.push(a);
      markDirty();
      renderAlbums();
      openAlbum(a.id);
    });

    $('albumList').addEventListener('input', function (e) {
      var item = e.target.closest('.admin-item');
      var key = e.target.getAttribute('data-k');
      if (!item || !key) return;
      var i = parseInt(item.getAttribute('data-i'), 10);
      data.albums[i][key] = e.target.value;
      markDirty();
    });

    $('albumList').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var item = btn.closest('.admin-item');
      var i = parseInt(item.getAttribute('data-i'), 10);
      var act = btn.getAttribute('data-act');
      var a = data.albums[i];

      if (act === 'open') openAlbum(a.id);
      if (act === 'up') { if (move(data.albums, i, i - 1)) { markDirty(); renderAlbums(); } }
      if (act === 'down') { if (move(data.albums, i, i + 1)) { markDirty(); renderAlbums(); } }
      if (act === 'del') {
        if (!confirm('删除相册「' + a.title + '」及其 ' + a.photos.length + ' 张照片？\n（照片文件不会从仓库删除）')) return;
        data.albums.splice(i, 1);
        markDirty();
        renderAlbums();
      }
    });

    $('btnAlbumBack').addEventListener('click', function () {
      showAlbumManage();
    });

    $('albumNameInput').addEventListener('input', function (e) {
      var a = currentAlbum();
      if (!a) return;
      a.title = e.target.value;
      markDirty();
    });

    $('albumDescInput').addEventListener('input', function (e) {
      var a = currentAlbum();
      if (!a) return;
      a.desc = e.target.value;
      markDirty();
    });

    $('albumPhotoList').addEventListener('input', function (e) {
      var a = currentAlbum();
      if (!a) return;
      var item = e.target.closest('.admin-item');
      var key = e.target.getAttribute('data-k');
      if (!item || !key) return;
      var i = parseInt(item.getAttribute('data-i'), 10);
      a.photos[i][key] = e.target.value;
      markDirty();
    });

    $('albumPhotoList').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var a = currentAlbum();
      if (!a) return;
      var item = btn.closest('.admin-item');
      var i = parseInt(item.getAttribute('data-i'), 10);
      var act = btn.getAttribute('data-act');

      if (act === 'cover') {
        a.cover = a.photos[i].src;
        markDirty();
        toast('已设为封面', 'ok');
      }
      if (act === 'up') { if (move(a.photos, i, i - 1)) { markDirty(); renderAlbumPhotos(); } }
      if (act === 'down') { if (move(a.photos, i, i + 1)) { markDirty(); renderAlbumPhotos(); } }
      if (act === 'del') {
        if (!confirm('删除这张照片？')) return;
        a.photos.splice(i, 1);
        if (a.cover && !a.photos.some(function (p) { return p.src === a.cover; })) {
          a.cover = a.photos.length ? a.photos[0].src : '';
        }
        markDirty();
        renderAlbumPhotos();
      }
    });

    // 相册内上传
    var drop = $('albumDrop');
    var input = $('albumPhotoInput');

    drop.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      addAlbumPhotos(Array.prototype.slice.call(input.files || []));
      input.value = '';
    });

    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.classList.remove('is-over');
      });
    });
    drop.addEventListener('drop', function (e) {
      var files = Array.prototype.slice.call(e.dataTransfer.files || [])
        .filter(function (f) { return f.type.indexOf('image/') === 0; });
      addAlbumPhotos(files);
    });

    // 批量删除照片
    $('albumCheckAll').addEventListener('change', function (e) {
      Array.prototype.forEach.call(document.querySelectorAll('#albumPhotoList .photo-sel'), function (c) {
        c.checked = e.target.checked;
      });
      updateAlbumSelCount();
    });

    $('albumPhotoList').addEventListener('change', function (e) {
      if (e.target.classList && e.target.classList.contains('photo-sel')) updateAlbumSelCount();
    });

    $('btnAlbumDeleteSelected').addEventListener('click', function () {
      var a = currentAlbum();
      if (!a) return;
      var idx = [];
      Array.prototype.forEach.call(document.querySelectorAll('#albumPhotoList .photo-sel:checked'), function (c) {
        idx.push(parseInt(c.getAttribute('data-i'), 10));
      });
      if (!idx.length) { toast('还没选中照片', 'error'); return; }
      if (!confirm('删除选中的 ' + idx.length + ' 张照片？')) return;

      idx.sort(function (x, y) { return y - x; }).forEach(function (i) { a.photos.splice(i, 1); });
      if (a.cover && !a.photos.some(function (p) { return p.src === a.cover; })) {
        a.cover = a.photos.length ? a.photos[0].src : '';
      }
      markDirty();
      renderAlbumPhotos();
      toast('已删除 ' + idx.length + ' 张', 'ok');
    });

    /* ---------- 内容编辑 ---------- */
    $('guideEditor').addEventListener('input', markDirty);
    $('joinEditor').addEventListener('input', markDirty);

    $('btnGuidePreview').addEventListener('click', function () { previewContent('guide'); });
    $('btnJoinPreview').addEventListener('click', function () { previewContent('join'); });

    $('btnGuideReload').addEventListener('click', async function () {
      if (!confirm('放弃当前修改，重新读取仓库里的教程正文？')) return;
      var g = await ghGet(GUIDE_PATH);
      $('guideEditor').value = g ? b64decode(g.content) : '';
      contentMeta.guide.original = $('guideEditor').value;
      toast('已重新读取', 'ok');
    });

    $('btnJoinReload').addEventListener('click', async function () {
      if (!confirm('放弃当前修改，重新读取仓库里的加入页正文？')) return;
      var j = await ghGet(JOIN_PATH);
      $('joinEditor').value = j ? b64decode(j.content) : '';
      contentMeta.join.original = $('joinEditor').value;
      toast('已重新读取', 'ok');
    });

    /* ---------- 站点 ---------- */
    $('heroImage').addEventListener('input', function (e) {
      data.hero.image = e.target.value;
      $('heroThumb').innerHTML = thumbHtml(data.hero.image, '首屏图');
      markDirty();
    });

    $('heroTitle').addEventListener('input', function (e) {
      data.hero.title = e.target.value;
      markDirty();
    });

    $('btnHeroImage').addEventListener('click', async function () {
      var files = await pickFile(false);
      if (!files.length) return;
      toast('正在压缩…', 'wait');
      try {
        var out = await compress(files[0], 1920);
        var path = newImagePath('hero');
        pending.set(path, out.dataUrl.split(',')[1]);
        data.hero.image = path;
        $('heroImage').value = path;
        $('heroThumb').innerHTML = thumbHtml(path, '首屏图');
        markDirty();
        toast('首屏图已就绪，记得保存', 'ok');
      } catch (e) {
        toast(e.message, 'error');
      }
    });

    /* ---------- 拖拽 ---------- */
    bindDrag($('cityList'), function () { return data ? data.cities : null; }, renderCities);
    bindDrag($('albumList'), function () { return data ? data.albums : null; }, renderAlbums);
    bindDrag($('albumPhotoList'), function () {
      var a = currentAlbum();
      return a ? a.photos : null;
    }, renderAlbumPhotos);

    /* ---------- 快捷键 ---------- */
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (data) save();
      }
    });

    window.addEventListener('beforeunload', function (e) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  /* ---------------- 增强：导入导出、预览 ---------------- */
  function bindExtras() {
    var exp = $('btnExport');
    if (exp) exp.addEventListener('click', function () {
      if (!data) return;
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'site-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      toast('已导出 JSON', 'ok');
    });

    var imp = $('btnImport');
    var impInput = $('importInput');
    if (imp && impInput) {
      imp.addEventListener('click', function () { impInput.click(); });
      impInput.addEventListener('change', function () {
        var f = impInput.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            var d = JSON.parse(r.result);
            if (!Array.isArray(d.cities) || !Array.isArray(d.albums)) {
              throw new Error('文件里缺少 cities / albums');
            }
            if (!confirm('导入会覆盖当前编辑内容，确定？')) return;
            data = d;
            markDirty();
            renderAll();
            toast('已导入，记得点保存发布', 'ok');
          } catch (err) {
            toast('导入失败：' + err.message, 'error');
          }
        };
        r.readAsText(f);
        impInput.value = '';
      });
    }

    // 缩略图预览
    var preview = $('preview');
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.photo-check')) return;
      var thumb = e.target.closest ? e.target.closest('.admin-thumb') : null;
      if (!thumb || !preview) return;
      var im = thumb.querySelector('img');
      if (!im) return;
      $('previewImg').src = im.src;
      preview.hidden = false;
    });
    if (preview) preview.addEventListener('click', function () { preview.hidden = true; });
  }

  /* ---------------- 启动 ---------------- */
  loadCfg();
  bindEvents();
  bindExtras();

  if (cfg.owner && cfg.repo && cfg.token) {
    connect();
  }
})();
