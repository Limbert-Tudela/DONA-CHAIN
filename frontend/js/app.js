
(() => {
  const estadoApp = {
    campanas: [],
    categorias: [],
    especies: [],
    categoriaActiva: '',
    campanaActual: null,
    pendiente2FA: false,
  };

  let modalLogin, modalRegistro, modalDonar, modalDetalle;

  document.addEventListener('DOMContentLoaded', () => {
    DC.renderNavbar('index');
    DC.renderFooter();

    modalLogin = new bootstrap.Modal('#modalLogin');
    modalRegistro = new bootstrap.Modal('#modalRegistro');
    modalDonar = new bootstrap.Modal('#modalDonar');
    modalDetalle = new bootstrap.Modal('#modalDetalle');

    enlazarEventos();
    cargarEstadisticas();
    cargarCategorias();
    cargarEspecies();
    cargarCampanas();

    if (location.hash === '#login' && !DC.logged()) modalLogin.show();
    if (location.hash === '#registro' && !DC.logged()) modalRegistro.show();
  });

  
  function enlazarEventos() {
    document.addEventListener('click', (e) => {
      const l = e.target.closest('[data-dc-login]');
      const r = e.target.closest('[data-dc-registro]');
      if (l) { e.preventDefault(); modalLogin.show(); }
      if (r) { e.preventDefault(); modalRegistro.show(); }
    });

    document.getElementById('irRegistro').addEventListener('click', () => { modalLogin.hide(); modalRegistro.show(); });
    document.getElementById('irLogin').addEventListener('click', () => { modalRegistro.hide(); modalLogin.show(); });

    document.querySelectorAll('[data-toggle-pass]').forEach((b) => b.addEventListener('click', () => {
      const i = document.getElementById(b.dataset.togglePass);
      i.type = i.type === 'password' ? 'text' : 'password';
      b.innerHTML = `<i class="bi ${i.type === 'password' ? 'bi-eye' : 'bi-eye-slash'}"></i>`;
    }));

    document.getElementById('regPassword').addEventListener('input', (e) => {
      const v = e.target.value;
      let p = 0;
      if (v.length >= 6) p += 25;
      if (v.length >= 10) p += 20;
      if (/[A-Z]/.test(v)) p += 20;
      if (/[0-9]/.test(v)) p += 20;
      if (/[^A-Za-z0-9]/.test(v)) p += 15;
      document.getElementById('passFuerza').style.width = `${Math.min(p, 100)}%`;
    });

    document.getElementById('formLogin').addEventListener('submit', login);
    document.getElementById('formRegistro').addEventListener('submit', registro);

    let t;
    document.getElementById('buscarCampana').addEventListener('input', () => { clearTimeout(t); t = setTimeout(cargarCampanas, 350); });
    document.getElementById('soloUrgentes').addEventListener('change', cargarCampanas);

    document.getElementById('formDonarQR').addEventListener('submit', donarQR);
    document.getElementById('formDonarCrypto').addEventListener('submit', donarCrypto);
    document.getElementById('formDonarEspecie').addEventListener('submit', donarEspecie);
    document.getElementById('qrMonto').addEventListener('input', actualizarQRPago);
    document.querySelectorAll('[data-monto]').forEach((b) => b.addEventListener('click', () => {
      document.getElementById('qrMonto').value = b.dataset.monto;
      actualizarQRPago();
    }));
    document.getElementById('especieTipo').addEventListener('change', actualizarUnidad);

    document.getElementById('detalleDonar').addEventListener('click', () => {
      modalDetalle.hide();
      abrirDonacion(estadoApp.campanaActual.id);
    });
    document.getElementById('detalleMensaje').addEventListener('click', () => {
      const c = estadoApp.campanaActual;
      if (!DC.logged()) { modalDetalle.hide(); modalLogin.show(); return; }
      location.href = `perfil.html?chat=${c.id_usuario_representante}&campana=${c.id}#mensajes`;
    });

    document.getElementById('btnSoyOrg').addEventListener('click', (e) => {
      if (!DC.logged()) { e.preventDefault(); DC.toast('Primero inicia sesión o crea una cuenta.', 'info'); modalLogin.show(); }
    });
  }


  async function cargarEstadisticas() {
    try {
      const s = await DC.api('estadisticas_publicas');
      animarNumero('statRecaudado', Number(s.total_recaudado), (n) => DC.money(n));
      animarNumero('statDonantes', Number(s.donantes_unicos));
      animarNumero('statCampanas', Number(s.campanas_activas));
      animarNumero('statBloques', Number(s.total_bloques));
      const feed = document.getElementById('feedRecientes');
      feed.innerHTML = s.recientes.length ? s.recientes.map((d) => `
        <div class="feed-item">
          <div class="feed-ico"><i class="bi ${d.tipo_donacion === 'especie' ? 'bi-box-seam' : d.tipo_donacion === 'crypto' ? 'bi-currency-bitcoin' : 'bi-qr-code'}"></i></div>
          <div class="flex-grow-1 min-w-0">
            <div class="small"><strong>${DC.esc(d.donante || 'Anónimo')}</strong> donó
              <strong class="text-gold">${d.tipo_donacion === 'especie' ? `${DC.num(d.cantidad_especie, 0)} ${DC.esc(d.unidad_medida)} de ${DC.esc(d.especie)}` : DC.money(d.monto, d.tipo_donacion === 'crypto' ? 'DCT' : 'Bs')}</strong>
              a <em>${DC.esc(d.campana)}</em></div>
            <div class="small text-muted">${DC.haceTiempo(d.fecha)} · ${DC.txLink(d.tx_hash)}</div>
          </div>
          <i class="bi bi-patch-check-fill text-emerald" title="Registrada en la blockchain"></i>
        </div>`).join('')
        : '<div class="empty-state py-4"><i class="bi bi-hourglass"></i>Aún no hay donaciones confirmadas. ¡Sé el primero!</div>';
    } catch (e) {
      document.getElementById('feedRecientes').innerHTML = `<div class="text-danger small py-3"><i class="bi bi-wifi-off me-1"></i>${DC.esc(e.message)}</div>`;
    }
  }

  function animarNumero(id, final, fmt = (n) => DC.num(n)) {
    const el = document.getElementById(id);
    const dur = 900;
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = fmt(final * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  
  async function cargarCategorias() {
    try {
      estadoApp.categorias = await DC.api('categorias');
      const cont = document.getElementById('filtroCategorias');
      cont.innerHTML = '<button class="filter-pill active" data-cat="">Todas</button>'
        + estadoApp.categorias.map((c) => `<button class="filter-pill" data-cat="${c.id}"><i class="bi ${DC.esc(c.icono || 'bi-tag')} me-1"></i>${DC.esc(c.nombre)}</button>`).join('');
      cont.querySelectorAll('.filter-pill').forEach((b) => b.addEventListener('click', () => {
        cont.querySelectorAll('.filter-pill').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        estadoApp.categoriaActiva = b.dataset.cat;
        cargarCampanas();
      }));
    } catch (e) { /* el error se mostrará al cargar campañas */ }
  }

  async function cargarEspecies() {
    try {
      estadoApp.especies = await DC.api('especies');
      document.getElementById('especieTipo').innerHTML = estadoApp.especies
        .map((e) => `<option value="${e.id}" data-unidad="${DC.esc(e.unidad_medida)}">${DC.esc(e.nombre)} (${DC.esc(e.unidad_medida)})</option>`).join('');
      actualizarUnidad();
    } catch (e) { /* nada */ }
  }

  function actualizarUnidad() {
    const s = document.getElementById('especieTipo');
    const o = s.options[s.selectedIndex];
    document.getElementById('especieUnidad').textContent = o ? o.dataset.unidad : 'u.';
  }

  async function cargarCampanas() {
    const grid = document.getElementById('campanasGrid');
    try {
      estadoApp.campanas = await DC.api('listar_campanas', {
        params: {
          id_categoria: estadoApp.categoriaActiva,
          buscar: document.getElementById('buscarCampana').value.trim(),
          urgente: document.getElementById('soloUrgentes').checked ? '1' : '',
        },
      });
      if (!estadoApp.campanas.length) {
        grid.innerHTML = '<div class="col-12"><div class="card-dc empty-state"><i class="bi bi-search"></i>No se encontraron campañas con esos filtros.</div></div>';
        return;
      }
      grid.innerHTML = estadoApp.campanas.map(tarjetaCampana).join('');
      grid.querySelectorAll('[data-donar]').forEach((b) => b.addEventListener('click', () => abrirDonacion(b.dataset.donar, b.dataset.metodo)));
      grid.querySelectorAll('[data-detalle]').forEach((b) => b.addEventListener('click', () => abrirDetalle(b.dataset.detalle)));
      requestAnimationFrame(() => grid.querySelectorAll('.progress-bar[data-w]').forEach((p) => { p.style.width = `${p.dataset.w}%`; }));
    } catch (e) {
      grid.innerHTML = `<div class="col-12"><div class="card-dc empty-state text-danger"><i class="bi bi-wifi-off text-danger"></i>${DC.esc(e.message)}</div></div>`;
    }
  }

  function tarjetaCampana(c) {
    const pct = Number(c.porcentaje) || 0;
    const dias = c.dias_restantes !== null ? Number(c.dias_restantes) : null;
    return `
      <div class="col-md-6 col-lg-4 fade-in">
        <div class="card-dc campaign-card">
          <div class="campaign-cover">
            <div class="badges">
              <span class="badge badge-cat"><i class="bi ${DC.esc(c.categoria_icono || 'bi-tag')} me-1"></i>${DC.esc(c.categoria || 'General')}</span>
              ${Number(c.es_urgente) ? '<span class="badge badge-urgente"><i class="bi bi-lightning-charge-fill me-1"></i>URGENTE</span>' : ''}
            </div>
            <i class="bi ${DC.esc(c.categoria_icono || 'bi-heart')}"></i>
          </div>
          <div class="card-body d-flex flex-column">
            <div class="small text-muted mb-1"><i class="bi bi-patch-check-fill text-emerald me-1"></i>${DC.esc(c.organizacion)}</div>
            <h5 class="card-title">${DC.esc(c.titulo)}</h5>
            <p class="desc mb-3">${DC.esc(c.descripcion)}</p>
            <div class="mt-auto">
              <div class="d-flex justify-content-between small mb-1">
                <span><strong class="text-gold">${DC.money(c.fondos_recaudados)}</strong> <span class="text-muted">de ${DC.money(c.meta_fondos)}</span></span>
                <strong>${pct}%</strong>
              </div>
              <div class="progress progress-dc mb-2"><div class="progress-bar" data-w="${pct}" style="width:0"></div></div>
              <div class="d-flex justify-content-between small text-muted mb-3">
                <span><i class="bi bi-people me-1"></i>${c.num_donantes} donante(s)</span>
                <span><i class="bi bi-calendar-event me-1"></i>${dias === null ? 'Sin fecha límite' : dias >= 0 ? `${dias} día(s) restantes` : 'Cerrada'}</span>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-gold flex-fill" data-donar="${c.id}" data-metodo="qr"><i class="bi bi-qr-code me-1"></i>Donar QR</button>
                <button class="btn btn-emerald" data-donar="${c.id}" data-metodo="crypto" title="Donar con crypto"><i class="bi bi-currency-bitcoin"></i></button>
                <button class="btn btn-ghost" data-detalle="${c.id}" title="Ver detalle"><i class="bi bi-eye"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function abrirDetalle(id) {
    const c = estadoApp.campanas.find((x) => String(x.id) === String(id));
    if (!c) return;
    estadoApp.campanaActual = c;
    document.getElementById('detalleTitulo').textContent = c.titulo;
    document.getElementById('detalleBody').innerHTML = `
      <div class="d-flex flex-wrap gap-2 mb-3">
        <span class="badge badge-cat"><i class="bi ${DC.esc(c.categoria_icono || 'bi-tag')} me-1"></i>${DC.esc(c.categoria || 'General')}</span>
        ${Number(c.es_urgente) ? '<span class="badge badge-urgente">URGENTE</span>' : ''}
        ${DC.estado(c.estado)}
      </div>
      <p>${DC.esc(c.descripcion)}</p>
      <div class="row g-3 my-2">
        <div class="col-sm-4"><div class="stat-pill"><div class="l">Recaudado</div><div class="v text-gold fs-5">${DC.money(c.fondos_recaudados)}</div></div></div>
        <div class="col-sm-4"><div class="stat-pill"><div class="l">Meta</div><div class="v fs-5">${DC.money(c.meta_fondos)}</div></div></div>
        <div class="col-sm-4"><div class="stat-pill"><div class="l">Donantes</div><div class="v fs-5">${c.num_donantes}</div></div></div>
      </div>
      <div class="progress progress-dc my-3"><div class="progress-bar" style="width:${Number(c.porcentaje) || 0}%"></div></div>
      ${c.meta_especies ? `<h6 class="mt-4"><i class="bi bi-box-seam text-gold me-2"></i>Necesidades en especie</h6><p class="text-muted">${DC.esc(c.meta_especies)}</p>` : ''}
      <h6 class="mt-4"><i class="bi bi-building text-gold me-2"></i>Organización</h6>
      <p class="text-muted mb-1">${DC.esc(c.organizacion)} · ${DC.esc(c.tipo_organizacion)} <span class="badge badge-verified ms-1"><i class="bi bi-patch-check-fill me-1"></i>NIT verificado</span></p>
      <p class="small text-muted mb-0"><i class="bi bi-calendar me-1"></i>Cierre: ${c.fecha_cierre ? DC.fecha(c.fecha_cierre, false) : 'Sin fecha límite'} · Publicada: ${DC.fecha(c.fecha_creacion, false)}</p>`;
    modalDetalle.show();
  }

 
  async function login(e) {
    e.preventDefault();
    const btn = document.getElementById('btnLogin');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const codigo = document.getElementById('login2FA').value.trim();
    if (!email || !password) return DC.toast('Ingrese correo y contraseña.', 'warning');

    await DC.conBoton(btn, async () => {
      try {
        const r = await DC.api('login', { data: { email, password, codigo_2fa: estadoApp.pendiente2FA ? codigo : null } });
        if (r.requiere_2fa) {
          estadoApp.pendiente2FA = true;
          document.getElementById('grupo2FA').classList.remove('d-none');
          document.getElementById('login2FA').focus();
          DC.toast('Ingrese el código de su aplicación autenticadora.', 'info', 'Verificación 2FA');
          return;
        }
        DC.setSession(r.token, r.usuario);
        modalLogin.hide();
        await DC.alertOk(`¡Bienvenido, ${r.usuario.nombre.split(' ')[0]}!`, 'Sesión iniciada correctamente.', { timer: 1600, showConfirmButton: false });
        if (['admin', 'superadmin'].includes(r.usuario.rol)) location.href = 'admin.html';
        else location.reload();
      } catch (err) {
        DC.alertError('No se pudo iniciar sesión', err.message);
      }
    }, 'Verificando…');
  }

  async function registro(e) {
    e.preventDefault();
    const f = e.target;
    if (!f.checkValidity()) {
      f.classList.add('was-validated');
      return DC.toast('Complete correctamente los campos obligatorios.', 'warning');
    }
    if (f.password.value !== f.confirmar_password.value) return DC.alertError('Las contraseñas no coinciden');

    const fd = new FormData(f);
    fd.set('ci', f.ci.value.trim().toUpperCase());
    if (!document.getElementById('regCIFoto').files.length) fd.delete('ci_foto');

    await DC.conBoton(document.getElementById('btnRegistro'), async () => {
      try {
        const r = await DC.api('registro', { form: fd });
        DC.setSession(r.token, r.usuario);
        modalRegistro.hide();
        await DC.alertOk('¡Cuenta creada!', `
          <p>Se generó tu billetera digital con <strong>500 DCT</strong> de prueba.</p>
          <p class="small text-muted mb-0">${r.usuario.ci_foto_url
            ? 'Tu CI está en revisión. Podrás donar cuando el SuperAdmin lo verifique.'
            : 'Sube la foto de tu CI en <strong>Mi Perfil</strong> para poder donar.'}</p>`);
        location.href = 'perfil.html';
      } catch (err) {
        DC.alertError('No se pudo crear la cuenta', err.message);
      }
    }, 'Creando cuenta…');
  }


  async function abrirDonacion(idCampana, metodo = 'qr') {
    if (!DC.logged()) {
      DC.toast('Inicia sesión para donar.', 'info');
      modalLogin.show();
      return;
    }
    const c = estadoApp.campanas.find((x) => String(x.id) === String(idCampana));
    estadoApp.campanaActual = c;

    let perfil;
    try {
      perfil = await DC.api('perfil');
      DC.updateUser({ ci_verificado: perfil.ci_verificado, rol: perfil.rol });
    } catch (e) { return DC.alertError('Error', e.message); }

    if (!perfil.ci_verificado) {
      const ir = await DC.confirmar('Identidad no verificada',
        perfil.ci_foto_url
          ? 'Tu CI está en revisión por el SuperAdmin. Podrás donar en cuanto sea aprobado.'
          : 'Para donar debes subir la foto de tu Cédula de Identidad (KYC).',
        perfil.ci_foto_url ? 'Ver mi perfil' : 'Subir mi CI', 'warning');
      if (ir) location.href = 'perfil.html#seguridad';
      return;
    }

    document.getElementById('donarCampanaTitulo').textContent = `${c.titulo} · ${c.organizacion}`;
    document.getElementById('cryptoDireccion').textContent = perfil.billetera?.direccion_publica || '—';
    document.getElementById('cryptoSaldo').textContent = DC.money(perfil.billetera?.saldo, 'DCT');
    document.getElementById('especieNecesidad').innerHTML = c.meta_especies
      ? `<i class="bi bi-info-circle text-gold me-1"></i><strong>Necesidades de la campaña:</strong> ${DC.esc(c.meta_especies)}`
      : '<i class="bi bi-info-circle text-gold me-1"></i>Esta campaña acepta cualquier bien del catálogo.';
    document.getElementById('formDonarQR').reset();
    document.getElementById('qrMonto').value = 50;
    actualizarQRPago();

    const tab = metodo === 'crypto' ? '#tabCrypto' : metodo === 'especie' ? '#tabEspecie' : '#tabQR';
    bootstrap.Tab.getOrCreateInstance(document.querySelector(`[data-bs-target="${tab}"]`)).show();
    modalDonar.show();
  }

  function actualizarQRPago() {
    const c = estadoApp.campanaActual;
    if (!c) return;
    const monto = Number(document.getElementById('qrMonto').value) || 0;
    const ref = `DC-${c.id}-${DC.user()?.id || 0}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    document.getElementById('qrRef').textContent = `Ref: ${ref}`;
    DC.qr('qrPago', `DONA-CHAIN|PAGO|CAMPANA:${c.id}|MONTO:BOB ${monto.toFixed(2)}|REF:${ref}`, 170);
  }

  async function donarQR(e) {
    e.preventDefault();
    const c = estadoApp.campanaActual;
    const monto = Number(document.getElementById('qrMonto').value);
    const file = document.getElementById('qrComprobante').files[0];
    if (!monto || monto < 1) return DC.toast('Ingrese un monto válido (mínimo Bs 1).', 'warning');
    if (!file) return DC.toast('Adjunte la foto del comprobante de pago.', 'warning');

    const ok = await DC.confirmar('¿Confirmar donación?',
      `Donarás <strong class="text-gold">${DC.money(monto)}</strong> a<br><em>${DC.esc(c.titulo)}</em>.<br><small class="text-muted">Quedará pendiente hasta la conciliación.</small>`,
      'Sí, donar');
    if (!ok) return;

    const fd = new FormData();
    fd.append('tipo_donacion', 'efectivo');
    fd.append('id_campana', c.id);
    fd.append('monto', monto);
    fd.append('comprobante', file);

    await DC.conBoton(document.getElementById('btnDonarQR'), async () => {
      try {
        const r = await DC.api('donar_qr', { form: fd });
        modalDonar.hide();
        DC.alertOk('¡Gracias por tu donación!', `
          <p>Donación <strong>#${r.id}</strong> por <strong class="text-gold">${DC.money(r.monto)}</strong> registrada.</p>
          <p class="small text-muted mb-0"><i class="bi bi-hourglass-split me-1"></i>Estado: ${DC.estado('pendiente')} — recibirás una notificación cuando sea confirmada y registrada en la blockchain.</p>`);
        DC.toast('Donación enviada a conciliación.', 'success');
      } catch (err) { DC.alertError('No se pudo registrar la donación', err.message); }
    }, 'Enviando…');
  }

  async function donarCrypto(e) {
    e.preventDefault();
    const c = estadoApp.campanaActual;
    const monto = Number(document.getElementById('cryptoMonto').value);
    if (!monto || monto < 1) return DC.toast('Ingrese un monto válido.', 'warning');

    const ok = await DC.confirmar('Firmar transacción',
      `<div class="text-start small">
         <div class="mb-2"><span class="text-muted">Monto:</span> <strong class="text-emerald">${DC.money(monto, 'DCT')}</strong></div>
         <div class="mb-2"><span class="text-muted">Campaña:</span> ${DC.esc(c.titulo)}</div>
         <div class="mb-2"><span class="text-muted">Gas estimado:</span> 21 000</div>
         <div class="text-warning"><i class="bi bi-exclamation-triangle me-1"></i>Las transacciones en blockchain son irreversibles.</div>
       </div>`, 'Firmar y enviar', 'warning', '#16b483');
    if (!ok) return;

    await DC.conBoton(document.getElementById('btnDonarCrypto'), async () => {
      try {
        const r = await DC.api('donar_crypto', { data: { id_campana: c.id, monto } });
        modalDonar.hide();
        const minado = r.bloques_minados.length
          ? `<div class="alert alert-success small mt-3 mb-0"><i class="bi bi-hammer me-1"></i>¡Tu transacción completó un bloque! Se minó el bloque <strong>#${r.bloques_minados[0].indice}</strong> (nonce ${r.bloques_minados[0].nonce}).</div>`
          : '<div class="small text-muted mt-3">La transacción está en el <em>mempool</em>; se incluirá en el próximo bloque (cada 5 transacciones).</div>';
        DC.alertOk('Transacción confirmada', `
          <p>Enviaste <strong class="text-emerald">${DC.money(r.monto, 'DCT')}</strong>.</p>
          <div class="small text-muted">Hash de la transacción</div>
          <div class="hash small mb-2">${DC.esc(r.tx_hash)}</div>
          <div class="small">Saldo restante: <strong>${DC.money(r.saldo_restante, 'DCT')}</strong></div>${minado}`,
          { confirmButtonText: 'Ver en el explorador', showCancelButton: true, cancelButtonText: 'Cerrar' })
          .then((x) => { if (x.isConfirmed) location.href = `blockchain.html?tx=${r.tx_hash}`; });
        cargarCampanas();
        cargarEstadisticas();
      } catch (err) { DC.alertError('Transacción rechazada', err.message); }
    }, 'Minando…');
  }

  async function donarEspecie(e) {
    e.preventDefault();
    const c = estadoApp.campanaActual;
    const idEspecie = document.getElementById('especieTipo').value;
    const cantidad = Number(document.getElementById('especieCantidad').value);
    if (!idEspecie || !cantidad || cantidad <= 0) return DC.toast('Seleccione el bien y una cantidad válida.', 'warning');

    const fd = new FormData();
    fd.append('tipo_donacion', 'especie');
    fd.append('id_campana', c.id);
    fd.append('id_especie', idEspecie);
    fd.append('cantidad_especie', cantidad);

    await DC.conBoton(document.getElementById('btnDonarEspecie'), async () => {
      try {
        const r = await DC.api('donar_qr', { form: fd });
        modalDonar.hide();
        mostrarCodigoRecepcion(r.codigo_recepcion, `${DC.num(r.cantidad, 2)} ${r.unidad} de ${r.especie}`, c.titulo);
      } catch (err) { DC.alertError('No se pudo registrar la donación', err.message); }
    }, 'Generando…');
  }

  function mostrarCodigoRecepcion(codigo, detalle, campana) {
    DC.Swal.fire({
      title: 'Código de recepción',
      html: `
        <p class="small text-muted">Presenta este QR en el punto de acopio al entregar:</p>
        <div class="qr-box my-2"><div id="qrRecepcion"></div></div>
        <div class="fs-3 fw-800 text-gold mono mt-2">${DC.esc(codigo)}</div>
        <div class="small mt-2">${DC.esc(detalle)}</div>
        <div class="small text-muted">${DC.esc(campana)}</div>`,
      didOpen: () => DC.qr('qrRecepcion', `DONA-CHAIN|RECEPCION|${codigo}`, 190),
      confirmButtonText: 'Listo',
      footer: '<span class="small text-muted">También puedes verlo en Mi Perfil → Mis donaciones.</span>',
    });
  }
})();
