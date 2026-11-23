/* =====================================================================
   DONA-CHAIN 2.0 · notificaciones.js
   Polling cada 10 segundos al endpoint "obtener_notificaciones":
   - Actualiza el contador (campana) de la navbar.
   - Llena el menú desplegable con las notificaciones recientes.
   - Muestra un Toast por cada notificación NUEVA.
   - Permite marcar una o todas como leídas.
   ===================================================================== */

window.Notificaciones = (() => {
  const INTERVALO_MS = 10000;
  const KEY_ULTIMA = 'dc_ultima_notif';
  let timer = null;
  let primeraCarga = true;
  let ultimoId = 0;
  let iniciado = false;

  function leerUltimo() {
    try { return parseInt(localStorage.getItem(`${KEY_ULTIMA}_${DC.user()?.id}`) || '0', 10); } catch (e) { return 0; }
  }
  function guardarUltimo(id) {
    try { localStorage.setItem(`${KEY_ULTIMA}_${DC.user()?.id}`, String(id)); } catch (e) { /* nada */ }
  }

  async function cargar() {
    if (!DC.logged()) return detener();
    try {
      const d = await DC.api('obtener_notificaciones');
      render(d);

      // Toasts solo para notificaciones nuevas (id mayor al último visto)
      const nuevas = d.no_leidas.filter((n) => Number(n.id) > ultimoId);
      if (primeraCarga) {
        if (d.total_no_leidas > 0 && nuevas.length > 0) {
          DC.toast(`Tienes ${d.total_no_leidas} notificación(es) sin leer.`, 'info', 'Notificaciones');
        }
      } else {
        nuevas.slice(0, 3).reverse().forEach((n) => DC.toast(n.mensaje, 'info', n.titulo, 6000));
        if (nuevas.length) document.dispatchEvent(new CustomEvent('dc:notificaciones', { detail: nuevas }));
      }
      const maxId = Math.max(ultimoId, ...d.recientes.map((n) => Number(n.id)), 0);
      if (maxId > ultimoId) { ultimoId = maxId; guardarUltimo(maxId); }
      primeraCarga = false;

      // Contador de mensajes no leídos (si la página tiene el indicador)
      const mb = document.getElementById('mensajesBadge');
      if (mb) {
        mb.textContent = d.mensajes_no_leidos;
        mb.classList.toggle('d-none', !d.mensajes_no_leidos);
      }
    } catch (e) {
      // Error de red: se reintentará en el próximo ciclo sin molestar al usuario
      console.warn('[Notificaciones]', e.message);
    }
  }

  function render(d) {
    const badge = document.getElementById('notifBadge');
    const list = document.getElementById('notifList');
    if (badge) {
      badge.textContent = d.total_no_leidas > 99 ? '99+' : d.total_no_leidas;
      badge.classList.toggle('d-none', !d.total_no_leidas);
      badge.classList.toggle('pulse', d.total_no_leidas > 0);
    }
    if (!list) return;
    if (!d.recientes.length) {
      list.innerHTML = '<div class="empty-state py-4"><i class="bi bi-bell-slash"></i>No tienes notificaciones</div>';
      return;
    }
    list.innerHTML = d.recientes.map((n) => `
      <div class="notif-item ${Number(n.leida) ? '' : 'unread'}" data-id="${n.id}">
        <div class="t">${DC.esc(n.titulo)}</div>
        <div class="m">${DC.esc(n.mensaje)}</div>
        <div class="f"><i class="bi bi-clock me-1"></i>${DC.haceTiempo(n.fecha)}</div>
      </div>`).join('');
    list.querySelectorAll('.notif-item.unread').forEach((el) => {
      el.addEventListener('click', () => marcar(el.dataset.id, el));
    });
  }

  async function marcar(id, el) {
    try {
      await DC.api('marcar_notificacion', { data: { id } });
      if (el) el.classList.remove('unread');
      cargar();
    } catch (e) { DC.toast(e.message, 'error'); }
  }

  async function marcarTodas() {
    try {
      const r = await DC.api('marcar_notificacion', { data: { todas: true } });
      DC.toast(`${r.marcadas} notificación(es) marcadas como leídas.`, 'success');
      cargar();
    } catch (e) { DC.toast(e.message, 'error'); }
  }

  function iniciar() {
    if (!DC.logged()) return;
    ultimoId = leerUltimo();
    const btn = document.getElementById('notifMarcarTodas');
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); marcarTodas(); });
    if (iniciado) { cargar(); return; }
    iniciado = true;
    cargar();
    timer = setInterval(cargar, INTERVALO_MS);
    // Pausa el polling cuando la pestaña no está visible (ahorra peticiones)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { clearInterval(timer); timer = null; } else if (!timer && DC.logged()) { cargar(); timer = setInterval(cargar, INTERVALO_MS); }
    });
  }

  function detener() { if (timer) clearInterval(timer); timer = null; }

  return { iniciar, detener, cargar, marcarTodas };
})();
