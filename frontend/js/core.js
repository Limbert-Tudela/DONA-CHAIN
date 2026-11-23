

const DC = (() => {

  const host = (location.protocol === 'file:' || !location.hostname) ? 'localhost' : location.hostname;
  const proto = location.protocol === 'https:' ? 'https:' : 'http:';
  const BACKEND = `${proto}//${host}:8000/`;
  const API_URL = `${BACKEND}api.php`;

  const KEY_TOKEN = 'dc_token';
  const KEY_USER = 'dc_user';


  const Swal2 = (typeof Swal !== 'undefined') ? Swal.mixin({
    background: '#141c2c',
    color: '#e6e9ef',
    confirmButtonColor: '#c99a2e',
    cancelButtonColor: '#3a4868',
    denyButtonColor: '#d64545',
    customClass: { popup: 'dc-swal' },
  }) : null;


  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function safeDel(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }

  const token = () => safeGet(KEY_TOKEN);
  const user = () => { try { return JSON.parse(safeGet(KEY_USER) || 'null'); } catch (e) { return null; } };
  const logged = () => !!token() && !!user();
  const hasRole = (...roles) => logged() && roles.includes(user().rol);
  const isAdmin = () => hasRole('admin', 'superadmin');

  function setSession(tk, u) {
    safeSet(KEY_TOKEN, tk);
    safeSet(KEY_USER, JSON.stringify(u));
  }
  function updateUser(patch) {
    const u = user();
    if (u) safeSet(KEY_USER, JSON.stringify({ ...u, ...patch }));
  }
  function clearSession() {
    safeDel(KEY_TOKEN);
    safeDel(KEY_USER);
  }


  async function api(action, { method = 'GET', data = null, form = null, params = {}, raw = false } = {}) {
    const qs = new URLSearchParams({ action, ...params });
    Object.keys(params).forEach((k) => (params[k] === null || params[k] === undefined || params[k] === '') && qs.delete(k));
    const opts = { method, headers: {} };
    const tk = token();
    if (tk) opts.headers.Authorization = `Bearer ${tk}`;
    if (form) {
      opts.method = 'POST';
      opts.body = form;
    } else if (data) {
      opts.method = 'POST';
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }

    let res;
    try {
      res = await fetch(`${API_URL}?${qs.toString()}`, opts);
    } catch (e) {
      throw new Error('No se pudo conectar con el servidor (localhost:8000). ¿Está ejecutando "php -S localhost:8000" en la carpeta backend?');
    }

    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error(`Respuesta inválida del servidor (HTTP ${res.status}).`);
    }

    if (res.status === 401 && tk) {
      clearSession();
      toast('Su sesión expiró. Inicie sesión nuevamente.', 'warning');
      setTimeout(() => { location.href = 'index.html#login'; }, 1200);
    }
    if (!json.success) {
      const err = new Error(json.message || 'Error desconocido.');
      err.status = res.status;
      err.payload = json;
      throw err;
    }
    return raw ? json : json.data;
  }


  function toast(msg, type = 'success', titulo = null, delay = 4500) {
    let cont = document.getElementById('toastContainer');
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'toastContainer';
      cont.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(cont);
    }
    const icons = { success: 'bi-check-circle-fill text-emerald', error: 'bi-x-octagon-fill text-danger', warning: 'bi-exclamation-triangle-fill text-warning', info: 'bi-info-circle-fill text-info' };
    const titles = { success: 'Éxito', error: 'Error', warning: 'Atención', info: 'Información' };
    const el = document.createElement('div');
    el.className = `toast toast-${type} fade-in`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `
      <div class="toast-header">
        <i class="bi ${icons[type] || icons.info} me-2"></i>
        <strong class="me-auto">${esc(titulo || titles[type] || 'DONA-CHAIN')}</strong>
        <small class="text-muted">ahora</small>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body">${esc(msg)}</div>`;
    cont.appendChild(el);
    if (window.bootstrap) {
      const t = new bootstrap.Toast(el, { delay });
      el.addEventListener('hidden.bs.toast', () => el.remove());
      t.show();
    } else {
      setTimeout(() => el.remove(), delay);
    }
  }

  function alertOk(titulo, html = '', extra = {}) {
    if (!Swal2) return alert(titulo);
    return Swal2.fire({ icon: 'success', title: titulo, html, ...extra });
  }
  function alertError(titulo, texto = '') {
    if (!Swal2) return alert(`${titulo}\n${texto}`);
    return Swal2.fire({ icon: 'error', title: titulo, text: texto });
  }
  async function confirmar(titulo, html = '', textoBoton = 'Sí, continuar', icon = 'question', colorBoton = null) {
    if (!Swal2) return confirm(titulo);
    const r = await Swal2.fire({
      icon, title: titulo, html, showCancelButton: true,
      confirmButtonText: textoBoton, cancelButtonText: 'Cancelar', reverseButtons: true, focusCancel: true,
      ...(colorBoton ? { confirmButtonColor: colorBoton } : {}),
    });
    return r.isConfirmed;
  }
  function cargando(titulo = 'Procesando…', texto = '') {
    if (!Swal2) return;
    Swal2.fire({ title: titulo, text: texto, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  }
  function cerrarCargando() { if (Swal2) Swal.close(); }


  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const nf = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (n, cur = 'Bs') => `${cur} ${nf.format(Number(n) || 0)}`;
  const num = (n, d = 0) => new Intl.NumberFormat('es-BO', { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(n) || 0);
  function fecha(s, conHora = true) {
    if (!s) return '—';
    const d = new Date(String(s).replace(' ', 'T'));
    if (isNaN(d)) return s;
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
      + (conHora ? ' ' + d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : '');
  }
  function haceTiempo(s) {
    const d = new Date(String(s).replace(' ', 'T'));
    const seg = Math.floor((Date.now() - d.getTime()) / 1000);
    if (isNaN(seg)) return '';
    if (seg < 60) return 'hace un momento';
    if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
    if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
    return `hace ${Math.floor(seg / 86400)} d`;
  }
  const short = (h, a = 10, b = 6) => (!h ? '—' : (h.length <= a + b + 1 ? h : `${h.slice(0, a)}…${h.slice(-b)}`));
  const iniciales = (n) => String(n || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  const uploadUrl = (p) => (p ? (p.startsWith('http') ? p : BACKEND + p) : '');

  const estado = (e) => `<span class="estado estado-${esc(e)}">${esc(e)}</span>`;
  const tipo = (t) => {
    const ic = { efectivo: 'bi-qr-code', crypto: 'bi-currency-bitcoin', especie: 'bi-box-seam' }[t] || 'bi-dot';
    return `<span class="tipo-badge tipo-${esc(t)}"><i class="bi ${ic} me-1"></i>${esc(t)}</span>`;
  };
  const rolBadge = (r) => {
    const c = { superadmin: 'bg-danger', admin: 'bg-warning text-dark', empresa: 'bg-info text-dark', donante: 'bg-secondary' }[r] || 'bg-secondary';
    return `<span class="badge ${c} text-uppercase">${esc(r)}</span>`;
  };
  const txLink = (h) => (h ? `<a class="hash" href="blockchain.html?tx=${encodeURIComponent(h)}" title="${esc(h)}">${esc(short(h))}</a>` : '<span class="text-muted">—</span>');

  function copiar(texto) {
    const ok = () => toast('Copiado al portapapeles.', 'info');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(ok).catch(() => fallback());
    } else fallback();
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = texto; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { /* nada */ }
      ta.remove();
    }
  }


  function qr(el, texto, size = 180) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return;
    el.innerHTML = '';
    if (typeof QRCode === 'undefined') {
      el.innerHTML = `<div class="text-dark small p-2" style="max-width:${size}px">${esc(texto)}</div>`;
      return;
    }
    // qrcodejs no maneja bien tildes/ñ: se normaliza a ASCII
    const ascii = String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '');
    try {
      new QRCode(el, { text: ascii, width: size, height: size, colorDark: '#0a0e16', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.L });
    } catch (e) {
      el.innerHTML = `<div class="text-dark small p-2" style="max-width:${size}px;word-break:break-all">${esc(ascii)}</div>`;
    }
  }


  function tablaOrdenable(table) {
    if (typeof table === 'string') table = document.getElementById(table);
    if (!table || table.dataset.sortReady) return;
    table.dataset.sortReady = '1';
    table.querySelectorAll('th[data-sort]').forEach((th, _i) => {
      th.addEventListener('click', () => {
        const idx = [...th.parentNode.children].indexOf(th);
        const tbody = table.tBodies[0];
        const asc = !th.classList.contains('sort-asc');
        table.querySelectorAll('th').forEach((x) => x.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(asc ? 'sort-asc' : 'sort-desc');
        const tipoCol = th.dataset.sort;
        const rows = [...tbody.rows].filter((r) => r.cells.length > 1);
        rows.sort((a, b) => {
          let x = a.cells[idx].dataset.v ?? a.cells[idx].innerText.trim();
          let y = b.cells[idx].dataset.v ?? b.cells[idx].innerText.trim();
          if (tipoCol === 'num') { x = parseFloat(String(x).replace(/[^\d.-]/g, '')) || 0; y = parseFloat(String(y).replace(/[^\d.-]/g, '')) || 0; }
          return (x > y ? 1 : x < y ? -1 : 0) * (asc ? 1 : -1);
        });
        rows.forEach((r) => tbody.appendChild(r));
      });
    });
  }
  function filtroTabla(input, table) {
    if (typeof input === 'string') input = document.getElementById(input);
    if (typeof table === 'string') table = document.getElementById(table);
    if (!input || !table) return;
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      [...table.tBodies[0].rows].forEach((r) => { r.style.display = !q || r.innerText.toLowerCase().includes(q) ? '' : 'none'; });
    });
  }
  const filaVacia = (cols, texto = 'Sin registros', icon = 'bi-inbox') =>
    `<tr><td colspan="${cols}"><div class="empty-state"><i class="bi ${icon}"></i>${esc(texto)}</div></td></tr>`;


  function renderNavbar(activo = '') {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    const u = user();
    const link = (href, icon, txt, key) =>
      `<li class="nav-item"><a class="nav-link ${activo === key ? 'active' : ''}" href="${href}"><i class="bi ${icon} me-1"></i>${txt}</a></li>`;

    let links = link('index.html', 'bi-grid-3x3-gap', 'Campañas', 'index')
              + link('blockchain.html', 'bi-boxes', 'Explorador', 'blockchain');
    if (u) links += link('perfil.html', 'bi-person-badge', 'Mi Perfil', 'perfil');
    if (u && ['admin', 'superadmin'].includes(u.rol)) links += link('admin.html', 'bi-speedometer2', 'Panel Admin', 'admin');
    if (u && u.rol === 'superadmin') links += link('verificar.html', 'bi-patch-check', 'Verificación', 'verificar');

    const derecha = u ? `
      <li class="nav-item dropdown me-2">
        <a class="nav-link notif-btn" href="#" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-label="Notificaciones">
          <i class="bi bi-bell fs-5"></i>
          <span id="notifBadge" class="notif-badge d-none">0</span>
        </a>
        <div class="dropdown-menu dropdown-menu-end notif-menu card-dc">
          <div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom" style="border-color:var(--dc-border-soft)!important">
            <strong><i class="bi bi-bell me-1 text-gold"></i>Notificaciones</strong>
            <button class="btn btn-sm btn-link text-gold p-0" id="notifMarcarTodas">Marcar todas</button>
          </div>
          <div id="notifList"><div class="p-3 text-muted small">Cargando…</div></div>
        </div>
      </li>
      <li class="nav-item dropdown">
        <a class="nav-link d-flex align-items-center gap-2" href="#" data-bs-toggle="dropdown">
          <span class="avatar">${esc(iniciales(u.nombre))}</span>
          <span class="d-none d-lg-inline text-start lh-sm">
            <span class="d-block fw-semibold small">${esc(u.nombre.split(' ')[0])}</span>
            <span class="d-block text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:.1em">${esc(u.rol)}</span>
          </span>
        </a>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><span class="dropdown-item-text small text-muted">${esc(u.email)}</span></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item" href="perfil.html"><i class="bi bi-person me-2"></i>Mi perfil</a></li>
          <li><a class="dropdown-item" href="perfil.html#mensajes"><i class="bi bi-chat-dots me-2"></i>Mensajes</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item text-danger" href="#" id="btnLogout"><i class="bi bi-box-arrow-right me-2"></i>Cerrar sesión</a></li>
        </ul>
      </li>` : `
      <li class="nav-item"><a class="btn btn-ghost btn-sm me-2" href="index.html#login" data-dc-login><i class="bi bi-box-arrow-in-right me-1"></i>Ingresar</a></li>
      <li class="nav-item"><a class="btn btn-gold btn-sm" href="index.html#registro" data-dc-registro><i class="bi bi-person-plus me-1"></i>Registrarse</a></li>`;

    nav.className = 'navbar navbar-expand-lg navbar-dark navbar-dc sticky-top';
    nav.innerHTML = `
      <div class="container">
        <a class="navbar-brand" href="index.html">
          <span class="brand-logo"><i class="bi bi-link-45deg"></i></span>
          <span>DONA-CHAIN<span class="brand-sub">TRANSPARENCIA 2.0</span></span>
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMain"><span class="navbar-toggler-icon"></span></button>
        <div class="collapse navbar-collapse" id="navMain">
          <ul class="navbar-nav me-auto ms-lg-4 gap-lg-1">${links}</ul>
          <ul class="navbar-nav align-items-lg-center">${derecha}</ul>
        </div>
      </div>`;

    const lo = document.getElementById('btnLogout');
    if (lo) {
      lo.addEventListener('click', async (e) => {
        e.preventDefault();
        if (await confirmar('¿Cerrar sesión?', 'Tendrá que volver a ingresar sus credenciales.', 'Cerrar sesión', 'question')) {
          clearSession();
          location.href = 'index.html';
        }
      });
    }
    if (u && window.Notificaciones) window.Notificaciones.iniciar();
  }

  function renderFooter() {
    const f = document.getElementById('footer');
    if (!f) return;
    f.className = 'footer-dc mt-5';
    f.innerHTML = `
      <div class="container py-4">
        <div class="row g-3 align-items-center">
          <div class="col-md-6">
            <div class="d-flex align-items-center gap-2">
              <span class="brand-logo" style="width:30px;height:30px;font-size:.95rem"><i class="bi bi-link-45deg"></i></span>
              <strong class="text-light">DONA-CHAIN 2.0</strong>
            </div>
            <div class="mt-2">Plataforma de donaciones transparentes con blockchain simulada (SHA-256 · Proof of Work).</div>
          </div>
          <div class="col-md-6 text-md-end">
            <a href="blockchain.html" class="me-3"><i class="bi bi-boxes me-1"></i>Explorador</a>
            <a href="index.html#campanas"><i class="bi bi-heart me-1"></i>Campañas</a>
            <div class="mt-2 small">Proyecto de Grado · Ingeniería de Sistemas · ${new Date().getFullYear()}</div>
          </div>
        </div>
      </div>`;
  }


  function requireAuth(roles = []) {
    if (!logged()) {
      location.href = 'index.html#login';
      return false;
    }
    if (roles.length && !roles.includes(user().rol)) {
      document.body.innerHTML = `
        <div class="container py-5 text-center">
          <i class="bi bi-shield-lock display-1 text-danger"></i>
          <h2 class="mt-3">Acceso restringido</h2>
          <p class="text-muted">Esta sección requiere el rol: <strong>${roles.join(' / ')}</strong>.</p>
          <a href="index.html" class="btn btn-gold mt-2">Volver al inicio</a>
        </div>`;
      return false;
    }
    return true;
  }

  const qp = (k) => new URLSearchParams(location.search).get(k);

  async function conBoton(btn, fn, textoCargando = 'Procesando…') {
    const html = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${textoCargando}`; }
    try { return await fn(); } finally { if (btn) { btn.disabled = false; btn.innerHTML = html; } }
  }

  function verDocumento(url, titulo = 'Documento') {
    if (!url) return toast('No hay documento adjunto.', 'warning');
    const full = uploadUrl(url);
    const esPdf = /\.pdf$/i.test(full);
    if (!Swal2) return window.open(full, '_blank');
    Swal2.fire({
      title: titulo,
      width: 760,
      html: esPdf
        ? `<iframe src="${esc(full)}" style="width:100%;height:520px;border:0;border-radius:10px;background:#fff"></iframe>`
        : `<img src="${esc(full)}" style="max-width:100%;border-radius:10px;border:1px solid #232d42" alt="${esc(titulo)}"
               onerror="this.outerHTML='<div class=&quot;text-muted py-5&quot;>No se pudo cargar la imagen.</div>'">`,
      footer: `<a href="${esc(full)}" target="_blank" rel="noopener">Abrir en otra pestaña <i class="bi bi-box-arrow-up-right"></i></a>`,
      confirmButtonText: 'Cerrar',
    });
  }

  return {
    API_URL, BACKEND, Swal: Swal2,
    token, user, logged, hasRole, isAdmin, setSession, updateUser, clearSession,
    api, toast, alertOk, alertError, confirmar, cargando, cerrarCargando,
    esc, money, num, fecha, haceTiempo, short, iniciales, uploadUrl, estado, tipo, rolBadge, txLink, copiar,
    qr, tablaOrdenable, filtroTabla, filaVacia, renderNavbar, renderFooter, requireAuth, qp, conBoton, verDocumento,
  };
})();
