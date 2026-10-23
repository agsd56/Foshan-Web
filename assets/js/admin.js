/* ==========================================================================
   后台逻辑 —— 通过 GitHub Contents API 直接修改仓库
   ========================================================================== */
(function () {
  'use strict';

  var LS_KEY = 'foshan_admin_cfg';
  var SITE_PATH = 'content/site.json';

  var cfg = { owner: '', repo: '', branch: 'main', token: '' };
  var data = null;
  var siteSha = null;
  var dirty = false;
  var pending = new Map();   // 路径 -> base64（待上传的图片）

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 基础工具 ---------------- */
  var toastTimer = null;
  function toast(msg, type) {
    var el = $('status');
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

  /* ---------------- 连接与读取 ---------------- */
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
      var file = await ghGet(SITE_PATH);
      if (!file) throw new Error('仓库里没有 content/site.json');
      data = JSON.parse(b64decode(file.content));
      siteSha = file.sha;

      if (!Array.isArray(data.cities)) data.cities = [];
      if (!Array.isArray(data.photos)) data.photos = [];
      if (!data.hero) data.hero = { image: '', title: '佛山联盟' };

      $('connectBox').hidden = true;
      $('editor').hidden = false;
      ['btnSave', 'btnReload', 'btnLogout', 'btnExport', 'btnImport'].forEach(function (id) {
        var el = $(id);
        if (el) el.hidden = false;
      });

      // 检查上次未发布的草稿
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
    await connect();
  }

  /* ---------------- 渲染 ---------------- */
  function renderAll() {
    renderCities();
    renderPhotos();
    renderSite();
  }

  function thumbHtml(src, alt) {
    if (!src) return '<div class="no-img">NO IMAGE</div>';
    return '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" ' +
           'onerror="this.style.display=\'none\';this.parentNode.innerHTML=\'<div class=&quot;no-img&quot;>MISSING</div>\'">';
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

  function renderPhotos() {
    var box = $('photoList');
    var tb = $('photoToolbar');

    if (!data.photos.length) {
      box.innerHTML = '<div class="admin-empty">还没有照片。上传的图片会自动压缩并提交到仓库。</div>';
      if (tb) tb.hidden = true;
      return;
    }

    box.innerHTML = data.photos.map(function (p, i) {
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
            '<button class="mini-btn" data-act="up">↑ 上移</button>' +
            '<button class="mini-btn" data-act="down">↓ 下移</button>' +
            '<button class="mini-btn mini-btn--danger" data-act="del">删除</button>' +
          '</div>' +
        '</div>';
    }).join('');

    if (tb) tb.hidden = false;
    if (typeof updateSelCount === 'function') updateSelCount();
  }

  function renderSite() {
    $('heroImage').value = data.hero.image || '';
    $('heroTitle').value = data.hero.title || '';
    $('heroThumb').innerHTML = thumbHtml(data.hero.image, '首屏图');
  }

  /* ---------------- 图片处理 ---------------- */
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
    var ts = Date.now();
    var rand = Math.random().toString(36).slice(2, 6);
    return 'assets/img/uploads/' + prefix + '-' + ts + '-' + rand + '.jpg';
  }

  function pickFile(accept, multiple) {
    return new Promise(function (resolve) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = accept || 'image/*';
      input.multiple = !!multiple;
      input.onchange = function () {
        resolve(Array.prototype.slice.call(input.files || []));
      };
      input.click();
    });
  }

  async function replaceCityImage(index) {
    var files = await pickFile('image/*', false);
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

  async function addPhotos(files) {
    if (!files.length) return;
    toast('正在压缩 ' + files.length + ' 张…', 'wait');

    try {
      for (var i = 0; i < files.length; i++) {
        var out = await compress(files[i]);
        var path = newImagePath('photo');
        pending.set(path, out.dataUrl.split(',')[1]);
        data.photos.push({
          id: 'p' + Date.now() + i,
          src: path,
          title: '',
          caption: ''
        });
      }
      markDirty();
      renderPhotos();
      toast('已添加 ' + files.length + ' 张，点「保存并发布」上传', 'ok');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  /* ---------------- 排序与删除 ---------------- */
  function move(arr, from, to) {
    if (to < 0 || to >= arr.length) return false;
    var item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
    return true;
  }

  /* ---------------- 保存 ---------------- */
  async function save() {
    if (!data) return;

    var total = pending.size;
    var done = 0;

    try {
      // 1. 上传图片
      for (var entry of pending.entries()) {
        done++;
        toast('上传图片 ' + done + '/' + total + '…', 'wait');
        await ghPut(entry[0], entry[1], 'upload: ' + entry[0], null);
      }

      // 2. 提交 JSON
      toast('提交内容…', 'wait');
      var latest = await ghGet(SITE_PATH);
      siteSha = latest ? latest.sha : null;

      data.updated = new Date().toISOString().slice(0, 10);
      var content = b64encode(JSON.stringify(data, null, 2));

      await ghPut(SITE_PATH, content, 'content: 更新站点内容', siteSha);

      pending.clear();
      dirty = false;
      clearDraft();
      updateDirtyMark();
      toast('已发布 · Cloudflare 约 30 秒后生效', 'ok');
    } catch (err) {
      toast(err.message || '保存失败', 'error');
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    $('btnConnect').addEventListener('click', connect);

    $('btnReload').addEventListener('click', reload);

    $('btnLogout').addEventListener('click', function () {
      if (!confirm('断开连接？配置会保留，下次直接点连接即可。')) return;
      $('editor').hidden = true;
      $('connectBox').hidden = false;
      $('btnSave').hidden = true;
      $('btnReload').hidden = true;
      $('btnLogout').hidden = true;
    });

    $('btnSave').addEventListener('click', save);

    // Tabs
    document.querySelectorAll('.admin-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('is-active'); });
        document.querySelectorAll('.admin-panel').forEach(function (p) { p.classList.remove('is-active'); });
        tab.classList.add('is-active');
        $('panel-' + tab.getAttribute('data-tab')).classList.add('is-active');
      });
    });

    // 城市列表：输入与按钮
    $('cityList').addEventListener('input', function (e) {
      var item = e.target.closest('.admin-item');
      var key = e.target.getAttribute('data-k');
      if (!item || !key) return;
      var i = parseInt(item.getAttribute('data-i'), 10);
      var val = e.target.value;
      if (key === 'feature') val = val === '1';
      else if (key === 'residents' || key === 'blocks' || key === 'maxBlocks') val = parseInt(val, 10) || 0;
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
        id: 'city' + Date.now(),
        name: '新城市',
        en: 'CITY',
        founded: '',
        mayor: '',
        residents: 0,
        blocks: 0,
        maxBlocks: 0,
        image: '',
        tag: '',
        feature: false,
        desc: ''
      });
      markDirty();
      renderCities();
    });

    // 照片列表
    $('photoList').addEventListener('input', function (e) {
      var item = e.target.closest('.admin-item');
      var key = e.target.getAttribute('data-k');
      if (!item || !key) return;
      var i = parseInt(item.getAttribute('data-i'), 10);
      data.photos[i][key] = e.target.value;
      markDirty();
    });

    $('photoList').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var item = btn.closest('.admin-item');
      var i = parseInt(item.getAttribute('data-i'), 10);
      var act = btn.getAttribute('data-act');

      if (act === 'up') { if (move(data.photos, i, i - 1)) { markDirty(); renderPhotos(); } }
      if (act === 'down') { if (move(data.photos, i, i + 1)) { markDirty(); renderPhotos(); } }
      if (act === 'del') {
        if (!confirm('删除这张照片？')) return;
        data.photos.splice(i, 1);
        markDirty();
        renderPhotos();
      }
    });

    // 上传区
    var drop = $('photoDrop');
    var input = $('photoInput');

    drop.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      addPhotos(Array.prototype.slice.call(input.files || []));
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
      addPhotos(files);
    });

    // 站点
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
      var files = await pickFile('image/*', false);
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

    // 离开提醒
    window.addEventListener('beforeunload', function (e) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  /* ---------------- 增强功能 ---------------- */
  function updateSelCount() {
    var sel = document.querySelectorAll('.photo-sel:checked');
    var el = $('selCount');
    if (el) el.textContent = '已选 ' + sel.length + ' 张';

    var all = document.querySelectorAll('.photo-sel');
    var chk = $('checkAll');
    if (chk) chk.checked = all.length > 0 && sel.length === all.length;
  }

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

  function bindExtras() {
    // 导出 JSON
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

    // 导入 JSON
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
            if (!Array.isArray(d.cities) || !Array.isArray(d.photos)) {
              throw new Error('文件里缺少 cities / photos');
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

    // 缩略图放大预览
    var preview = $('preview');
    document.addEventListener('click', function (e) {
      // 勾选框在缩略图内部，点击它不应触发预览
      if (e.target.closest && e.target.closest('.photo-check')) return;
      var thumb = e.target.closest ? e.target.closest('.admin-thumb') : null;
      if (!thumb || !preview) return;
      var im = thumb.querySelector('img');
      if (!im) return;
      $('previewImg').src = im.src;
      preview.hidden = false;
    });
    if (preview) preview.addEventListener('click', function () { preview.hidden = true; });

    // 全选
    var chkAll = $('checkAll');
    if (chkAll) chkAll.addEventListener('change', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.photo-sel'), function (c) {
        c.checked = chkAll.checked;
      });
      updateSelCount();
    });

    var list = $('photoList');
    if (list) list.addEventListener('change', function (e) {
      if (e.target.classList && e.target.classList.contains('photo-sel')) updateSelCount();
    });

    // 批量删除
    var delSel = $('btnDeleteSelected');
    if (delSel) delSel.addEventListener('click', function () {
      var idx = [];
      Array.prototype.forEach.call(document.querySelectorAll('.photo-sel:checked'), function (c) {
        idx.push(parseInt(c.getAttribute('data-i'), 10));
      });
      if (!idx.length) { toast('还没选中照片', 'error'); return; }
      if (!confirm('删除选中的 ' + idx.length + ' 张照片？')) return;

      idx.sort(function (a, b) { return b - a; }).forEach(function (i) {
        data.photos.splice(i, 1);
      });
      markDirty();
      renderPhotos();
      toast('已删除 ' + idx.length + ' 张', 'ok');
    });

    // 拖拽排序
    bindDrag($('cityList'), function () { return data ? data.cities : null; }, renderCities);
    bindDrag($('photoList'), function () { return data ? data.photos : null; }, renderPhotos);

    // Ctrl / Cmd + S
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (data) save();
      }
    });
  }

  /* ---------------- 启动 ---------------- */
  loadCfg();
  bindEvents();
  bindExtras();

  // 配置齐全时自动连接
  if (cfg.owner && cfg.repo && cfg.token) {
    connect();
  }
})();
