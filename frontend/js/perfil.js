

(() => {
  if (!DC.requireAuth()) return;

  const st = {
    perfil: null,
    donaciones: [],
    contactos: [],
    disponibles: [],
    chatCon: null,        
    chatCampana: null,    
    chatTimer: null,
    categorias: [],
  };

  document.addEventListener('DOMContentLoaded', async () => {
    DC.renderNavbar('perfil');
    DC.renderFooter();
    DC.tablaOrdenable('tablaDonaciones');
    DC.filtroTabla('buscarDonacion', 'tablaDonaciones');

    document.querySelectorAll('#perfilTabs [data-hash]').forEach((b) => {
      b.addEventListener('shown.bs.tab', () => {
        history.replaceState(null, '', `${location.pathname}${location.search}#${b.dataset.hash}`);
        if (b.dataset.hash === 'mensajes') cargarContactos();
      });
    });
    const h = location.hash.replace('#', '');
    if (h) {
      const b = document.querySelector(`#perfilTabs [data-hash="${h}"]`);
      if (b) bootstrap.Tab.getOrCreateInstance(b).show();
    }

    document.getElementById('copiarDireccion').addEventListener('click', () => st.perfil && DC.copiar(st.perfil.billetera.direccion_publica));
    document.getElementById('formDatos').addEventListener('submit', guardarDatos);
    document.getElementById('formPassword').addEventListener('submit', cambiarPassword);
    document.getElementById('formChat').addEventListener('submit', enviarMensaje);
    document.getElementById('nuevoChat').addEventListener('change', (e) => { if (e.target.value) abrirChat(Number(e.target.value)); e.target.value = ''; });
    document.getElementById('btnNuevoReporte').addEventListener('click', () => nuevoReporte());
    document.addEventListener('dc:notificaciones', () => { cargarPerfil(); cargarDonaciones(); });

    try { st.categorias = await DC.api('categorias'); } catch (e) { /* nada */ }

    await cargarPerfil();
    cargarDonaciones();
    cargarContactos();
    cargarReportes();
    cargarOrganizacion();

    const chat = DC.qp('chat');
    if (chat) {
      st.chatCampana = DC.qp('campana');
      bootstrap.Tab.getOrCreateInstance(document.querySelector('[data-hash="mensajes"]')).show();
      abrirChat(Number(chat));
    }
  });


  async function cargarPerfil() {
    try {
      const p = await DC.api('perfil');
      st.perfil = p;
      DC.updateUser({ nombre: p.nombre, rol: p.rol, ci_verificado: p.ci_verificado });

      document.getElementById('pAvatar').textContent = DC.iniciales(p.nombre);
      document.getElementById('pNombre').textContent = p.nombre;
      document.getElementById('pEmail').textContent = p.email;
      document.getElementById('pCI').textContent = p.ci;
      document.getElementById('pTelefono').textContent = p.telefono || '—';
      document.getElementById('pFecha').textContent = DC.fecha(p.fecha_registro, false);
      document.getElementById('pBadges').innerHTML = `
        ${DC.rolBadge(p.rol)}
        ${p.ci_verificado
          ? '<span class="badge badge-verified"><i class="bi bi-patch-check-fill me-1"></i>CI verificado</span>'
          : `<span class="badge badge-unverified"><i class="bi bi-hourglass-split me-1"></i>${p.ci_foto_url ? 'CI en revisión' : 'CI sin verificar'}</span>`}
        ${p.tiene_2fa ? '<span class="badge badge-verified"><i class="bi bi-shield-check me-1"></i>2FA</span>' : ''}`;

      document.getElementById('pDireccion').textContent = p.billetera?.direccion_publica || '—';
      document.getElementById('pSaldo').textContent = DC.money(p.billetera?.saldo, 'DCT');
      if (p.billetera) DC.qr('qrDireccion', p.billetera.direccion_publica, 64);

      document.getElementById('pTotalDon').textContent = p.estadisticas.total_donaciones;
      document.getElementById('pTotalMonto').textContent = DC.money(p.estadisticas.total_donado).replace('Bs ', '');
      document.getElementById('pCampanas').textContent = p.estadisticas.campanas_apoyadas;

      document.getElementById('dNombre').value = p.nombre;
      document.getElementById('dTelefono').value = p.telefono || '';

      renderKYC(p);
      render2FA(p);
    } catch (e) { DC.alertError('No se pudo cargar el perfil', e.message); }
  }

  function renderKYC(p) {
    const el = document.getElementById('kycEstado');
    if (p.ci_verificado) {
      el.innerHTML = `
        <div class="chain-status ok">
          <i class="bi bi-patch-check-fill big text-emerald"></i>
          <div><strong>Identidad verificada</strong><div class="small text-muted">Tu CI ${DC.esc(p.ci)} fue aprobado por el SuperAdmin. Puedes donar sin restricciones.</div></div>
          ${p.ci_foto_url ? `<button class="btn btn-sm btn-ghost ms-auto" id="verMiCI"><i class="bi bi-eye me-1"></i>Ver CI</button>` : ''}
        </div>`;
    } else {
      el.innerHTML = `
        <div class="chain-status" style="background:#f0b42912;border-color:#f0b42955">
          <i class="bi bi-person-vcard big text-warning"></i>
          <div class="flex-grow-1">
            <strong>${p.ci_foto_url ? 'CI en revisión' : 'Verifica tu identidad para poder donar'}</strong>
            <div class="small text-muted">${p.ci_foto_url ? 'El SuperAdmin revisará tu documento. Puedes reemplazar la foto si no es legible.' : 'Sube una foto clara del anverso de tu Cédula de Identidad.'}</div>
            <form id="formCI" class="d-flex gap-2 mt-2 flex-wrap">
              <input type="file" class="form-control form-control-sm" style="max-width:320px" id="ciArchivo" accept="image/jpeg,image/png,image/webp,application/pdf" required>
              <button class="btn btn-sm btn-gold" id="btnSubirCI"><i class="bi bi-upload me-1"></i>${p.ci_foto_url ? 'Reemplazar' : 'Subir CI'}</button>
              ${p.ci_foto_url ? '<button type="button" class="btn btn-sm btn-ghost" id="verMiCI"><i class="bi bi-eye me-1"></i>Ver enviado</button>' : ''}
            </form>
          </div>
        </div>`;
      document.getElementById('formCI').addEventListener('submit', subirCI);
    }
    const v = document.getElementById('verMiCI');
    if (v) v.addEventListener('click', () => DC.verDocumento(p.ci_foto_url, 'Mi Cédula de Identidad'));
  }

  async function subirCI(e) {
    e.preventDefault();
    const f = document.getElementById('ciArchivo').files[0];
    if (!f) return DC.toast('Seleccione un archivo.', 'warning');
    const fd = new FormData();
    fd.append('ci_foto', f);
    await DC.conBoton(document.getElementById('btnSubirCI'), async () => {
      try {
        await DC.api('subir_ci', { form: fd });
        DC.alertOk('CI enviado', 'Tu documento fue enviado para verificación. Te notificaremos cuando sea aprobado.');
        cargarPerfil();
      } catch (err) { DC.alertError('No se pudo subir el CI', err.message); }
    }, 'Subiendo…');
  }

  async function guardarDatos(e) {
    e.preventDefault();
    await DC.conBoton(document.getElementById('btnDatos'), async () => {
      try {
        await DC.api('actualizar_perfil', { data: { nombre: document.getElementById('dNombre').value, telefono: document.getElementById('dTelefono').value } });
        DC.toast('Datos actualizados.', 'success');
        await cargarPerfil();
        DC.renderNavbar('perfil');
      } catch (err) { DC.toast(err.message, 'error'); }
    });
  }

  async function cambiarPassword(e) {
    e.preventDefault();
    const f = e.target;
    if (f.nueva.value !== f.confirmar.value) return DC.alertError('Las contraseñas nuevas no coinciden');
    await DC.conBoton(document.getElementById('btnPassword'), async () => {
      try {
        await DC.api('cambiar_password', { data: { actual: f.actual.value, nueva: f.nueva.value } });
        f.reset();
        DC.alertOk('Contraseña actualizada', 'Usa tu nueva contraseña en el próximo inicio de sesión.');
      } catch (err) { DC.alertError('No se pudo cambiar la contraseña', err.message); }
    });
  }

  function render2FA(p) {
    const el = document.getElementById('bloque2FA');
    if (p.tiene_2fa) {
      el.innerHTML = `
        <div class="chain-status ok">
          <i class="bi bi-shield-fill-check big text-emerald"></i>
          <div class="flex-grow-1"><strong>2FA activado</strong><div class="small text-muted">Se pedirá un código de tu app autenticadora en cada inicio de sesión.</div></div>
          <button class="btn btn-sm btn-outline-danger" id="btnDesactivar2FA">Desactivar</button>
        </div>`;
      document.getElementById('btnDesactivar2FA').addEventListener('click', desactivar2FA);
    } else {
      el.innerHTML = `
        <div class="chain-status">
          <i class="bi bi-phone big text-gold"></i>
          <div class="flex-grow-1"><strong>Protege tu cuenta</strong><div class="small text-muted">Usa Google Authenticator, Authy o Microsoft Authenticator (códigos TOTP de 6 dígitos).</div></div>
          <button class="btn btn-sm btn-gold" id="btnActivar2FA"><i class="bi bi-shield-plus me-1"></i>Activar 2FA</button>
        </div>`;
      document.getElementById('btnActivar2FA').addEventListener('click', activar2FA);
    }
  }

  async function activar2FA() {
    let g;
    try { g = await DC.api('generar_2fa'); } catch (e) { return DC.alertError('Error', e.message); }
    const r = await DC.Swal.fire({
      title: 'Configurar 2FA',
      html: `
        <ol class="text-start small">
          <li>Escanea este código QR con tu app autenticadora.</li>
          <li>O ingresa manualmente la clave: <div class="hash text-gold my-1">${DC.esc(g.secreto)}</div></li>
          <li>Escribe el código de 6 dígitos que aparece en la app.</li>
        </ol>
        <div class="qr-box my-2"><div id="qr2fa"></div></div>`,
      input: 'text',
      inputPlaceholder: '000000',
      inputAttributes: { maxlength: 6, inputmode: 'numeric', autocomplete: 'one-time-code', style: 'text-align:center;font-size:1.4rem;letter-spacing:.3em' },
      didOpen: () => DC.qr('qr2fa', g.otpauth_url, 180),
      showCancelButton: true,
      confirmButtonText: 'Verificar y activar',
      cancelButtonText: 'Cancelar',
      showLoaderOnConfirm: true,
      preConfirm: async (codigo) => {
        try { return await DC.api('activar_2fa', { data: { secreto: g.secreto, codigo } }); } catch (e) { DC.Swal.showValidationMessage(e.message); return false; }
      },
      allowOutsideClick: () => !DC.Swal.isLoading(),
    });
    if (r.isConfirmed) { DC.alertOk('2FA activado', 'Tu cuenta ahora está protegida con doble factor.'); cargarPerfil(); }
  }

  async function desactivar2FA() {
    const r = await DC.Swal.fire({
      icon: 'warning', title: 'Desactivar 2FA', text: 'Confirma con tu contraseña:',
      input: 'password', inputPlaceholder: 'Contraseña', showCancelButton: true,
      confirmButtonText: 'Desactivar', confirmButtonColor: '#d64545', cancelButtonText: 'Cancelar',
      preConfirm: async (password) => {
        try { return await DC.api('desactivar_2fa', { data: { password } }); } catch (e) { DC.Swal.showValidationMessage(e.message); return false; }
      },
    });
    if (r.isConfirmed) { DC.toast('2FA desactivado.', 'warning'); cargarPerfil(); }
  }


  async function cargarDonaciones() {
    const tb = document.querySelector('#tablaDonaciones tbody');
    try {
      st.donaciones = await DC.api('mis_donaciones');
      if (!st.donaciones.length) {
        tb.innerHTML = DC.filaVacia(8, 'Aún no realizaste donaciones.', 'bi-heart');
        return;
      }
      tb.innerHTML = st.donaciones.map((d) => {
        const valor = d.tipo_donacion === 'especie'
          ? `${DC.num(d.cantidad_especie, 2)} ${DC.esc(d.unidad_medida || '')} <span class="text-muted small">${DC.esc(d.especie || '')}</span>`
          : DC.money(d.monto, d.tipo_donacion === 'crypto' ? 'DCT' : 'Bs');
        const bloque = d.bloque_indice !== null && d.bloque_indice !== undefined
          ? `<a href="blockchain.html?bloque=${d.bloque_indice}" class="badge badge-verified ms-1" title="Incluida en el bloque">#${d.bloque_indice}</a>`
          : (d.tx_hash ? '<span class="badge bg-secondary ms-1" title="En mempool">mempool</span>' : '');
        return `<tr>
          <td data-v="${d.id}">${d.id}</td>
          <td>${DC.esc(d.campana)}</td>
          <td>${DC.tipo(d.tipo_donacion)}</td>
          <td data-v="${d.tipo_donacion === 'especie' ? d.cantidad_especie : d.monto}">${valor}</td>
          <td>${DC.estado(d.estado)}</td>
          <td data-v="${d.fecha}" class="small">${DC.fecha(d.fecha)}</td>
          <td>${DC.txLink(d.tx_hash)}${bloque}</td>
          <td class="text-end text-nowrap">
            ${d.codigo_recepcion ? `<button class="btn btn-sm btn-ghost" data-qr="${d.id}" title="Código de recepción"><i class="bi bi-qr-code"></i></button>` : ''}
            ${d.comprobante_url ? `<button class="btn btn-sm btn-ghost" data-comp="${d.id}" title="Ver comprobante"><i class="bi bi-image"></i></button>` : ''}
            <button class="btn btn-sm btn-ghost text-danger" data-rep="${d.id}" title="Reportar problema"><i class="bi bi-flag"></i></button>
          </td></tr>`;
      }).join('');
      tb.querySelectorAll('[data-qr]').forEach((b) => b.addEventListener('click', () => verCodigo(b.dataset.qr)));
      tb.querySelectorAll('[data-comp]').forEach((b) => b.addEventListener('click', () => {
        const d = st.donaciones.find((x) => String(x.id) === b.dataset.comp);
        DC.verDocumento(d.comprobante_url, `Comprobante · Donación #${d.id}`);
      }));
      tb.querySelectorAll('[data-rep]').forEach((b) => b.addEventListener('click', () => nuevoReporte(b.dataset.rep)));
    } catch (e) {
      tb.innerHTML = DC.filaVacia(8, e.message, 'bi-wifi-off');
    }
  }

  function verCodigo(id) {
    const d = st.donaciones.find((x) => String(x.id) === String(id));
    DC.Swal.fire({
      title: 'Código de recepción',
      html: `<div class="qr-box my-2"><div id="qrCod"></div></div>
             <div class="fs-3 fw-800 text-gold mono">${DC.esc(d.codigo_recepcion)}</div>
             <div class="small mt-2">${DC.num(d.cantidad_especie, 2)} ${DC.esc(d.unidad_medida)} de ${DC.esc(d.especie)}</div>
             <div class="mt-2">${DC.estado(d.estado)}</div>`,
      didOpen: () => DC.qr('qrCod', `DONA-CHAIN|RECEPCION|${d.codigo_recepcion}`, 190),
      confirmButtonText: 'Cerrar',
    });
  }


  async function cargarReportes() {
    const el = document.getElementById('listaReportes');
    try {
      const reps = await DC.api('mis_reportes');
      el.innerHTML = reps.length ? reps.map((r) => `
        <div class="card-dc p-3 mb-2">
          <div class="d-flex justify-content-between"><strong>Reporte #${r.id}${r.id_donacion ? ` · Donación #${r.id_donacion}` : ''}</strong>${DC.estado(r.estado)}</div>
          <div class="small mt-1">${DC.esc(r.motivo)}</div>
          <div class="small text-muted mt-1">${DC.fecha(r.fecha)}</div>
        </div>`).join('') : '<div class="empty-state"><i class="bi bi-flag"></i>No has enviado reportes.</div>';
    } catch (e) { el.innerHTML = `<div class="text-danger small">${DC.esc(e.message)}</div>`; }
  }

  async function nuevoReporte(idDonacion = null) {
    const opciones = st.donaciones.map((d) => `<option value="${d.id}" ${String(d.id) === String(idDonacion) ? 'selected' : ''}>#${d.id} · ${DC.esc(d.campana)} (${d.tipo_donacion})</option>`).join('');
    const r = await DC.Swal.fire({
      title: 'Reportar un problema',
      html: `
        <select id="repDon" class="swal2-select w-75 mb-2"><option value="">— General (sin donación) —</option>${opciones}</select>
        <textarea id="repMotivo" class="swal2-textarea w-75" placeholder="Describe el problema (mín. 10 caracteres)…" maxlength="1000"></textarea>`,
      showCancelButton: true, confirmButtonText: 'Enviar reporte', cancelButtonText: 'Cancelar',
      preConfirm: async () => {
        const motivo = document.getElementById('repMotivo').value.trim();
        if (motivo.length < 10) { DC.Swal.showValidationMessage('Describe el motivo con al menos 10 caracteres.'); return false; }
        try { return await DC.api('crear_reporte', { data: { id_donacion: document.getElementById('repDon').value || null, motivo } }); } catch (e) { DC.Swal.showValidationMessage(e.message); return false; }
      },
    });
    if (r.isConfirmed) { DC.toast('Reporte enviado. Gracias por ayudarnos.', 'success'); cargarReportes(); }
  }


  async function cargarContactos() {
    try {
      const d = await DC.api('contactos');
      st.contactos = d.contactos;
      st.disponibles = d.disponibles;
      document.getElementById('nuevoChat').innerHTML = '<option value="">+ Nueva conversación…</option>'
        + d.disponibles.map((u) => `<option value="${u.id}">${DC.esc(u.organizacion)} (${DC.esc(u.nombre)})</option>`).join('');
      const lista = document.getElementById('listaContactos');
      if (!d.contactos.length) {
        lista.innerHTML = '<div class="p-3 small text-muted">Sin conversaciones. Inicia una desde el menú de arriba.</div>';
        return;
      }
      lista.innerHTML = d.contactos.map((c) => `
        <div class="chat-contact ${Number(st.chatCon) === Number(c.id) ? 'active' : ''}" data-id="${c.id}">
          <span class="avatar">${DC.esc(DC.iniciales(c.organizacion || c.nombre))}</span>
          <div class="flex-grow-1 min-w-0">
            <div class="d-flex justify-content-between"><strong class="small">${DC.esc(c.organizacion || c.nombre)}</strong>
              ${Number(c.no_leidos) ? `<span class="badge bg-danger">${c.no_leidos}</span>` : ''}</div>
            <div class="preview">${DC.esc(c.ultimo_mensaje || '')}</div>
          </div>
        </div>`).join('');
      lista.querySelectorAll('.chat-contact').forEach((el) => el.addEventListener('click', () => abrirChat(Number(el.dataset.id))));
    } catch (e) {
      document.getElementById('listaContactos').innerHTML = `<div class="p-3 small text-danger">${DC.esc(e.message)}</div>`;
    }
  }

  async function abrirChat(idOtro) {
    st.chatCon = idOtro;
    const c = st.contactos.find((x) => Number(x.id) === idOtro) || st.disponibles.find((x) => Number(x.id) === idOtro) || {};
    document.getElementById('chatHeader').innerHTML = `
      <span class="avatar">${DC.esc(DC.iniciales(c.organizacion || c.nombre || '?'))}</span>
      <div><strong>${DC.esc(c.organizacion || c.nombre || `Usuario #${idOtro}`)}</strong>
        <div class="small text-muted">${DC.esc(c.organizacion ? c.nombre : (c.rol || ''))}</div></div>
      <i class="bi bi-arrow-clockwise ms-auto copy-btn" title="Actualizar" id="chatRefrescar"></i>`;
    document.getElementById('chatRefrescar').addEventListener('click', () => cargarConversacion(true));
    document.getElementById('chatTexto').disabled = false;
    document.getElementById('btnEnviarChat').disabled = false;
    document.getElementById('chatTexto').focus();
    await cargarConversacion(true);
    cargarContactos();
    clearInterval(st.chatTimer);
    st.chatTimer = setInterval(() => cargarConversacion(false), 10000);
  }

  async function cargarConversacion(scroll) {
    if (!st.chatCon) return;
    const box = document.getElementById('chatMensajes');
    try {
      const msgs = await DC.api('obtener_conversacion', { params: { id_otro: st.chatCon } });
      const yo = DC.user().id;
      const abajo = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
      box.innerHTML = msgs.length ? msgs.map((m) => `
        <div class="msg ${Number(m.id_emisor) === Number(yo) ? 'mine' : 'theirs'}">
          ${m.campana ? `<div class="camp"><i class="bi bi-megaphone me-1"></i>${DC.esc(m.campana)}</div>` : ''}
          ${DC.esc(m.mensaje)}
          <div class="meta">${DC.fecha(m.fecha)}${Number(m.id_emisor) === Number(yo) ? ` · ${Number(m.leido) ? '<i class="bi bi-check2-all"></i> leído' : '<i class="bi bi-check2"></i> enviado'}` : ''}</div>
        </div>`).join('') : '<div class="empty-state m-auto"><i class="bi bi-chat"></i>Envía el primer mensaje.</div>';
      if (scroll || abajo) box.scrollTop = box.scrollHeight;
    } catch (e) { DC.toast(e.message, 'error'); }
  }

  async function enviarMensaje(e) {
    e.preventDefault();
    const input = document.getElementById('chatTexto');
    const texto = input.value.trim();
    if (!texto || !st.chatCon) return;
    input.disabled = true;
    try {
      await DC.api('enviar_mensaje', { data: { id_receptor: st.chatCon, id_campana: st.chatCampana, mensaje: texto } });
      input.value = '';
      st.chatCampana = null;
      await cargarConversacion(true);
      cargarContactos();
    } catch (err) { DC.toast(err.message, 'error'); } finally { input.disabled = false; input.focus(); }
  }


  async function cargarOrganizacion() {
    const el = document.getElementById('orgContenido');
    try {
      const { organizacion: o, campanas } = await DC.api('mi_organizacion');

      if (!o || o.estado_verificacion === 'rechazado') {
        el.innerHTML = `
          ${o ? `<div class="chain-status bad mb-4"><i class="bi bi-x-octagon big text-danger"></i><div><strong>"${DC.esc(o.nombre_legal)}" fue rechazada.</strong><div class="small text-muted">Puedes registrar nuevamente con la documentación correcta.</div></div></div>` : ''}
          <h6 class="ornament-title mb-3">Registrar organización</h6>
          ${!st.perfil?.ci_verificado ? '<div class="alert alert-warning small"><i class="bi bi-exclamation-triangle me-1"></i>Necesitas tener tu CI verificado para registrar una organización.</div>' : ''}
          <form id="formOrg" class="row g-3">
            <div class="col-md-8"><label class="form-label">Nombre legal *</label><input class="form-control" name="nombre_legal" required minlength="3" placeholder="Fundación Ejemplo Bolivia"></div>
            <div class="col-md-4"><label class="form-label">Tipo *</label>
              <select class="form-select" name="tipo" required><option value="ONG">ONG</option><option value="Fundacion">Fundación</option><option value="Empresa">Empresa</option></select></div>
            <div class="col-md-6"><label class="form-label">NIT *</label><input class="form-control mono" name="nit" required pattern="[0-9]{7,20}" placeholder="1020304050"></div>
            <div class="col-md-6"><label class="form-label">Documento (NIT / Personería) *</label><input type="file" class="form-control" name="documento" required accept="image/jpeg,image/png,image/webp,application/pdf"></div>
            <div class="col-12 text-end"><button class="btn btn-gold" id="btnOrg" ${!st.perfil?.ci_verificado ? 'disabled' : ''}><i class="bi bi-building-add me-1"></i>Enviar a verificación</button></div>
          </form>`;
        document.getElementById('formOrg').addEventListener('submit', registrarOrg);
        return;
      }

      if (o.estado_verificacion === 'pendiente') {
        el.innerHTML = `
          <div class="chain-status" style="background:#f0b42912;border-color:#f0b42955">
            <i class="bi bi-hourglass-split big text-warning"></i>
            <div><strong>${DC.esc(o.nombre_legal)}</strong> · NIT <span class="mono">${DC.esc(o.nit)}</span>
              <div class="small text-muted">Tu organización está en revisión por el SuperAdmin. Te notificaremos el resultado.</div></div>
            ${DC.estado('pendiente')}
          </div>`;
        return;
      }

      el.innerHTML = `
        <div class="chain-status ok mb-4">
          <i class="bi bi-building-check big text-emerald"></i>
          <div class="flex-grow-1"><strong>${DC.esc(o.nombre_legal)}</strong> <span class="badge badge-verified ms-1">NIT verificado</span>
            <div class="small text-muted">${DC.esc(o.tipo)} · NIT <span class="mono">${DC.esc(o.nit)}</span> · desde ${DC.fecha(o.fecha_registro, false)}</div></div>
          <button class="btn btn-gold btn-sm" id="btnNuevaCampana"><i class="bi bi-plus-lg me-1"></i>Nueva campaña</button>
        </div>
        <h6 class="ornament-title mb-3">Mis campañas</h6>
        <div class="table-responsive"><table class="table table-dc">
          <thead><tr><th>#</th><th>Título</th><th>Recaudado</th><th>Avance</th><th>Estado</th><th class="text-end">Acciones</th></tr></thead>
          <tbody>${campanas.length ? campanas.map((c) => `
            <tr>
              <td>${c.id}</td>
              <td>${DC.esc(c.titulo)} ${Number(c.es_urgente) ? '<span class="badge badge-urgente ms-1">URGENTE</span>' : ''}<div class="small text-muted">${DC.esc(c.categoria || '')}</div></td>
              <td class="text-nowrap">${DC.money(c.fondos_recaudados)}<div class="small text-muted">de ${DC.money(c.meta_fondos)}</div></td>
              <td style="min-width:120px"><div class="progress progress-dc"><div class="progress-bar" style="width:${Number(c.porcentaje) || 0}%"></div></div><small>${Number(c.porcentaje) || 0}%</small></td>
              <td>${DC.estado(c.estado)}</td>
              <td class="text-end text-nowrap">
                ${c.estado === 'borrador' ? `<button class="btn btn-sm btn-emerald" data-est="${c.id}" data-v="activa">Publicar</button>` : ''}
                ${c.estado === 'activa' ? `<button class="btn btn-sm btn-ghost" data-est="${c.id}" data-v="finalizada">Finalizar</button>` : ''}
              </td>
            </tr>`).join('') : DC.filaVacia(6, 'Aún no creaste campañas.', 'bi-megaphone')}</tbody></table></div>`;
      document.getElementById('btnNuevaCampana').addEventListener('click', () => nuevaCampana(o.id));
      el.querySelectorAll('[data-est]').forEach((b) => b.addEventListener('click', async () => {
        if (!await DC.confirmar(`¿${b.dataset.v === 'activa' ? 'Publicar' : 'Finalizar'} campaña?`, '', 'Sí')) return;
        try { await DC.api('cambiar_estado_campana', { data: { id: b.dataset.est, estado: b.dataset.v } }); DC.toast('Campaña actualizada.', 'success'); cargarOrganizacion(); } catch (e) { DC.toast(e.message, 'error'); }
      }));
    } catch (e) { el.innerHTML = `<div class="text-danger">${DC.esc(e.message)}</div>`; }
  }

  async function registrarOrg(e) {
    e.preventDefault();
    const f = e.target;
    if (!f.checkValidity()) { f.classList.add('was-validated'); return DC.toast('Complete los campos obligatorios.', 'warning'); }
    if (!await DC.confirmar('¿Enviar a verificación?', `Se registrará <strong>${DC.esc(f.nombre_legal.value)}</strong> con NIT <span class="mono">${DC.esc(f.nit.value)}</span>.`, 'Enviar')) return;
    await DC.conBoton(document.getElementById('btnOrg'), async () => {
      try {
        await DC.api('registrar_organizacion', { form: new FormData(f) });
        DC.alertOk('Organización registrada', 'Quedó pendiente de verificación por el SuperAdmin.');
        cargarOrganizacion();
      } catch (err) { DC.alertError('No se pudo registrar', err.message); }
    }, 'Enviando…');
  }

  async function nuevaCampana(idOrg) {
    const cats = st.categorias.map((c) => `<option value="${c.id}">${DC.esc(c.nombre)}</option>`).join('');
    const manana = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const r = await DC.Swal.fire({
      title: 'Nueva campaña',
      width: 640,
      html: `
        <form id="fCamp" class="text-start">
          <label class="form-label">Título *</label><input class="form-control mb-2" name="titulo" maxlength="200">
          <label class="form-label">Descripción</label><textarea class="form-control mb-2" name="descripcion" rows="3"></textarea>
          <div class="row g-2">
            <div class="col-6"><label class="form-label">Categoría</label><select class="form-select" name="id_categoria">${cats}</select></div>
            <div class="col-6"><label class="form-label">Meta (Bs) *</label><input type="number" class="form-control" name="meta_fondos" min="1" step="0.01"></div>
            <div class="col-6"><label class="form-label">Fecha de cierre</label><input type="date" class="form-control" name="fecha_cierre" value="${manana}"></div>
            <div class="col-6"><label class="form-label">Estado inicial</label><select class="form-select" name="estado"><option value="activa">Activa (publicar)</option><option value="borrador">Borrador</option></select></div>
          </div>
          <label class="form-label mt-2">Necesidades en especie</label><input class="form-control mb-2" name="meta_especies" placeholder="Ej: 100 kg de arroz, 50 frazadas">
          <div class="form-check mt-2"><input class="form-check-input" type="checkbox" name="es_urgente" id="cUrg"><label class="form-check-label" for="cUrg">Marcar como urgente</label></div>
        </form>`,
      showCancelButton: true, confirmButtonText: 'Crear campaña', cancelButtonText: 'Cancelar',
      preConfirm: async () => {
        const f = document.getElementById('fCamp');
        const data = Object.fromEntries(new FormData(f));
        data.es_urgente = f.es_urgente.checked;
        data.id_organizacion = idOrg;
        try { return await DC.api('crear_campana', { data }); } catch (e) { DC.Swal.showValidationMessage(e.message); return false; }
      },
    });
    if (r.isConfirmed) { DC.toast('Campaña creada.', 'success'); cargarOrganizacion(); }
  }
})();
