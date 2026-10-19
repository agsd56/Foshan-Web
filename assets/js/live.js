/* ==========================================================================
   实时数据 — 从同源 /api/stats 读取 EarthMC 官方数据
   HTML 中已内置静态兜底值，接口不可用时页面完全正常，不会出现空值。
   ========================================================================== */
(function () {
  var nodes = document.querySelectorAll('[data-live]');
  if (!nodes.length) return;

  /* 更新文本，但保留元素内原有的 <small> 单位标签 */
  function set(key, value) {
    if (value === null || value === undefined || value === '') return;
    document.querySelectorAll('[data-live="' + key + '"]').forEach(function (el) {
      var unit = el.querySelector('small');
      el.textContent = value;
      if (unit) el.appendChild(unit);
    });
  }

  function fmtDate(v) {
    if (!v) return null;
    var p = String(v).split('-');
    return p.length === 3 ? p[0] + '.' + p[1] + '.' + p[2] : v;
  }

  function fmtNum(n) {
    if (n === null || n === undefined) return null;
    return Number(n).toLocaleString('en-US');
  }

  /* 常见城镇英文名 → 中文，避免中文页面里出现 "Nanjing" */
  var CITY_CN = {
    Nanjing: '南京', Beijing: '北京', Shanghai: '上海', Guangzhou: '广州',
    Shenzhen: '深圳', Hangzhou: '杭州', Suzhou: '苏州', Wuhan: '武汉',
    Nanchang: '南昌', Chengdu: '成都', Xian: '西安', Tianjin: '天津',
    Chongqing: '重庆', Qingdao: '青岛', Foshan: '佛山', Xiamen: '厦门',
    Hong_Kong: '香港', Macau: '澳门', Sanya: '三亚', Kunming: '昆明',
  };

  function cnCity(name) {
    return (name && CITY_CN[name]) || name;
  }

  fetch('/api/stats', { headers: { Accept: 'application/json' } })
    .then(function (res) {
      if (!res.ok) throw new Error('stats unavailable');
      return res.json();
    })
    .then(function (d) {
      if (!d || !d.ok || !d.town) return;
      var t = d.town;

      set('residents', t.residents);
      set('blocks', t.blocks);
      set('maxblocks', t.maxBlocks);
      set('trusted', t.trusted);
      set('mayor', t.mayor);
      set('nation', t.nation);
      set('founded', fmtDate(t.founded));
      set('joined', fmtDate(t.joinedNation));
      set('open', t.isOpen ? '开放加入' : '需邀请');

      if (d.nation) {
        set('n-residents', d.nation.residents);
        set('n-towns', d.nation.towns);
        set('n-blocks', fmtNum(d.nation.blocks));
        set('n-king', d.nation.king);
        set('n-capital', cnCity(d.nation.capital));
        set('n-founded', fmtDate(d.nation.founded));
      }

      document.documentElement.setAttribute('data-live-ok', '1');
    })
    .catch(function () {
      /* 静默失败：保留页面内的静态数据 */
    });
})();
