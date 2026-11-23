
(() => {
  if (!DC.requireAuth(['admin', 'superadmin'])) return;

  const st = { pendientes: [], seleccion: new Set(), usuarios: [], ultimaSim: null };

  document.addEventListener('DOMContentLoaded', () => {
    DC.renderNavbar('admin');
    DC.renderFooter();
    if (DC.hasRole('superadmin')) document.getElementById('navVerificar').classList.remove('d-none');

    ['tablaPendientes', 'tablaCampanas', 'tablaUsuarios', 'tablaAuditoria'].forEach(DC.tablaOrdenable);
    DC.filtroTabla('buscarCampAdmin', 'tablaCampanas');

    document.querySelectorAll('#adminNav [data-sec]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      mostrarSeccion(a.dataset.sec);
    }));
    window.addEventListener('hashchange', () => mostrarSeccion(location.hash.slice(1) || 'dashboard', false));

    document.getElementById('btnRefrescar').addEventListener('click', cargarDashboard);
    document.getElementById('btnValidar').addEventListener('click', validarBlockchain);
    document.getElementById('btnMinar').addEventListener('click', minarBloque);

    document.getElementById('checkTodos').addEventListener('change', (e) => {
      document.querySelectorAll('#tablaPendientes tbody tr:not([style*="none"]) .chk-don').forEach((c) => {
        c.checked = e.target.checked;
        c.checked ? st.seleccion.add(Number(c.value)) : st.seleccion.delete(Number(c.value));
      });
      actualizarSeleccion();
    });
    document.getElementById('btnAprobar').addEventListener('click', () => conciliar('aprobar'));
    document.getElementById('btnRechazar').addEventListener('click', () => conciliar('rechazar'));
    document.getElementById('buscarPendiente').addEventListener('input', filtrarPendientes);
    document.getElementById('filtroTipoPendiente').addEventListener('change', filtrarPendientes);
    document.getElementById('formCodigo').addEventListener('submit', confirmarCodigo);

    let t;
    document.getElementById('buscarUsuario').addEventListener('input', () => { clearTimeout(t); t = setTimeout(cargarUsuarios, 350); });
    document.getElementById('filtroRol').addEventListener('change', cargarUsuarios);
    document.getElementById('filtroEstado').addEventListener('change', cargarUsuarios);

    document.getElementById('verTodosReportes').addEventListener('change', cargarReportes);

    document.getElementById('formFondo').addEventListener('submit', crearFondo);
    document.getElementById('formSimular').addEventListener('submit', (e) => { e.preventDefault(); simular(Number(document.getElementById('montoSimular').value)); });

    document.getElementById('formCategoria').addEventListener('submit', crearCategoria);
    document.getElementById('formEspecie').addEventListener('submit', crearEspecie);

    document.getElementById('formAuditoria').addEventListener('submit', (e) => { e.preventDefault(); cargarAuditoria(); });

    document.addEventListener('dc:notificaciones', () => { cargarDashboard(); if (seccionActual() === 'conciliacion') cargarPendientes(); });

    mostrarSeccion(location.hash.slice(1) || 'dashboard', false);
    cargarDashboard();
  });


  const cargadores = {
    dashboard: () => cargarDashboard(),
    conciliacion: () => cargarPendientes(),
    campanas: () => cargarCampanas(),
    usuarios: () => cargarUsuarios(),
    reportes: () => cargarReportes(),
    optimizacion: () => { cargarFondos(); cargarHistorial(); },
    catalogos: () => cargarCatalogos(),
    auditoria: () => cargarAuditoria(),
  };
  const seccionActual = () => document.querySelector('#adminNav .nav-link.active')?.dataset.sec;

  function mostrarSeccion(sec, push = true) {
    if (!cargadores[sec]) sec = 'dashboard';
    document.querySelectorAll('.admin-sec').forEach((s) => s.classList.add('d-none'));
    document.getElementById(`sec-${sec}`).classList.remove('d-none');
    document.querySelectorAll('#adminNav [data-sec]').forEach((a) => a.classList.toggle('active', a.dataset.sec === sec));
    if (push) history.replaceState(null, '', `#${sec}`);
    if (sec !== 'dashboard') cargadores[sec]();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  async function cargarDashboard() {
    try {
      const m = await DC.api('metricas');
      document.getElementById('kRecaudado').textContent = DC.money(m.total_recaudado);
      document.getElementById('kConfirmadas').textContent = DC.num(m.confirmadas);
      document.getElementById('kPendientes').textContent = DC.num(m.pendientes);
      document.getElementById('kDonantes').textContent = DC.num(m.donantes_unicos);
      document.getElementById('kCampanas').textContent = DC.num(m.campanas_activas);
      document.getElementById('kBloques').textContent = DC.num(m.total_bloques);
      document.getElementById('kMempool').textContent = `${m.tx_pendientes} / ${m.blockchain.tx_por_bloque}`;
      document.getElementById('kKyc').textContent = `${m.kyc_pendientes} / ${m.org_pendientes}`;
      document.getElementById('navPendientes').textContent = m.pendientes;
      document.getElementById('navReportes').textContent = m.reportes_abiertos;

      document.getElementById('chartCampanas').innerHTML = m.por_campana.length ? m.por_campana.map((c) => `
        <div class="hbar">
          <div class="lbl"><span class="text-truncate me-2">${DC.esc(c.titulo)}</span><span class="text-nowrap"><strong class="text-gold">${DC.money(c.fondos_recaudados)}</strong> <span class="text-muted">/ ${DC.money(c.meta_fondos)} · ${Number(c.porcentaje) || 0}%</span></span></div>
          <div class="track"><div class="fill" data-w="${Math.max(Number(c.porcentaje) || 0, 1)}"></div></div>
        </div>`).join('') : '<div class="empty-state"><i class="bi bi-bar-chart"></i>Sin campañas</div>';

      const colores = { efectivo: '#4ea8de', crypto: '#a78bfa', especie: '#f0b429' };
      const total = m.por_tipo.reduce((s, x) => s + Number(x.cantidad), 0);
      let acum = 0;
      const segs = m.por_tipo.map((x) => {
        const ini = acum; acum += (Number(x.cantidad) / (total || 1)) * 100;
        return `${colores[x.tipo_donacion]} ${ini}% ${acum}%`;
      });
      document.getElementById('donutTipos').style.background = total ? `conic-gradient(${segs.join(',')})` : 'conic-gradient(#2a3550 0 100%)';
      document.getElementById('donutTotal').textContent = total;
      document.getElementById('donutLeyenda').innerHTML = ['efectivo', 'crypto', 'especie'].map((tp) => {
        const x = m.por_tipo.find((y) => y.tipo_donacion === tp) || { cantidad: 0, monto: 0 };
        return `<div class="d-flex justify-content-between small py-1 border-bottom" style="border-color:var(--dc-border-soft)!important">
          <span><span class="legend-dot" style="background:${colores[tp]}"></span>${tp}</span>
          <span><strong>${x.cantidad}</strong> <span class="text-muted">· ${tp === 'especie' ? '—' : DC.money(x.monto)}</span></span></div>`;
      }).join('');

      const max = Math.max(...m.ultimos_7_dias.map((d) => d.monto), 1);
      document.getElementById('chartDias').innerHTML = m.ultimos_7_dias.map((d) => `
        <div class="col-bar"><div class="bar" data-h="${(d.monto / max) * 100}" title="${d.cantidad} donación(es)"><span>${d.monto ? DC.money(d.monto).replace('Bs ', '') : ''}</span></div></div>`).join('');
      document.getElementById('chartDiasLbl').innerHTML = m.ultimos_7_dias.map((d) => {
        const f = new Date(`${d.dia}T12:00:00`);
        return `<div>${f.toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit' })}<br><span class="text-light">${d.cantidad}</span></div>`;
      }).join('');

      requestAnimationFrame(() => {
        document.querySelectorAll('.hbar .fill[data-w]').forEach((f) => { f.style.width = `${f.dataset.w}%`; });
        document.querySelectorAll('.vchart .bar[data-h]').forEach((b) => { b.style.height = `${b.dataset.h}%`; });
      });
    } catch (e) { DC.toast(e.message, 'error'); }
  }


  async function validarBlockchain() {
    const btn = document.getElementById('btnValidar');
    await DC.conBoton(btn, async () => {
      try {
        const r = await DC.api('validar_blockchain');
        const box = document.getElementById('estadoCadena');
        if (r.valida) {
          DC.toast(`Cadena íntegra: ${r.total_bloques} bloque(s) verificados correctamente.`, 'success', 'Blockchain válida');
          box.innerHTML = `
            <div class="chain-status ok fade-in">
              <i class="bi bi-shield-fill-check big text-emerald"></i>
              <div><strong>Cadena íntegra</strong><div class="small text-muted">${r.total_bloques} bloques verificados · hashes SHA-256, Proof of Work y enlaces correctos · ${DC.fecha(r.fecha_validacion)}</div></div>
            </div>`;
        } else {
          const alterados = r.bloques.filter((b) => b.estado !== 'valido');
          box.innerHTML = `
            <div class="chain-status bad">
              <i class="bi bi-exclamation-octagon-fill big text-danger"></i>
              <div class="flex-grow-1"><strong class="text-danger">CADENA ALTERADA</strong>
                <div class="small">${DC.esc(r.mensaje)}</div></div>
              <a href="blockchain.html" class="btn btn-sm btn-outline-danger">Ver explorador</a>
            </div>`;
          DC.Swal.fire({
            icon: 'error',
            title: '⚠ Cadena alterada',
            iconColor: '#ef5b5b',
            html: `<p class="text-danger fw-semibold">${DC.esc(r.mensaje)}</p>
              <div class="text-start small" style="max-height:260px;overflow:auto">
                ${alterados.map((b) => `<div class="mb-2 p-2 rounded" style="background:#ef5b5b14;border:1px solid #ef5b5b44">
                  <strong>Bloque #${b.indice}</strong> ${DC.estado(b.estado)}
                  <ul class="mb-0 mt-1 ps-3">${b.errores.map((x) => `<li>${DC.esc(x)}</li>`).join('')}</ul></div>`).join('')}
              </div>`,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#d64545',
            width: 640,
          });
        }
      } catch (e) { DC.alertError('No se pudo validar', e.message); }
    }, 'Validando…');
  }

  async function minarBloque() {
    if (!await DC.confirmar('¿Minar un bloque ahora?',
      'Se agruparán las transacciones pendientes del mempool (aunque sean menos de 5) y se buscará un <em>nonce</em> cuyo hash SHA-256 empiece con <strong class="mono">00</strong>.',
      'Minar', 'question')) return;
    DC.cargando('Minando bloque…', 'Buscando un nonce válido (Proof of Work)');
    try {
      const b = await DC.api('minar_bloque', { data: {} });
      DC.alertOk(`Bloque #${b.indice} minado`, `
        <div class="text-start small">
          <div><span class="text-muted">Transacciones:</span> <strong>${b.transacciones}</strong></div>
          <div><span class="text-muted">Nonce encontrado:</span> <strong class="text-gold">${b.nonce}</strong> (${b.intentos} intentos, ${b.tiempo_ms} ms)</div>
          <div class="mt-2 text-muted">Hash</div><div class="hash">${DC.esc(b.hash_actual)}</div>
          <div class="mt-2 text-muted">Hash anterior</div><div class="hash">${DC.esc(b.hash_anterior)}</div>
        </div>`);
      cargarDashboard();
    } catch (e) { DC.alertError('No se pudo minar', e.message); }
  }

  
  async function cargarPendientes() {
    const tb = document.querySelector('#tablaPendientes tbody');
    try {
      st.pendientes = await DC.api('listar_pendientes');
      st.seleccion.clear();
      document.getElementById('checkTodos').checked = false;
      document.getElementById('navPendientes').textContent = st.pendientes.length;
      if (!st.pendientes.length) {
        tb.innerHTML = DC.filaVacia(9, '¡Todo al día! No hay donaciones pendientes.', 'bi-check2-all');
        actualizarSeleccion();
        return;
      }
      tb.innerHTML = st.pendientes.map((d) => `
        <tr data-tipo="${d.tipo_donacion}">
          <td><input class="form-check-input chk-don" type="checkbox" value="${d.id}"></td>
          <td data-v="${d.id}">${d.id}</td>
          <td>${DC.esc(d.donante || '—')}<div class="small text-muted">${DC.esc(d.email || '')}</div></td>
          <td class="mono small">${DC.esc(d.ci || '—')}</td>
          <td class="small">${DC.esc(d.campana)}</td>
          <td>${DC.tipo(d.tipo_donacion)}</td>
          <td data-v="${d.tipo_donacion === 'especie' ? d.cantidad_especie : d.monto}" class="text-nowrap">${d.tipo_donacion === 'especie'
            ? `${DC.num(d.cantidad_especie, 2)} ${DC.esc(d.unidad_medida)}<div class="small text-muted">${DC.esc(d.especie)}</div>`
            : `<strong class="text-gold">${DC.money(d.monto)}</strong>`}</td>
          <td>${d.comprobante_url
            ? `<button class="btn btn-sm btn-ghost" data-ver="${d.id}"><i class="bi bi-image me-1"></i>Ver</button>`
            : d.codigo_recepcion ? `<span class="mono text-gold">${DC.esc(d.codigo_recepcion)}</span>` : '<span class="text-muted">—</span>'}</td>
          <td class="small" data-v="${d.fecha}">${DC.fecha(d.fecha)}</td>
        </tr>`).join('');
      tb.querySelectorAll('.chk-don').forEach((c) => c.addEventListener('change', () => {
        c.checked ? st.seleccion.add(Number(c.value)) : st.seleccion.delete(Number(c.value));
        actualizarSeleccion();
      }));
      tb.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => {
        const d = st.pendientes.find((x) => String(x.id) === b.dataset.ver);
        DC.verDocumento(d.comprobante_url, `Comprobante · Donación #${d.id} · ${DC.money(d.monto)}`);
      }));
      filtrarPendientes();
      actualizarSeleccion();
    } catch (e) { tb.innerHTML = DC.filaVacia(9, e.message, 'bi-wifi-off'); }
  }

  function filtrarPendientes() {
    const q = document.getElementById('buscarPendiente').value.toLowerCase().trim();
    const tipo = document.getElementById('filtroTipoPendiente').value;
    document.querySelectorAll('#tablaPendientes tbody tr[data-tipo]').forEach((r) => {
      const ok = (!q || r.innerText.toLowerCase().includes(q)) && (!tipo || r.dataset.tipo === tipo);
      r.style.display = ok ? '' : 'none';
    });
  }

  function actualizarSeleccion() {
    const n = st.seleccion.size;
    document.getElementById('seleccionInfo').textContent = `${n} seleccionada(s)`;
    document.getElementById('btnAprobar').disabled = !n;
    document.getElementById('btnRechazar').disabled = !n;
  }

  async function conciliar(accion) {
    const ids = [...st.seleccion];
    if (!ids.length) return;
    const sel = st.pendientes.filter((d) => ids.includes(Number(d.id)));
    const total = sel.filter((d) => d.tipo_donacion !== 'especie').reduce((s, d) => s + Number(d.monto), 0);

    const ok = await DC.confirmar('¿Estás seguro?',
      accion === 'aprobar'
        ? `Vas a <strong class="text-emerald">conciliar ${ids.length} donación(es)</strong> por un total de <strong class="text-gold">${DC.money(total)}</strong>.
           <div class="small text-muted mt-2">Se sumarán a las campañas, se crearán las transacciones en la blockchain y, cada 5 TX, se minará un bloque. <strong>Esta acción es irreversible.</strong></div>`
        : `Vas a <strong class="text-danger">rechazar ${ids.length} donación(es)</strong>. Los donantes serán notificados.`,
      accion === 'aprobar' ? 'Sí, conciliar' : 'Sí, rechazar',
      'warning',
      accion === 'aprobar' ? '#16b483' : '#d64545');
    if (!ok) return;

    DC.cargando(accion === 'aprobar' ? 'Conciliando…' : 'Rechazando…', 'Registrando en la blockchain');
    try {
      const r = await DC.api('conciliar', { data: { ids, accion } });
      const minados = r.bloques_minados.map((b) => `<li>Bloque <strong>#${b.indice}</strong> · nonce ${b.nonce} · <span class="hash">${DC.esc(DC.short(b.hash_actual, 12, 6))}</span></li>`).join('');
      DC.alertOk(`${r.total} donación(es) ${accion === 'aprobar' ? 'conciliadas' : 'rechazadas'}`,
        minados ? `<div class="text-start small mt-2"><i class="bi bi-hammer text-gold me-1"></i>Bloques minados automáticamente:<ul class="mt-1">${minados}</ul></div>` : '');
      cargarPendientes();
      cargarDashboard();
    } catch (e) { DC.alertError('Error en la conciliación', e.message); }
  }

  async function confirmarCodigo(e) {
    e.preventDefault();
    const input = document.getElementById('codigoRecepcion');
    const codigo = input.value.trim().toUpperCase();
    if (!/^DC-[0-9A-F]{6}$/.test(codigo)) return DC.toast('Formato de código inválido (ej: DC-4F7A21).', 'warning');
    if (!await DC.confirmar('¿Confirmar recepción?', `Se marcará como <strong>recibida</strong> la donación en especie con código <span class="mono text-gold">${DC.esc(codigo)}</span>.`, 'Confirmar', 'question', '#16b483')) return;
    await DC.conBoton(document.getElementById('btnCodigo'), async () => {
      try {
        const r = await DC.api('confirmar_recepcion', { data: { codigo } });
        input.value = '';
        DC.alertOk('Recepción confirmada', `Transacción: <div class="hash">${DC.esc(r.procesadas[0]?.tx_hash || '')}</div>`);
        cargarPendientes();
      } catch (err) { DC.alertError('No se pudo confirmar', err.message); }
    });
  }


  async function cargarCampanas() {
    const tb = document.querySelector('#tablaCampanas tbody');
    try {
      const cs = await DC.api('listar_todas_campanas');
      tb.innerHTML = cs.length ? cs.map((c) => `
        <tr>
          <td data-v="${c.id}">${c.id}</td>
          <td>${DC.esc(c.titulo)}<div class="small text-muted">${DC.esc(c.categoria || '')}</div></td>
          <td class="small">${DC.esc(c.organizacion)}</td>
          <td data-v="${c.fondos_recaudados}" class="text-nowrap">${DC.money(c.fondos_recaudados)}<div class="small text-muted">de ${DC.money(c.meta_fondos)}</div></td>
          <td data-v="${c.porcentaje || 0}" style="min-width:110px"><div class="progress progress-dc"><div class="progress-bar" style="width:${Number(c.porcentaje) || 0}%"></div></div><small>${Number(c.porcentaje) || 0}%</small></td>
          <td class="small">${c.fecha_cierre ? DC.fecha(c.fecha_cierre, false) : '—'}</td>
          <td><div class="form-check form-switch"><input class="form-check-input" type="checkbox" data-urg="${c.id}" ${Number(c.es_urgente) ? 'checked' : ''}></div></td>
          <td><select class="form-select form-select-sm" data-est="${c.id}" style="min-width:130px">
            ${['borrador', 'activa', 'finalizada'].map((e) => `<option value="${e}" ${c.estado === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select></td>
        </tr>`).join('') : DC.filaVacia(8, 'No hay campañas.');
      tb.querySelectorAll('[data-est]').forEach((s) => s.addEventListener('change', async () => {
        try { await DC.api('cambiar_estado_campana', { data: { id: s.dataset.est, estado: s.value } }); DC.toast(`Campaña #${s.dataset.est} → ${s.value}`, 'success'); } catch (e) { DC.toast(e.message, 'error'); cargarCampanas(); }
      }));
      tb.querySelectorAll('[data-urg]').forEach((s) => s.addEventListener('change', async () => {
        try { await DC.api('cambiar_estado_campana', { data: { id: s.dataset.urg, es_urgente: s.checked } }); DC.toast('Urgencia actualizada.', 'success'); } catch (e) { DC.toast(e.message, 'error'); }
      }));
    } catch (e) { tb.innerHTML = DC.filaVacia(8, e.message, 'bi-wifi-off'); }
  }


  async function cargarUsuarios() {
    const tb = document.querySelector('#tablaUsuarios tbody');
    try {
      st.usuarios = await DC.api('listar_usuarios', {
        params: {
          buscar: document.getElementById('buscarUsuario').value.trim(),
          rol: document.getElementById('filtroRol').value,
          estado: document.getElementById('filtroEstado').value,
        },
      });
      const yo = DC.user().id;
      tb.innerHTML = st.usuarios.length ? st.usuarios.map((u) => {
        const bloqueado = u.bloqueado_hasta && new Date(u.bloqueado_hasta.replace(' ', 'T')) > new Date();
        return `<tr>
          <td data-v="${u.id}">${u.id}</td>
          <td><div class="d-flex align-items-center gap-2"><span class="avatar" style="width:32px;height:32px;font-size:.75rem">${DC.esc(DC.iniciales(u.nombre))}</span>
            <div>${DC.esc(u.nombre)}<div class="small text-muted">${DC.esc(u.email)}</div></div></div></td>
          <td class="mono small">${DC.esc(u.ci)}</td>
          <td>${DC.rolBadge(u.rol)}</td>
          <td>${Number(u.ci_verificado) ? '<span class="badge badge-verified"><i class="bi bi-patch-check-fill"></i> Verificado</span>'
              : u.ci_foto_url ? '<span class="badge badge-unverified">En revisión</span>' : '<span class="badge bg-secondary">Sin CI</span>'}</td>
          <td class="small">${Number(u.tiene_2fa) ? '<i class="bi bi-shield-check text-emerald" title="2FA activo"></i> 2FA' : '<span class="text-muted">—</span>'}
            ${bloqueado ? '<span class="badge bg-danger ms-1" title="Bloqueado por intentos fallidos"><i class="bi bi-lock-fill"></i></span>' : ''}</td>
          <td data-v="${u.saldo || 0}" class="small text-nowrap">${DC.money(u.saldo, 'DCT')}</td>
          <td>${DC.estado(u.estado)}</td>
          <td class="text-end text-nowrap">
            ${bloqueado ? `<button class="btn btn-sm btn-ghost" data-unlock="${u.id}" title="Desbloquear"><i class="bi bi-unlock"></i></button>` : ''}
            ${Number(u.id) === Number(yo) || u.rol === 'superadmin' ? '<span class="small text-muted">—</span>'
              : u.estado === 'activo'
                ? `<button class="btn btn-sm btn-outline-danger" data-susp="${u.id}" data-nombre="${DC.esc(u.nombre)}"><i class="bi bi-person-x me-1"></i>Suspender</button>`
                : `<button class="btn btn-sm btn-emerald" data-act="${u.id}"><i class="bi bi-person-check me-1"></i>Activar</button>`}
          </td></tr>`;
      }).join('') : DC.filaVacia(9, 'Sin resultados.');

      tb.querySelectorAll('[data-susp]').forEach((b) => b.addEventListener('click', async () => {
        if (!await DC.confirmar('¿Suspender usuario?', `<strong>${b.dataset.nombre}</strong> no podrá iniciar sesión hasta ser reactivado.`, 'Suspender', 'warning', '#d64545')) return;
        cambiarEstadoUsuario(b.dataset.susp, 'suspendido');
      }));
      tb.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => cambiarEstadoUsuario(b.dataset.act, 'activo')));
      tb.querySelectorAll('[data-unlock]').forEach((b) => b.addEventListener('click', async () => {
        try { await DC.api('desbloquear_usuario', { data: { id: b.dataset.unlock } }); DC.toast('Usuario desbloqueado.', 'success'); cargarUsuarios(); } catch (e) { DC.toast(e.message, 'error'); }
      }));
    } catch (e) { tb.innerHTML = DC.filaVacia(9, e.message, 'bi-wifi-off'); }
  }

  async function cambiarEstadoUsuario(id, estado) {
    try {
      await DC.api('cambiar_estado_usuario', { data: { id, estado } });
      DC.toast(`Usuario ${estado}.`, estado === 'activo' ? 'success' : 'warning');
      cargarUsuarios();
    } catch (e) { DC.alertError('Error', e.message); }
  }


  async function cargarReportes() {
    const el = document.getElementById('listaReportesAdmin');
    try {
      const reps = await DC.api('listar_reportes', { params: { todos: document.getElementById('verTodosReportes').checked ? 1 : '' } });
      el.innerHTML = reps.length ? reps.map((r) => `
        <div class="card-dc p-3 mb-3 fade-in">
          <div class="d-flex flex-wrap justify-content-between gap-2">
            <div><strong>Reporte #${r.id}</strong> · <span class="text-muted small">${DC.esc(r.usuario || 'Usuario eliminado')} (${DC.esc(r.email || '')}) · ${DC.fecha(r.fecha)}</span></div>
            ${DC.estado(r.estado)}
          </div>
          <p class="my-2">${DC.esc(r.motivo)}</p>
          ${r.id_donacion ? `<div class="small p-2 rounded mb-2" style="background:#0b111d;border:1px solid var(--dc-border-soft)">
            <i class="bi bi-receipt text-gold me-1"></i>Donación #${r.id_donacion} · ${DC.tipo(r.tipo_donacion)} · ${DC.money(r.monto)} · ${DC.estado(r.estado_donacion)} · ${DC.esc(r.campana || '')} · TX ${DC.txLink(r.tx_hash)}</div>` : ''}
          ${r.estado === 'abierto' ? `<div class="text-end"><button class="btn btn-sm btn-emerald" data-rev="${r.id}"><i class="bi bi-check2 me-1"></i>Marcar como revisado</button></div>` : ''}
        </div>`).join('') : '<div class="card-dc empty-state"><i class="bi bi-flag"></i>No hay reportes abiertos.</div>';
      el.querySelectorAll('[data-rev]').forEach((b) => b.addEventListener('click', () => revisarReporte(b.dataset.rev)));
    } catch (e) { el.innerHTML = `<div class="text-danger">${DC.esc(e.message)}</div>`; }
  }

  async function revisarReporte(id) {
    const r = await DC.Swal.fire({
      title: `Revisar reporte #${id}`, input: 'textarea',
      inputLabel: 'Respuesta para el usuario (opcional)', inputPlaceholder: 'Ej: Verificamos la donación y todo está en orden.',
      showCancelButton: true, confirmButtonText: 'Marcar revisado', cancelButtonText: 'Cancelar', confirmButtonColor: '#16b483',
    });
    if (!r.isConfirmed) return;
    try { await DC.api('revisar_reporte', { data: { id, respuesta: r.value || '' } }); DC.toast('Reporte revisado.', 'success'); cargarReportes(); cargarDashboard(); } catch (e) { DC.alertError('Error', e.message); }
  }


  async function cargarFondos() {
    const tb = document.querySelector('#tablaFondos tbody');
    try {
      const fs = await DC.api('listar_fondos');
      tb.innerHTML = fs.length ? fs.map((f) => `
        <tr>
          <td>${f.id}</td>
          <td class="text-gold fw-semibold text-nowrap">${DC.money(f.monto_total)}</td>
          <td class="small text-nowrap" title="${DC.esc(f.admin || '')}">${DC.fecha(f.fecha_creacion, false)}</td>
          <td>${Number(f.distribuido) ? '<span class="estado estado-completado">distribuido</span>' : '<span class="estado estado-pendiente">disponible</span>'}</td>
          <td class="text-end text-nowrap">${Number(f.distribuido) ? '' : `
            <button class="btn btn-sm btn-ghost" data-sim="${f.monto_total}" title="Simular"><i class="bi bi-play"></i></button>
            <button class="btn btn-sm btn-gold" data-ejec="${f.id}" data-monto="${f.monto_total}" title="Ejecutar distribución"><i class="bi bi-lightning-charge"></i></button>`}</td>
        </tr>`).join('') : DC.filaVacia(5, 'No hay fondos de reserva.');
      tb.querySelectorAll('[data-sim]').forEach((b) => b.addEventListener('click', () => simular(Number(b.dataset.sim))));
      tb.querySelectorAll('[data-ejec]').forEach((b) => b.addEventListener('click', () => ejecutar(b.dataset.ejec, b.dataset.monto)));
    } catch (e) { tb.innerHTML = DC.filaVacia(5, e.message); }
  }

  async function crearFondo(e) {
    e.preventDefault();
    const monto = Number(document.getElementById('montoFondo').value);
    if (!monto || monto <= 0) return DC.toast('Monto inválido.', 'warning');
    if (!await DC.confirmar('¿Crear fondo de reserva?', `Se registrará un fondo de <strong class="text-gold">${DC.money(monto)}</strong> para distribuir.`, 'Crear')) return;
    try {
      await DC.api('crear_fondo', { data: { monto_total: monto } });
      document.getElementById('montoFondo').value = '';
      DC.toast('Fondo creado.', 'success');
      cargarFondos();
    } catch (err) { DC.alertError('Error', err.message); }
  }

  async function simular(monto) {
    if (!monto || monto <= 0) return DC.toast('Monto inválido.', 'warning');
    try {
      const r = await DC.api('simular_optimizacion', { params: { monto } });
      st.ultimaSim = r;
      renderSimulacion(r, false);
      DC.toast('Simulación calculada (no se guardó nada).', 'info');
    } catch (e) {
      document.getElementById('resultadoSim').innerHTML = `<div class="empty-state text-warning"><i class="bi bi-exclamation-triangle text-warning"></i>${DC.esc(e.message)}</div>`;
    }
  }

  function renderSimulacion(r, ejecutado) {
    document.getElementById('simInfo').textContent = `${ejecutado ? 'Distribuido' : 'Simulación'} · Fondo ${DC.money(r.monto_fondo)} · Σ puntos ${DC.num(r.total_puntos, 2)}`;
    const max = Math.max(...r.campanas.map((c) => c.monto_asignado), 1);
    document.getElementById('resultadoSim').innerHTML = `
      <div class="table-responsive"><table class="table table-dc table-sm" style="font-size:.82rem">
        <thead><tr><th>Campaña</th><th class="text-center">Don.</th><th>Donado</th><th>Σ√d</th><th>(Σ√d)²</th><th>%</th><th>Asignado</th></tr></thead>
        <tbody>${r.campanas.map((c) => `
          <tr>
            <td class="small">${DC.esc(c.titulo)}${c.hash_auditoria ? `<div class="hash" style="font-size:.66rem">${DC.esc(DC.short(c.hash_auditoria, 14, 6))}</div>` : ''}</td>
            <td class="text-center">${c.num_donantes}</td>
            <td class="text-nowrap">${DC.money(c.total_donado)}</td>
            <td class="mono small">${DC.num(c.suma_raices, 4)}</td>
            <td class="mono small">${DC.num(c.puntuacion_cuadratica, 2)}</td>
            <td>${DC.num(c.porcentaje, 2)}%</td>
            <td class="text-gold fw-semibold text-nowrap">${DC.money(c.monto_asignado)}</td>
          </tr>`).join('')}</tbody></table></div>
      <div class="mt-3">${r.campanas.map((c) => `
        <div class="hbar"><div class="lbl"><span class="text-truncate me-2">${DC.esc(c.titulo)}</span><strong class="text-gold">${DC.money(c.monto_asignado)}</strong></div>
        <div class="track"><div class="fill" data-w="${(c.monto_asignado / max) * 100}"></div></div></div>`).join('')}</div>`;
    requestAnimationFrame(() => document.querySelectorAll('#resultadoSim .fill[data-w]').forEach((f) => { f.style.width = `${f.dataset.w}%`; }));
  }

  async function ejecutar(idFondo, monto) {
    if (!await DC.confirmar('¿Ejecutar la distribución?',
      `Se distribuirán <strong class="text-gold">${DC.money(monto)}</strong> entre las campañas activas según la fórmula cuadrática.
       <div class="small text-muted mt-2">Cada asignación se guardará con un <strong>hash SHA-256 de auditoría</strong>. <strong>No se puede deshacer.</strong></div>`,
      'Sí, distribuir', 'warning')) return;
    DC.cargando('Distribuyendo fondo…');
    try {
      const r = await DC.api('ejecutar_optimizacion', { data: { id_fondo: idFondo } });
      renderSimulacion(r, true);
      DC.alertOk('Fondo distribuido', `${DC.money(r.monto_fondo)} repartidos entre ${r.campanas.length} campañas.`);
      cargarFondos();
      cargarHistorial();
      cargarDashboard();
    } catch (e) { DC.alertError('No se pudo distribuir', e.message); }
  }

  async function cargarHistorial() {
    const tb = document.querySelector('#tablaHistorial tbody');
    try {
      const h = await DC.api('historial_distribuciones');
      tb.innerHTML = h.length ? h.map((d) => `
        <tr><td class="small">${DC.fecha(d.fecha_calculo)}</td><td class="small">${DC.esc(d.titulo)}</td>
        <td class="mono small">${DC.num(d.puntuacion_cuadratica, 2)}</td><td class="text-gold text-nowrap">${DC.money(d.monto_asignado)}</td>
        <td class="hash" style="font-size:.7rem" title="${DC.esc(d.hash_auditoria)}">${DC.esc(DC.short(d.hash_auditoria, 12, 8))}</td></tr>`).join('')
        : DC.filaVacia(5, 'Aún no se distribuyeron fondos.');
    } catch (e) { tb.innerHTML = DC.filaVacia(5, e.message); }
  }


  async function cargarCatalogos() {
    try {
      const [cats, esp] = await Promise.all([DC.api('categorias'), DC.api('especies')]);
      document.getElementById('listaCategorias').innerHTML = cats.map((c) => `
        <li class="list-group-item bg-transparent d-flex justify-content-between align-items-center" style="border-color:var(--dc-border-soft)">
          <span><i class="bi ${DC.esc(c.icono || 'bi-tag')} text-gold me-2"></i>${DC.esc(c.nombre)}<div class="small text-muted">${DC.esc(c.descripcion || '')}</div></span>
          <span class="badge bg-secondary">${c.num_activas} activas</span></li>`).join('');
      document.getElementById('listaEspecies').innerHTML = esp.map((e) => `
        <li class="list-group-item bg-transparent d-flex justify-content-between" style="border-color:var(--dc-border-soft)">
          <span><i class="bi bi-box-seam text-gold me-2"></i>${DC.esc(e.nombre)}</span><span class="text-muted small">${DC.esc(e.unidad_medida)}</span></li>`).join('');
    } catch (e) { DC.toast(e.message, 'error'); }
  }

  async function crearCategoria(e) {
    e.preventDefault();
    try { await DC.api('crear_categoria', { data: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); DC.toast('Categoría creada.', 'success'); cargarCatalogos(); } catch (err) { DC.toast(err.message, 'error'); }
  }
  async function crearEspecie(e) {
    e.preventDefault();
    try { await DC.api('crear_especie', { data: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); DC.toast('Especie creada.', 'success'); cargarCatalogos(); } catch (err) { DC.toast(err.message, 'error'); }
  }


  async function cargarAuditoria() {
    const tb = document.querySelector('#tablaAuditoria tbody');
    try {
      const sel = document.getElementById('audAccion');
      const r = await DC.api('auditoria', {
        params: {
          accion: sel.value,
          buscar: document.getElementById('audBuscar').value.trim(),
          desde: document.getElementById('audDesde').value,
          hasta: document.getElementById('audHasta').value,
          limite: 300,
        },
      });
      const actual = sel.value;
      sel.innerHTML = '<option value="">Todas las acciones</option>' + r.acciones.map((a) => `<option ${a === actual ? 'selected' : ''}>${DC.esc(a)}</option>`).join('');
      const color = (a) => (/ALERTA|BLOQUEADA|FALLIDO|RECHAZ|SUSPEND/.test(a) ? 'text-danger' : /MINADO|VALIDADA|APROB|CONCILIACION_APROBAR|OK/.test(a) ? 'text-emerald' : 'text-gold');
      tb.innerHTML = r.registros.length ? r.registros.map((a) => `
        <tr>
          <td data-v="${a.id}">${a.id}</td>
          <td class="small text-nowrap" data-v="${a.fecha}">${DC.fecha(a.fecha)}</td>
          <td class="small">${DC.esc(a.nombre || 'Sistema / anónimo')}<div class="text-muted">${DC.esc(a.email || '')}</div></td>
          <td><span class="mono small fw-semibold ${color(a.accion)}">${DC.esc(a.accion)}</span></td>
          <td class="small">${DC.esc(a.descripcion)}</td>
          <td class="mono small">${DC.esc(a.ip_address)}</td>
          <td class="small text-muted text-truncate" style="max-width:200px" title="${DC.esc(a.user_agent)}">${DC.esc(a.user_agent)}</td>
        </tr>`).join('') : DC.filaVacia(7, 'Sin registros para esos filtros.');
    } catch (e) { tb.innerHTML = DC.filaVacia(7, e.message); }
  }
})();
