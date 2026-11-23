

(() => {
  if (!DC.requireAuth(['superadmin'])) return;

  const st = { usuarios: [], orgs: [] };

  document.addEventListener('DOMContentLoaded', () => {
    DC.renderNavbar('verificar');
    DC.renderFooter();
    DC.filtroTabla('buscarRol', 'tablaRoles');
    document.getElementById('btnRecargarVer').addEventListener('click', cargarTodo);
    document.addEventListener('dc:notificaciones', cargarPendientes);
    cargarTodo();
  });

  function cargarTodo() {
    cargarPendientes();
    cargarOrganizaciones();
    cargarRoles();
  }


  async function cargarPendientes() {
    try {
      const d = await DC.api('pendientes_verificacion');
      st.usuarios = d.usuarios;
      st.orgs = d.organizaciones;
      document.getElementById('cntCI').textContent = d.usuarios.length;
      document.getElementById('cntOrg').textContent = d.organizaciones.length;
      renderCI();
      renderOrgs();
    } catch (e) { DC.alertError('Error', e.message); }
  }

  function vistaDoc(url, alt) {
    if (!url) return '<div class="doc-ph"><span><i class="bi bi-file-earmark-x fs-2 d-block text-center"></i>Sin documento</span></div>';
    if (/\.pdf$/i.test(url)) return `<div class="doc-ph" data-doc="${DC.esc(url)}" style="cursor:pointer"><span class="text-center"><i class="bi bi-file-earmark-pdf fs-1 text-danger d-block"></i>Ver PDF</span></div>`;
    return `<img class="doc" src="${DC.esc(DC.uploadUrl(url))}" alt="${DC.esc(alt)}" data-doc="${DC.esc(url)}"
              onerror="this.outerHTML='<div class=&quot;doc-ph&quot;>Imagen no disponible</div>'">`;
  }

  function renderCI() {
    const g = document.getElementById('gridCI');
    if (!st.usuarios.length) {
      g.innerHTML = '<div class="col-12"><div class="card-dc empty-state"><i class="bi bi-person-check"></i>No hay identidades pendientes de verificación.</div></div>';
      return;
    }
    g.innerHTML = st.usuarios.map((u) => `
      <div class="col-md-6 col-xl-4 fade-in">
        <div class="card-dc kyc-card h-100">
          <div class="card-body">
            ${vistaDoc(u.ci_foto_url, `CI de ${u.nombre}`)}
            <div class="d-flex align-items-center gap-2 mt-3">
              <span class="avatar">${DC.esc(DC.iniciales(u.nombre))}</span>
              <div><strong>${DC.esc(u.nombre)}</strong><div class="small text-muted">${DC.esc(u.email)}</div></div>
            </div>
            <div class="row small mt-3 g-2">
              <div class="col-6"><div class="text-muted">CI declarado</div><div class="mono fw-semibold text-gold">${DC.esc(u.ci)}</div></div>
              <div class="col-6"><div class="text-muted">Teléfono</div><div>${DC.esc(u.telefono || '—')}</div></div>
              <div class="col-12"><div class="text-muted">Registrado</div><div>${DC.fecha(u.fecha_registro)}</div></div>
            </div>
            <div class="small text-muted mt-2"><i class="bi bi-info-circle me-1"></i>Compare el número y el nombre de la foto con los datos declarados.</div>
            <div class="d-flex gap-2 mt-3">
              <button class="btn btn-outline-danger flex-fill" data-rechazar-ci="${u.id}"><i class="bi bi-x-lg me-1"></i>Rechazar</button>
              <button class="btn btn-emerald flex-fill" data-aprobar-ci="${u.id}"><i class="bi bi-patch-check me-1"></i>Aprobar</button>
            </div>
          </div>
        </div>
      </div>`).join('');
    enlazarDocs(g);
    g.querySelectorAll('[data-aprobar-ci]').forEach((b) => b.addEventListener('click', () => verificarCI(b.dataset.aprobarCi, true)));
    g.querySelectorAll('[data-rechazar-ci]').forEach((b) => b.addEventListener('click', () => verificarCI(b.dataset.rechazarCi, false)));
  }

  async function verificarCI(id, aprobado) {
    const u = st.usuarios.find((x) => String(x.id) === String(id));
    let motivo = '';
    if (aprobado) {
      if (!await DC.confirmar('¿Aprobar identidad?', `Se verificará el CI <strong class="mono">${DC.esc(u.ci)}</strong> de <strong>${DC.esc(u.nombre)}</strong>. Podrá donar de inmediato.`, 'Aprobar', 'question', '#16b483')) return;
    } else {
      const r = await DC.Swal.fire({
        icon: 'warning', title: 'Rechazar CI', input: 'select',
        inputOptions: {
          'La foto no es legible.': 'Foto ilegible',
          'Los datos no coinciden con lo declarado.': 'Datos no coinciden',
          'El documento está vencido.': 'Documento vencido',
          'El archivo no corresponde a un CI.': 'No es un CI',
        },
        inputPlaceholder: 'Seleccione el motivo', showCancelButton: true,
        confirmButtonText: 'Rechazar', confirmButtonColor: '#d64545', cancelButtonText: 'Cancelar',
        inputValidator: (v) => (!v ? 'Seleccione un motivo' : undefined),
      });
      if (!r.isConfirmed) return;
      motivo = r.value;
    }
    try {
      await DC.api('verificar_ci', { data: { id, aprobado, motivo } });
      DC.toast(aprobado ? `CI de ${u.nombre} verificado.` : `CI de ${u.nombre} rechazado.`, aprobado ? 'success' : 'warning');
      cargarPendientes();
      cargarRoles();
    } catch (e) { DC.alertError('Error', e.message); }
  }

  function renderOrgs() {
    const g = document.getElementById('gridOrg');
    if (!st.orgs.length) {
      g.innerHTML = '<div class="col-12"><div class="card-dc empty-state"><i class="bi bi-building-check"></i>No hay organizaciones pendientes.</div></div>';
      return;
    }
    g.innerHTML = st.orgs.map((o) => `
      <div class="col-md-6 col-xl-4 fade-in">
        <div class="card-dc kyc-card h-100">
          <div class="card-body">
            ${vistaDoc(o.documento_url, `Documento de ${o.nombre_legal}`)}
            <h5 class="mt-3 mb-1">${DC.esc(o.nombre_legal)}</h5>
            <span class="badge badge-cat">${DC.esc(o.tipo)}</span>
            <div class="row small mt-3 g-2">
              <div class="col-6"><div class="text-muted">NIT</div><div class="mono fw-semibold text-gold">${DC.esc(o.nit)}</div></div>
              <div class="col-6"><div class="text-muted">Solicitud</div><div>${DC.fecha(o.fecha_registro, false)}</div></div>
              <div class="col-12"><div class="text-muted">Representante</div>
                <div>${DC.esc(o.representante)} · <span class="mono">${DC.esc(o.ci)}</span>
                ${Number(o.ci_verificado) ? '<span class="badge badge-verified ms-1">CI verificado</span>' : '<span class="badge badge-unverified ms-1">CI sin verificar</span>'}</div>
                <div class="text-muted">${DC.esc(o.email)}</div></div>
            </div>
            <div class="d-flex gap-2 mt-3">
              <button class="btn btn-outline-danger flex-fill" data-rechazar-org="${o.id}"><i class="bi bi-x-lg me-1"></i>Rechazar</button>
              <button class="btn btn-emerald flex-fill" data-aprobar-org="${o.id}"><i class="bi bi-building-check me-1"></i>Aprobar</button>
            </div>
          </div>
        </div>
      </div>`).join('');
    enlazarDocs(g);
    g.querySelectorAll('[data-aprobar-org]').forEach((b) => b.addEventListener('click', () => verificarOrg(b.dataset.aprobarOrg, 'aprobado')));
    g.querySelectorAll('[data-rechazar-org]').forEach((b) => b.addEventListener('click', () => verificarOrg(b.dataset.rechazarOrg, 'rechazado')));
  }

  async function verificarOrg(id, estado) {
    const o = st.orgs.find((x) => String(x.id) === String(id));
    let motivo = '';
    if (estado === 'aprobado') {
      if (!await DC.confirmar('¿Aprobar organización?',
        `<strong>${DC.esc(o.nombre_legal)}</strong> (NIT <span class="mono">${DC.esc(o.nit)}</span>) podrá crear campañas.<br><small class="text-muted">El representante pasará a tener el rol <strong>empresa</strong>.</small>`,
        'Aprobar', 'question', '#16b483')) return;
    } else {
      const r = await DC.Swal.fire({
        icon: 'warning', title: 'Rechazar organización', input: 'textarea',
        inputPlaceholder: 'Motivo del rechazo (se enviará al representante)', showCancelButton: true,
        confirmButtonText: 'Rechazar', confirmButtonColor: '#d64545', cancelButtonText: 'Cancelar',
        inputValidator: (v) => (!v || v.trim().length < 5 ? 'Indique el motivo (mín. 5 caracteres)' : undefined),
      });
      if (!r.isConfirmed) return;
      motivo = r.value.trim();
    }
    try {
      await DC.api('verificar_organizacion', { data: { id, estado, motivo } });
      DC.toast(`Organización ${estado}.`, estado === 'aprobado' ? 'success' : 'warning');
      cargarTodo();
    } catch (e) { DC.alertError('Error', e.message); }
  }

  function enlazarDocs(cont) {
    cont.querySelectorAll('[data-doc]').forEach((el) => el.addEventListener('click', () => DC.verDocumento(el.dataset.doc, el.getAttribute('alt') || 'Documento')));
  }


  async function cargarOrganizaciones() {
    const tb = document.querySelector('#tablaOrgs tbody');
    try {
      const os = await DC.api('listar_organizaciones');
      tb.innerHTML = os.length ? os.map((o) => `
        <tr><td>${o.id}</td><td>${DC.esc(o.nombre_legal)}</td><td class="mono small">${DC.esc(o.nit)}</td><td>${DC.esc(o.tipo)}</td>
        <td class="small">${DC.esc(o.representante)}<div class="text-muted">${DC.esc(o.email)}</div></td><td>${o.num_campanas}</td>
        <td>${o.documento_url ? `<button class="btn btn-sm btn-ghost" data-doc="${DC.esc(o.documento_url)}"><i class="bi bi-file-earmark-text"></i></button>` : '—'}</td>
        <td>${DC.estado(o.estado_verificacion)}</td></tr>`).join('') : DC.filaVacia(8, 'Sin organizaciones');
      enlazarDocs(tb);
    } catch (e) { tb.innerHTML = DC.filaVacia(8, e.message); }
  }


  async function cargarRoles() {
    const tb = document.querySelector('#tablaRoles tbody');
    try {
      const us = await DC.api('listar_usuarios');
      const yo = DC.user().id;
      tb.innerHTML = us.map((u) => `
        <tr>
          <td>${u.id}</td>
          <td>${DC.esc(u.nombre)}<div class="small text-muted">${DC.esc(u.email)}</div></td>
          <td class="mono small">${DC.esc(u.ci)}</td>
          <td>${Number(u.ci_verificado) ? '<span class="badge badge-verified"><i class="bi bi-patch-check-fill"></i></span>' : '<span class="badge badge-unverified">pendiente</span>'}</td>
          <td>${DC.rolBadge(u.rol)}</td>
          <td>${Number(u.id) === Number(yo) ? '<span class="small text-muted">(tú)</span>' : `
            <select class="form-select form-select-sm" style="max-width:170px" data-rol="${u.id}" data-actual="${u.rol}">
              ${['donante', 'empresa', 'admin', 'superadmin'].map((r) => `<option value="${r}" ${u.rol === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>`}</td>
        </tr>`).join('');
      tb.querySelectorAll('[data-rol]').forEach((s) => s.addEventListener('change', async () => {
        const u = us.find((x) => String(x.id) === s.dataset.rol);
        const ok = await DC.confirmar('¿Cambiar rol?', `<strong>${DC.esc(u.nombre)}</strong>: ${DC.rolBadge(s.dataset.actual)} → ${DC.rolBadge(s.value)}`, 'Cambiar', 'warning');
        if (!ok) { s.value = s.dataset.actual; return; }
        try {
          await DC.api('cambiar_rol', { data: { id: s.dataset.rol, rol: s.value } });
          DC.toast('Rol actualizado.', 'success');
          cargarRoles();
        } catch (e) { DC.alertError('Error', e.message); s.value = s.dataset.actual; }
      }));
    } catch (e) { tb.innerHTML = DC.filaVacia(6, e.message); }
  }
})();
