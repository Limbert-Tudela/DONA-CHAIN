
(() => {
  const st = { bloques: [], validacion: null };
  let modalBloque;

  document.addEventListener('DOMContentLoaded', async () => {
    DC.renderNavbar('blockchain');
    DC.renderFooter();
    modalBloque = new bootstrap.Modal('#modalBloque');

    document.getElementById('btnValidarCadena').addEventListener('click', () => validar(true));
    document.getElementById('btnRecargar').addEventListener('click', () => cargar());
    document.getElementById('formBuscarTx').addEventListener('submit', (e) => { e.preventDefault(); buscar(document.getElementById('buscarTx').value.trim()); });

    await cargar();
    await validar(false);

    const tx = DC.qp('tx');
    const bloque = DC.qp('bloque');
    if (tx) { document.getElementById('buscarTx').value = tx; buscar(tx); } else if (bloque !== null) abrirBloque(Number(bloque));

    setInterval(() => { if (!document.hidden) cargar(true); }, 15000);
  });


  async function cargar(silencioso = false) {
    try {
      const d = await DC.api('obtener_bloques', { params: { limite: 100 } });
      st.bloques = d.bloques;
      const s = d.estadisticas;
      document.getElementById('sBloques').textContent = DC.num(s.total_bloques);
      document.getElementById('sTx').textContent = DC.num(s.total_tx);
      document.getElementById('sMempool').textContent = DC.num(s.tx_pendientes);
      document.getElementById('sVolumen').textContent = DC.money(s.volumen_total, '');
      document.getElementById('sGas').textContent = DC.num(s.gas_total);
      document.getElementById('sDificultad').textContent = `"${'0'.repeat(s.dificultad)}"`;
      renderCadena();
      renderTabla();
      renderMempool(d.pendientes, s.tx_por_bloque);
    } catch (e) {
      if (!silencioso) DC.alertError('No se pudo cargar la blockchain', e.message);
    }
  }

  const estadoDe = (indice) => st.validacion?.bloques.find((b) => b.indice === Number(indice))?.estado || null;

  function renderCadena() {
    const cont = document.getElementById('cadenaVisual');
    const lista = [...st.bloques].sort((a, b) => a.indice - b.indice).slice(-12);
    if (!lista.length) { cont.innerHTML = '<div class="text-muted p-3">No hay bloques.</div>'; return; }
    cont.innerHTML = lista.map((b, i) => {
      const est = estadoDe(b.indice);
      const roto = est && est !== 'valido';
      return `${i > 0 ? `<div class="chain-link ${roto ? 'broken' : ''}"></div>` : ''}
        <div class="block-card ${est || ''} ${Number(b.indice) === 0 ? 'genesis' : ''}" data-idx="${b.indice}">
          <div class="d-flex justify-content-between align-items-center">
            <span class="idx">#${b.indice}</span>
            ${est ? `<i class="bi ${est === 'valido' ? 'bi-shield-check text-emerald' : 'bi-exclamation-octagon-fill text-danger'}"></i>` : ''}
          </div>
          <div class="row-k">Hash</div><div class="hash" style="font-size:.7rem">${DC.esc(DC.short(b.hash_actual, 10, 6))}</div>
          <div class="row-k">Anterior</div><div class="hash" style="font-size:.7rem">${DC.esc(DC.short(b.hash_anterior, 10, 6))}</div>
          <div class="d-flex justify-content-between mt-2 small"><span class="text-muted">nonce <strong class="text-light">${b.nonce}</strong></span><span class="text-muted">${b.num_tx} TX</span></div>
        </div>`;
    }).join('');
    cont.querySelectorAll('.block-card').forEach((c) => c.addEventListener('click', () => abrirBloque(Number(c.dataset.idx))));
    cont.scrollLeft = cont.scrollWidth;
  }

  function renderTabla() {
    const tb = document.querySelector('#tablaBloques tbody');
    tb.innerHTML = st.bloques.length ? st.bloques.map((b) => {
      const est = estadoDe(b.indice);
      return `<tr style="cursor:pointer" data-idx="${b.indice}">
        <td><span class="badge ${Number(b.indice) === 0 ? 'bg-warning text-dark' : 'bg-secondary'}">#${b.indice}</span></td>
        <td class="hash" title="${DC.esc(b.hash_actual)}"><span class="text-emerald">${DC.esc(b.hash_actual.slice(0, b.dificultad))}</span>${DC.esc(DC.short(b.hash_actual, 12, 6).slice(Number(b.dificultad)))}</td>
        <td class="hash" title="${DC.esc(b.hash_anterior)}">${DC.esc(DC.short(b.hash_anterior, 10, 4))}</td>
        <td class="mono small">${b.nonce}</td>
        <td>${b.num_tx}</td>
        <td class="small text-nowrap">${DC.money(b.monto_total, '')}</td>
        <td class="hash" title="${DC.esc(b.minero)}">${DC.esc(DC.short(b.minero, 8, 4))}</td>
        <td class="small text-nowrap">${DC.fecha(b.timestamp)}</td>
        <td>${est ? DC.estado(est) : '<span class="text-muted small">—</span>'}</td>
      </tr>`;
    }).join('') : DC.filaVacia(9, 'Sin bloques');
    tb.querySelectorAll('tr[data-idx]').forEach((r) => r.addEventListener('click', () => abrirBloque(Number(r.dataset.idx))));
  }

  function renderMempool(pend, porBloque) {
    document.getElementById('mempoolCount').textContent = `${pend.length}/${porBloque}`;
    const el = document.getElementById('listaMempool');
    const pct = Math.min((pend.length / porBloque) * 100, 100);
    el.innerHTML = `
      <div class="small text-muted mb-2">Al llegar a ${porBloque} transacciones se mina un bloque automáticamente.</div>
      <div class="progress progress-dc mb-3"><div class="progress-bar" style="width:${pct}%"></div></div>
      ${pend.length ? pend.map((t) => `
        <div class="feed-item">
          <div class="feed-ico" style="background:#f0b42920;color:#f5c451"><i class="bi bi-hourglass-split"></i></div>
          <div class="min-w-0 flex-grow-1">
            <a href="#" class="hash d-block" data-tx="${DC.esc(t.hash_transaccion)}">${DC.esc(DC.short(t.hash_transaccion, 14, 6))}</a>
            <div class="small text-muted">${DC.money(t.monto, '')} · donación #${t.id_donacion ?? '—'} · ${DC.haceTiempo(t.fecha)}</div>
          </div>
        </div>`).join('') : '<div class="empty-state py-3"><i class="bi bi-inbox"></i>Mempool vacío</div>'}`;
    el.querySelectorAll('[data-tx]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); buscar(a.dataset.tx); }));
  }


  async function validar(mostrarAlerta) {
    const btn = document.getElementById('btnValidarCadena');
    await DC.conBoton(btn, async () => {
      try {
        const r = await DC.api('validar_blockchain');
        st.validacion = r;
        const el = document.getElementById('estadoValidacion');
        if (r.valida) {
          el.innerHTML = `<div class="chain-status ok"><i class="bi bi-shield-fill-check big text-emerald"></i>
            <div><strong class="text-emerald">Cadena íntegra</strong><div class="small text-muted">${r.total_bloques} bloques válidos · validado ${DC.fecha(r.fecha_validacion)}</div></div></div>`;
          if (mostrarAlerta) DC.toast('Cadena íntegra: todos los hashes coinciden.', 'success', 'Blockchain válida');
        } else {
          const comp = r.bloques.filter((b) => b.estado === 'comprometido').length;
          el.innerHTML = `<div class="chain-status bad"><i class="bi bi-exclamation-octagon-fill big text-danger"></i>
            <div><strong class="text-danger">CADENA ALTERADA</strong><div class="small">${DC.esc(r.mensaje)}
            ${comp ? `<br><span class="text-warning">Efecto dominó: ${comp} bloque(s) posteriores quedaron comprometidos.</span>` : ''}</div></div></div>`;
          if (mostrarAlerta) {
            DC.Swal.fire({
              icon: 'error', title: '⚠ Manipulación detectada', iconColor: '#ef5b5b',
              html: `<p class="text-danger">${DC.esc(r.mensaje)}</p>${r.bloques.filter((b) => b.estado !== 'valido').map((b) =>
                `<div class="text-start small mb-2 p-2 rounded" style="background:#ef5b5b14;border:1px solid #ef5b5b44"><strong>#${b.indice}</strong> ${DC.estado(b.estado)}<br>${b.errores.map(DC.esc).join('<br>')}</div>`).join('')}`,
              confirmButtonColor: '#d64545', width: 620,
            });
          }
        }
        renderCadena();
        renderTabla();
      } catch (e) { DC.alertError('Error al validar', e.message); }
    }, 'Validando…');
  }


  async function abrirBloque(indice) {
    const b = st.bloques.find((x) => Number(x.indice) === indice);
    if (!b) return DC.toast(`El bloque #${indice} no existe.`, 'warning');
    const v = st.validacion?.bloques.find((x) => x.indice === indice);
    document.getElementById('bloqueTitulo').innerHTML = `<i class="bi bi-box text-gold me-2"></i>Bloque #${b.indice} ${Number(b.indice) === 0 ? '<span class="badge bg-warning text-dark ms-1">GÉNESIS</span>' : ''}`;
    const body = document.getElementById('bloqueBody');
    body.innerHTML = '<div class="text-muted">Cargando transacciones…</div>';
    modalBloque.show();
    let txs = [];
    try { txs = await DC.api('obtener_transacciones_bloque', { params: { indice } }); } catch (e) { DC.toast(e.message, 'error'); }
    const fila = (k, val) => `<tr><th class="text-muted fw-normal" style="width:190px">${k}</th><td>${val}</td></tr>`;
    body.innerHTML = `
      ${v && v.estado !== 'valido' ? `<div class="chain-status bad mb-3"><i class="bi bi-exclamation-octagon-fill big text-danger"></i><div><strong>Bloque ${v.estado}</strong><div class="small">${v.errores.map(DC.esc).join('<br>')}</div>
        <div class="small mt-1">Hash recalculado: <span class="hash">${DC.esc(v.hash_recalculado)}</span></div></div></div>` : ''}
      <table class="table table-dc mb-4"><tbody>
        ${fila('Índice', `<strong>${b.indice}</strong>`)}
        ${fila('Timestamp', DC.fecha(b.timestamp))}
        ${fila('Hash', `<span class="hash">${DC.esc(b.hash_actual)}</span> <i class="bi bi-copy copy-btn" data-copy="${DC.esc(b.hash_actual)}"></i>`)}
        ${fila('Hash anterior', `<span class="hash">${DC.esc(b.hash_anterior)}</span>${Number(b.indice) > 0 ? ` <a href="#" class="small ms-1" data-ir="${b.indice - 1}">ver #${b.indice - 1}</a>` : ''}`)}
        ${fila('Nonce', `<span class="mono text-gold">${b.nonce}</span> <span class="small text-muted">(${Number(b.nonce) + 1} intentos de Proof of Work)</span>`)}
        ${fila('Dificultad', `${b.dificultad} → el hash debe empezar con <span class="mono text-emerald">${'0'.repeat(b.dificultad)}</span>`)}
        ${fila('Minero', `<span class="hash">${DC.esc(b.minero)}</span>`)}
        ${fila('Transacciones', `${b.num_tx} · ${DC.money(b.monto_total, '')}`)}
      </tbody></table>
      <h6 class="ornament-title mb-3">Transacciones del bloque</h6>
      <div class="table-responsive"><table class="table table-dc">
        <thead><tr><th>Hash TX</th><th>De</th><th>Para</th><th>Monto</th><th>Gas</th><th>Tipo</th><th>Campaña</th><th>Fecha</th></tr></thead>
        <tbody>${txs.length ? txs.map((t) => `<tr>
          <td class="hash" title="${DC.esc(t.hash_transaccion)}">${DC.esc(DC.short(t.hash_transaccion, 12, 6))}</td>
          <td class="hash" title="${DC.esc(t.from_address)}">${DC.esc(DC.short(t.from_address, 8, 4))}</td>
          <td class="hash" title="${DC.esc(t.to_address)}">${DC.esc(DC.short(t.to_address, 8, 4))}</td>
          <td class="text-nowrap">${DC.money(t.monto, '')}</td>
          <td class="mono small">${DC.num(t.gas_usado)}</td>
          <td>${t.tipo_donacion ? DC.tipo(t.tipo_donacion) : '—'}</td>
          <td class="small">${DC.esc(t.campana || '—')}</td>
          <td class="small text-nowrap">${DC.fecha(t.fecha)}</td></tr>`).join('') : DC.filaVacia(8, Number(b.indice) === 0 ? 'El bloque génesis no contiene transacciones.' : 'Sin transacciones')}</tbody>
      </table></div>`;
    body.querySelectorAll('[data-copy]').forEach((i) => i.addEventListener('click', () => DC.copiar(i.dataset.copy)));
    body.querySelectorAll('[data-ir]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); abrirBloque(Number(a.dataset.ir)); }));
  }


  async function buscar(q) {
    if (!q) return;
    if (/^\d+$/.test(q)) return abrirBloque(Number(q));
    if (!/^0x[0-9a-fA-F]{64}$/.test(q)) return DC.toast('Ingrese un hash de transacción válido (0x + 64 caracteres) o un número de bloque.', 'warning');
    try {
      const t = await DC.api('buscar_transaccion', { params: { hash: q } });
      DC.Swal.fire({
        title: 'Transacción',
        width: 720,
        html: `<table class="table table-dc text-start small"><tbody>
          <tr><th class="text-muted fw-normal">Hash</th><td class="hash">${DC.esc(t.hash_transaccion)}</td></tr>
          <tr><th class="text-muted fw-normal">Estado</th><td>${t.bloque_indice !== null ? `<span class="estado estado-completado">confirmada</span> en el bloque <a href="#" id="irBloqueTx">#${t.bloque_indice}</a>` : '<span class="estado estado-pendiente">en mempool</span>'}</td></tr>
          <tr><th class="text-muted fw-normal">De</th><td class="hash">${DC.esc(t.from_address)}</td></tr>
          <tr><th class="text-muted fw-normal">Para</th><td class="hash">${DC.esc(t.to_address)}</td></tr>
          <tr><th class="text-muted fw-normal">Monto</th><td><strong class="text-gold">${DC.money(t.monto, t.tipo_donacion === 'crypto' ? 'DCT' : 'Bs')}</strong></td></tr>
          <tr><th class="text-muted fw-normal">Gas usado</th><td>${DC.num(t.gas_usado)}</td></tr>
          <tr><th class="text-muted fw-normal">Donación</th><td>#${t.id_donacion ?? '—'} ${t.tipo_donacion ? DC.tipo(t.tipo_donacion) : ''} ${t.estado_donacion ? DC.estado(t.estado_donacion) : ''}</td></tr>
          <tr><th class="text-muted fw-normal">Campaña</th><td>${DC.esc(t.campana || '—')}</td></tr>
          <tr><th class="text-muted fw-normal">Fecha</th><td>${DC.fecha(t.fecha)}</td></tr>
        </tbody></table>`,
        confirmButtonText: 'Cerrar',
        didOpen: () => {
          const a = document.getElementById('irBloqueTx');
          if (a) a.addEventListener('click', (e) => { e.preventDefault(); DC.Swal.close(); abrirBloque(Number(t.bloque_indice)); });
        },
      });
    } catch (e) { DC.alertError('Transacción no encontrada', e.message); }
  }
})();
