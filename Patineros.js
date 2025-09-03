// ================================
// Patineros.js (completo con lector QR real)
// ================================

// ====== Claves de almacenamiento ======
const LS_KEYS = {
  FORM_LAST_BY_LINE: "patineros_form_last_by_line",
  CONTROLISTAS: "controlistas_pendientes",
  EN_USO: "en_uso",              // { posiciones:{}, racks:{} }
  RETIRAR: "retirar_listas",     // { 1:[...], 2:[...], 3:[...] }
  SALIDAS: "salidas_listas",     // { 1:[...], 2:[...], 3:[...] }
  STATUS_POS_DET: "status_posiciones_detalle",
  STATUS_RACKS_DET: "status_racks_detalle"
};
const TAB_KEY = "patineros_tabs_state"; // { retirar:'sal1|sal2|sal3', salidas:'salout1|salout2|salout3' }

// ====== Utilidades de almacenamiento ======
function loadJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function safeSave(key, value) {
  try { saveJSON(key, value); }
  catch (e) {
    console.error("Storage lleno o inaccesible", e);
    alert("No se pudo guardar datos locales (almacenamiento lleno o bloqueado). Libera espacio y reintenta.");
  }
}

// ====== Usuario actual (proveniente del login) ======
const CURRENT_USER = loadJSON("CURRENT_USER", null);

// ====== Estado persistente ======
const enUso = loadJSON(LS_KEYS.EN_USO, { posiciones: {}, racks: {} });
const retirarListas = loadJSON(LS_KEYS.RETIRAR, { 1: [], 2: [], 3: [] });
const salidasListas = loadJSON(LS_KEYS.SALIDAS, { 1: [], 2: [], 3: [] });

// Mapas de solo lectura (llenados por Controlistas)
const statusPosDet = loadJSON(LS_KEYS.STATUS_POS_DET, {});
const statusRacksDet = loadJSON(LS_KEYS.STATUS_RACKS_DET, {});

// ====== Reconciliación de estados ======
function reconcileEnUso() {
  const nuevo = { posiciones: {}, racks: {} };

  // Ocupan recursos los que están en SALIDAS y no tienen salida
  const s = loadJSON(LS_KEYS.SALIDAS, { 1: [], 2: [], 3: [] });
  [1, 2, 3].forEach(l => {
    (s[l] || []).forEach(reg => {
      if (!reg?.salida) {
        if (reg?.posicion) nuevo.posiciones[reg.posicion] = true;
        if (reg?.rack) nuevo.racks[reg.rack] = true;
      }
    });
  });

  // También ocupan los que están en RETIRAR
  const r = loadJSON(LS_KEYS.RETIRAR, { 1: [], 2: [], 3: [] });
  [1, 2, 3].forEach(l => {
    (r[l] || []).forEach(item => {
      if (item?.posicion) nuevo.posiciones[item.posicion] = true;
      if (item?.rack) nuevo.racks[item.rack] = true;
    });
  });

  enUso.posiciones = nuevo.posiciones;
  enUso.racks = nuevo.racks;
  safeSave(LS_KEYS.EN_USO, enUso);
}
// Ejecutar reconciliación al cargar
reconcileEnUso();

// ====== DOM ======
const form = document.getElementById("formRegistro");
const inputOperador = document.getElementById("operador");
const inputCodigoSeco = document.getElementById("codigoSeco");
const inputFirmando = document.getElementById("firmandoAcum");
const inputCantidad = document.getElementById("cantidad");
const inputNumRack = document.getElementById("numRack");
const inputPosRack = document.getElementById("posRack");

const tablaRetirar1 = document.querySelector("#tablaRetirar1 tbody");
const tablaRetirar2 = document.querySelector("#tablaRetirar2 tbody");
const tablaRetirar3 = document.querySelector("#tablaRetirar3 tbody");

const tablaSalidas1 = document.querySelector("#tablaSalidas1 tbody");
const tablaSalidas2 = document.querySelector("#tablaSalidas2 tbody");
const tablaSalidas3 = document.querySelector("#tablaSalidas3 tbody");

const tablaPosiciones = document.querySelector("#tablaPosiciones tbody");
const tablaRacks = document.querySelector("#tablaRacks tbody");

const modalEntrada = document.getElementById("modalEntrada");
const modalSalida = document.getElementById("modalSalida");
const modalInfo = document.getElementById("modalInfo");
const infoDetalle = document.getElementById("infoDetalle");

const entradaResumen = document.getElementById("entradaResumen");
const salidaResumen = document.getElementById("salidaResumen");
const formEntrada = document.getElementById("formEntrada");
const formSalida = document.getElementById("formSalida");
const inputPatineroEntrada = document.getElementById("patineroEntrada");
const inputValidacionPatinero = document.getElementById("validacionPatinero");

// Confirmación de línea y QR en modal de entrada
const confirmLineaContainer = document.getElementById("confirmLineaBtns");
const inputConfirmLineaValue = document.getElementById("confirmLineaValue");
const inputConfirmRack = document.getElementById("confirmRack");
const btnScanRack = document.getElementById("btnScanRack");

// ====== Estado interno ======
let currentSalida = null;
let entradaLineaConfirmada = false;

// ====== Utils ======
function getLineaSeleccionada() {
  const r = document.querySelector('input[name="linea"]:checked');
  return r ? parseInt(r.value, 10) : null;
}
function setLineaSeleccionada(v) {
  const r = document.getElementById(`l${v}`); if (r) r.checked = true;
}
function nowISO() { return new Date().toISOString(); }
function fmtDateTime(iso) { const d = new Date(iso); return d.toLocaleString(); }
function pad3(n) { return String(n).padStart(3, "0"); }

const RX_PATTERN = /^Rack\d{3}$/;
const POS_PATTERN = /^P\d{3}$/;

function autoformatRack(value) {
  const v = (value || "").trim();
  if (RX_PATTERN.test(v)) return v;
  if (/^\d{1,3}$/.test(v)) return `Rack${pad3(parseInt(v, 10))}`;
  const m = /^Rack(\d{1,3})$/.exec(v);
  if (m) return `Rack${pad3(parseInt(m[1], 10))}`;
  return v;
}
function autoformatPos(value) {
  const v = (value || "").trim();
  if (POS_PATTERN.test(v)) return v;
  if (/^\d{1,3}$/.test(v)) return `P${pad3(parseInt(v, 10))}`;
  const m = /^P(\d{1,3})$/.exec(v);
  if (m) return `P${pad3(parseInt(m[1], 10))}`;
  return v;
}

// ====== Lector QR real (html5-qrcode) ======
let qrModal = null, qrRegion = null, qrReader = null, qrTargetInput = null;

function ensureQrDomRefs() {
  if (!qrModal) qrModal = document.getElementById("modalQR");
  if (!qrRegion) qrRegion = document.getElementById("qrRegion");
}

async function pickBestCamera(cameras) {
  if (!cameras || !cameras.length) throw new Error("No hay cámaras disponibles");
  const back = cameras.find(c => /back|rear|environment|trasera/i.test(c.label));
  return (back || cameras[0]).id;
}

// mode: 'text' | 'rack' | 'pos'
async function openQrScanner(targetInput, mode = 'text') {
  ensureQrDomRefs();
  if (!window.Html5Qrcode) { alert("No se encontró el lector QR."); return; }

  qrTargetInput = targetInput;
  qrModal.showModal();

  if (!qrReader) qrReader = new Html5Qrcode("qrRegion", false);

  try {
    const cams = await Html5Qrcode.getCameras();
    const camId = await pickBestCamera(cams);
    const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.777 };

    const onSuccess = (decodedText) => {
      let v = (decodedText || "").trim();
      if (mode === 'rack') v = autoformatRack(v);
      if (mode === 'pos') v = autoformatPos(v);

      if (qrTargetInput) {
        qrTargetInput.value = v;
        qrTargetInput.dispatchEvent(new Event("input"));
        qrTargetInput.dispatchEvent(new Event("blur"));
      }
      stopQrScanner();
    };
    const onError = (_err) => { /* ignorar lecturas fallidas */ };

    await qrReader.start({ deviceId: { exact: camId } }, config, onSuccess, onError);
  } catch (err) {
    console.error(err);
    alert("No se pudo iniciar la cámara. Usa HTTPS o concede permisos.");
    try { await stopQrScanner(); } catch { }
  }
}

async function stopQrScanner() {
  try {
    if (qrReader && qrReader._isScanning) {
      await qrReader.stop();
      await qrReader.clear();
    }
  } finally {
    if (qrModal?.open) qrModal.close();
    qrTargetInput = null;
  }
}

// Botón cancelar del modal QR
document.getElementById("btnQrCancel")?.addEventListener("click", () => { stopQrScanner(); });

// ====== Helper visual para tabla (OK / Dañado / —) ======
function damageCellHTML(val) {
  if (val === true) return `<td class="busy">Dañado</td>`;
  if (val === false) return `<td class="ok">OK</td>`;
  return `<td>—</td>`;
}

// ====== Último formulario por línea ======
function loadLastByLine() { return loadJSON(LS_KEYS.FORM_LAST_BY_LINE, { 1: null, 2: null, 3: null, 4: null }); }
function saveLastByLine(map) { safeSave(LS_KEYS.FORM_LAST_BY_LINE, map); }

function prefillFromLast(linea) {
  const map = loadLastByLine();
  const last = map[linea] || null;
  if (!last) return;
  inputOperador.value = last.operador || "";
  inputCodigoSeco.value = last.codigoSeco || "";
  inputFirmando.value = last.firmando || "— Se autocompleta al validar —";
  inputCantidad.value = last.cantidad || "";
  inputNumRack.value = last.numRack || "";
  inputPosRack.value = last.posRack || "";
}

// ====== Persistencia de pestañas ======
function loadTabs() { return loadJSON(TAB_KEY, { retirar: 'sal1', salidas: 'salout1' }); }
function saveTabs(v) { safeSave(TAB_KEY, v); }

// Restaurar pestañas en load
(function restoreTabs() {
  const st = loadTabs();
  document.getElementById(st.retirar)?.setAttribute("checked", "checked");
  document.getElementById(st.salidas)?.setAttribute("checked", "checked");
})();

// Escuchar cambios de pestañas
["sal1", "sal2", "sal3"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", () => {
    const st = loadTabs(); st.retirar = id; saveTabs(st);
  });
});
["salout1", "salout2", "salout3"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", () => {
    const st = loadTabs(); st.salidas = id; saveTabs(st);
  });
});

// ====== Listeners de formulario/inputs ======
document.querySelectorAll('input[name="linea"]').forEach(r => {
  r.addEventListener("change", () => {
    const linea = getLineaSeleccionada();
    inputOperador.value = "";
    inputCodigoSeco.value = "";
    inputFirmando.value = "— Se autocompleta al validar —";
    inputCantidad.value = "";
    inputNumRack.value = "";
    inputPosRack.value = "";
    prefillFromLast(linea);
  });
});

// Prefill inicial
(function prefillInit() {
  const linea = getLineaSeleccionada();
  if (linea) prefillFromLast(linea);
})();

// Autocompletar “Firmando el acumulador”
inputCodigoSeco.addEventListener("input", () => {
  inputFirmando.value = inputCodigoSeco.value ? `Acum: ${inputCodigoSeco.value.toUpperCase()}` : "— Se autocompleta al validar —";
});

// Normalización en blur
inputNumRack.addEventListener("blur", () => { inputNumRack.value = autoformatRack(inputNumRack.value); });
inputPosRack.addEventListener("blur", () => { inputPosRack.value = autoformatPos(inputPosRack.value); });

// Normalización “en vivo” (útil al pegar de QR)
[inputNumRack, inputPosRack].forEach(inp => {
  inp.addEventListener("input", () => {
    const v = (inp === inputNumRack) ? autoformatRack(inp.value) : autoformatPos(inp.value);
    if (/^Rack\d{0,3}$/.test(v) || /^P\d{0,3}$/.test(v)) inp.value = v;
  });
});

// ====== Guardar Registro ======
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const linea = getLineaSeleccionada();
  const operador = inputOperador.value.trim();
  const codigoSeco = inputCodigoSeco.value.trim();
  const firmando = inputFirmando.value.trim();
  const cantidad = Number.parseInt(inputCantidad.value || "0", 10);

  // Normalizar antes de validar/consultar enUso
  let rack = autoformatRack(inputNumRack.value);
  let posicion = autoformatPos(inputPosRack.value);
  inputNumRack.value = rack;
  inputPosRack.value = posicion;

  // Validaciones
  if (!linea || !operador || !codigoSeco || !rack || !posicion) {
    alert("Completa todos los campos del registro.");
    return;
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    alert("La cantidad debe ser un entero mayor que 0.");
    inputCantidad.focus();
    return;
  }
  if (!RX_PATTERN.test(rack)) {
    alert('El número de rack debe tener formato "Rack###", ej. "Rack001".');
    inputNumRack.focus(); return;
  }
  if (!POS_PATTERN.test(posicion)) {
    alert('La posición debe tener formato "P###", ej. "P002".');
    inputPosRack.focus(); return;
  }

  // Validación de ocupación
  reconcileEnUso();
  if (enUso.posiciones[posicion]) {
    alert(`La posición ${posicion} ya está en uso. Elige otra.`);
    inputPosRack.focus(); return;
  }
  if (enUso.racks[rack]) {
    alert(`El rack ${rack} ya está en uso. Elige otro.`);
    inputNumRack.focus(); return;
  }

  // 1) Guardar “último formulario” por línea (dejando rack/pos vacíos)
  const map = loadLastByLine();
  map[linea] = { linea, operador, codigoSeco, firmando, cantidad, numRack: "", posRack: "" };
  saveLastByLine(map);

  // 2) Enviar a Controlistas (pendientes) con trazabilidad
  const nuevo = {
    id: crypto.randomUUID(),
    linea, operador, codigoSeco, firmando, cantidad,
    rack, posicion,
    creadoEn: nowISO(),
    registradoPorId: CURRENT_USER?.id || null,
    registradoPorNombre: CURRENT_USER?.name || operador,
    registradoPorRol: CURRENT_USER?.role || "desconocido"
  };
  const controlistasPend = loadJSON(LS_KEYS.CONTROLISTAS, []);
  controlistasPend.push(nuevo);
  safeSave(LS_KEYS.CONTROLISTAS, controlistasPend);

  // 3) Marcar EN USO
  enUso.posiciones[posicion] = true;
  enUso.racks[rack] = true;
  safeSave(LS_KEYS.EN_USO, enUso);

  // 4) Añadir a RETIRAR
  (retirarListas[linea] = retirarListas[linea] || []).push({
    posicion, rack, linea, refId: nuevo.id,
    operador: nuevo.operador, empleado: nuevo.registradoPorId,
    codigoSeco, cantidad, creadoEn: nuevo.creadoEn, registradoPorNombre: nuevo.registradoPorNombre
  });
  safeSave(LS_KEYS.RETIRAR, retirarListas);

  // 5) Limpiar rack/pos en la UI actual
  inputNumRack.value = "";
  inputPosRack.value = "";

  renderAll();
  alert("Registro guardado y enviado a Controlistas.");
});

// ====== Retirar -> mover a Salidas ======
function handleRetirar(item, linea) {
  if (!confirm(`¿Mover a SALIDAS?\nLínea ${linea} • ${item.posicion} • ${item.rack}`)) return;

  const registro = {
    id: crypto.randomUUID(),
    linea,
    posicion: item.posicion,
    rack: item.rack,
    refId: item.refId || null,
    operador: item.operador || null,
    empleado: item.empleado || null,
    codigoSeco: item.codigoSeco || null,
    cantidad: item.cantidad ?? null,
    creadoEn: item.creadoEn || nowISO(),
    registradoPorNombre: item.registradoPorNombre || null,
    entrada: null,            // {byId, byName, confirmLinea, confirmRack, at}
    salida: null,             // {byId, byName, at}
    entradaGuardadaEn: null
  };

  // Evitar duplicados en la misma línea (rack+pos sin salida)
  const yaExiste = (salidasListas[linea] || []).some(r => r.rack === item.rack && r.posicion === item.posicion && !r.salida);
  if (!yaExiste) {
    (salidasListas[linea] = salidasListas[linea] || []).push(registro);
    safeSave(LS_KEYS.SALIDAS, salidasListas);
  }

  // Quitar de retirar
  const arr = retirarListas[linea] || [];
  const idx = arr.findIndex(x => x.posicion === item.posicion && x.rack === item.rack);
  if (idx >= 0) { arr.splice(idx, 1); retirarListas[linea] = arr; safeSave(LS_KEYS.RETIRAR, retirarListas); }

  renderAll();
}

// ====== Entrada / Salida ======

// Click en fila para ver detalle (ignorando clicks en botones)
function attachRowInfoHandlers(tbody, lista) {
  tbody.querySelectorAll("tr").forEach((tr, i) => {
    tr.addEventListener("click", (ev) => {
      if (ev.target.closest("button")) return;
      const reg = lista[i];
      if (!reg) return;
      const detalle = [
        `Línea: ${reg.linea}`,
        `Posición: ${reg.posicion}`,
        `Rack: ${reg.rack}`,
        `Operador: ${reg.operador ?? "—"}`,
        `Código de seco: ${reg.codigoSeco ?? "—"}`,
        `Cantidad: ${reg.cantidad ?? "—"}`,
        `Registrado por: ${reg.registradoPorNombre ?? "—"}`,
        `Creado en: ${fmtDateTime(reg.creadoEn)}`,
        `Entrada: ${reg.entrada ? (reg.entrada.byName + " • " + fmtDateTime(reg.entrada.at) + " • Línea conf: " + reg.entrada.confirmLinea + " • Rack conf: " + reg.entrada.confirmRack) : "—"}`,
        `Salida: ${reg.salida ? (reg.salida.byName + " • " + fmtDateTime(reg.salida.at)) : "—"}`
      ].join("<br>");
      infoDetalle.innerHTML = detalle;
      modalInfo.showModal();
    });
  });
}

// Abrir modal ENTRADA
function openEntradaModal(reg) {
  currentSalida = reg;

  // Reset confirmación de línea
  entradaLineaConfirmada = false;
  inputConfirmLineaValue.value = "";
  confirmLineaContainer?.querySelectorAll("button[data-linea]")
    .forEach(b => b.classList.remove("active"));

  // Resumen
  entradaResumen.textContent = `Línea ${reg.linea} | Posición ${reg.posicion} | Rack ${reg.rack}`;

  // Sugerir nombre (editable)
  inputPatineroEntrada.value = CURRENT_USER?.name || "";

  // Limpiar confirmación de rack
  inputConfirmRack.value = "";

  modalEntrada.showModal();
  setTimeout(() => inputPatineroEntrada?.focus(), 50);
}

// Delegación: botones “Línea 1/2/3/4”
confirmLineaContainer?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-linea]");
  if (!btn) return;
  const lineaSel = parseInt(btn.dataset.linea, 10);
  if (!Number.isInteger(lineaSel)) return;

  inputConfirmLineaValue.value = String(lineaSel);
  entradaLineaConfirmada = true;

  // Visual activo
  confirmLineaContainer.querySelectorAll("button[data-linea]")
    .forEach(b => b.classList.toggle("active", b === btn));
});

// Botón “Escanear QR” del rack en modal de ENTRADA (lector real)
btnScanRack?.addEventListener("click", () => openQrScanner(inputConfirmRack, 'rack'));

// Guardar ENTRADA
formEntrada.addEventListener("click", (e) => {
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;

  if (btn.value === "save" && currentSalida) {
    const byName = inputPatineroEntrada.value.trim() || CURRENT_USER?.name || "";
    const byId = CURRENT_USER?.id || null;

    // 1) Línea confirmada y coincidente
    const lineaSeleccionada = parseInt(inputConfirmLineaValue.value, 10);
    if (!entradaLineaConfirmada || lineaSeleccionada !== currentSalida.linea) {
      alert(`Debes seleccionar la línea correcta (Línea ${currentSalida.linea}).`);
      return;
    }

    // 2) Confirmación de Rack obligatoria y coincidente
    let confirmRack = autoformatRack(inputConfirmRack.value.trim());
    if (!confirmRack) {
      alert("Debes confirmar el Rack (ej. Rack001).");
      inputConfirmRack.focus(); return;
    }
    inputConfirmRack.value = confirmRack;
    if (confirmRack !== currentSalida.rack) {
      alert(`El Rack confirmado (${confirmRack}) no coincide con el asignado (${currentSalida.rack}).`);
      inputConfirmRack.focus(); return;
    }

    // Guardar entrada
    currentSalida.entrada = {
      byId, byName,
      confirmLinea: currentSalida.linea,
      confirmRack,
      at: nowISO()
    };
    currentSalida.entradaGuardadaEn = Date.now();
    safeSave(LS_KEYS.SALIDAS, salidasListas);

    modalEntrada.close();
    renderAll();
  }

  if (btn.value === "cancel") modalEntrada.close();
});

// Habilitar “Dar salida” tras 1 minuto
function canShowDarSalida(reg) {
  if (!reg.entradaGuardadaEn) return false;
  return (Date.now() - reg.entradaGuardadaEn) >= 60 * 1000; // 1 min
}
function secondsToEnable(reg) {
  if (!reg.entradaGuardadaEn) return 60;
  const diff = 60 - Math.floor((Date.now() - reg.entradaGuardadaEn) / 1000);
  return Math.max(0, diff);
}

// Abrir modal SALIDA
function openSalidaModal(reg) {
  currentSalida = reg;
  salidaResumen.textContent = `Línea ${reg.linea} | Posición ${reg.posicion} | Rack ${reg.rack}`;
  inputValidacionPatinero.value = CURRENT_USER?.name || "";
  modalSalida.showModal();
  setTimeout(() => inputValidacionPatinero?.focus(), 50);
}

// Guardar SALIDA
formSalida.addEventListener("click", (e) => {
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;

  if (btn.value === "save" && currentSalida) {
    const byName = inputValidacionPatinero.value.trim() || CURRENT_USER?.name || "";
    const byId = CURRENT_USER?.id || null;
    if (!byName) return;

    // Guardar salida
    currentSalida.salida = { byId, byName, at: nowISO() };

    // Liberar recursos
    delete enUso.posiciones[currentSalida.posicion];
    delete enUso.racks[currentSalida.rack];
    safeSave(LS_KEYS.EN_USO, enUso);

    // Eliminar de la lista de salidas
    const lista = salidasListas[currentSalida.linea] || [];
    const idx = lista.findIndex(x => x.id === currentSalida.id);
    if (idx >= 0) { lista.splice(idx, 1); salidasListas[currentSalida.linea] = lista; }
    safeSave(LS_KEYS.SALIDAS, salidasListas);

    modalSalida.close();
    renderAll();
  }

  if (btn.value === "cancel") modalSalida.close();
});

// ====== Render ======
function renderRetirar() {
  function fill(tbody, lista, linea) {
    tbody.innerHTML = "";
    if (!lista || !lista.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; opacity:.7">Sin elementos</td></tr>`;
      return;
    }
    lista.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.posicion}</td>
        <td>${item.rack}</td>
        <td><button class="accent" type="button">Retirar</button></td>
      `;
      tr.querySelector("button").addEventListener("click", () => handleRetirar(item, linea));
      tbody.appendChild(tr);
    });
  }
  fill(tablaRetirar1, retirarListas[1] || [], 1);
  fill(tablaRetirar2, retirarListas[2] || [], 2);
  fill(tablaRetirar3, retirarListas[3] || [], 3);
}

function renderSalidas() {
  function fill(tbody, lista) {
    tbody.innerHTML = "";

    // Registro activo (con entrada y sin salida) en esta línea
    const activo = (lista || []).find(r => r.entrada && !r.salida);
    const activoId = activo?.id || null;

    if (!lista || !lista.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; opacity:.7">Sin elementos</td></tr>`;
      return;
    }

    lista.forEach(reg => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${reg.posicion}</td><td>${reg.rack}</td><td></td><td></td>`;

      if (activoId && reg.id !== activoId) {
        // Mientras otro esté activo, este no muestra botones
      } else {
        if (!reg.entrada) {
          // No hay activo: puede dar entrada
          if (!activoId) {
            const btnEntrada = document.createElement("button");
            btnEntrada.type = "button";
            btnEntrada.textContent = "Dar entrada";
            btnEntrada.className = "primary";
            btnEntrada.addEventListener("click", () => openEntradaModal(reg));
            tr.children[2].appendChild(btnEntrada);
          }
        } else {
          // Es el activo de la línea: mostrar salida (o cuenta regresiva)
          const btnSalida = document.createElement("button");
          btnSalida.type = "button";
          const left = secondsToEnable(reg);
          if (left === 0) {
            btnSalida.textContent = "Dar salida";
            btnSalida.className = "accent";
            btnSalida.disabled = false;
            btnSalida.addEventListener("click", () => openSalidaModal(reg));
          } else {
            btnSalida.textContent = `Dar salida (${left}s)`;
            btnSalida.className = "primary";
            btnSalida.disabled = true;
          }
          tr.children[3].appendChild(btnSalida);
        }
      }

      tbody.appendChild(tr);
    });

    attachRowInfoHandlers(tbody, lista);
  }

  fill(tablaSalidas1, salidasListas[1] || []);
  fill(tablaSalidas2, salidasListas[2] || []);
  fill(tablaSalidas3, salidasListas[3] || []);
}

function renderPosiciones() {
  tablaPosiciones.innerHTML = "";
  for (let i = 1; i <= 450; i++) {
    const p = `P${pad3(i)}`;
    const libre = !enUso.posiciones[p];

    const det = statusPosDet[p] || {};
    const tdActuador = damageCellHTML(det.actuador);
    const tdTarjeta = damageCellHTML(det.tarjeta);
    const tdAbraz = damageCellHTML(det.abrazaderas);
    const tdCable = damageCellHTML(det.cable_bajada);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p}</td>
      <td class="${libre ? "ok" : "busy"}">${libre ? "Libre" : "Ocupada"}</td>
      ${tdActuador}
      ${tdTarjeta}
      ${tdAbraz}
      ${tdCable}
      <td>—</td>
    `;
    tablaPosiciones.appendChild(tr);
  }
}

function renderRacks() {
  tablaRacks.innerHTML = "";
  for (let i = 1; i <= 435; i++) {
    const r = `Rack${pad3(i)}`;
    const libre = !enUso.racks[r];

    const det = statusRacksDet[r] || {};
    const tdSoporte = damageCellHTML(det.soporte_dren);
    const tdPorta = damageCellHTML(det.porta_manguera);
    const tdTina = damageCellHTML(det.tina);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r}</td>
      <td class="${libre ? "ok" : "busy"}">${libre ? "Listo" : "En uso"}</td>
      ${tdSoporte}
      ${tdPorta}
      ${tdTina}
    `;
    tablaRacks.appendChild(tr);
  }
}

// Contadores por línea en encabezados
function updateCountersUI() {
  const hRet = document.querySelector('#retirar .panel-header h2');
  const hSal = document.querySelector('#salidas .panel-header h2');

  const r1 = (retirarListas[1] || []).length, r2 = (retirarListas[2] || []).length, r3 = (retirarListas[3] || []).length;
  const s1 = (salidasListas[1] || []).length, s2 = (salidasListas[2] || []).length, s3 = (salidasListas[3] || []).length;

  if (hRet) hRet.textContent = `Retirar Racks — L1:${r1} • L2:${r2} • L3:${r3}`;
  if (hSal) hSal.textContent = `Salidas — L1:${s1} • L2:${s2} • L3:${s3}`;
}

function renderAll() {
  renderRetirar();
  renderSalidas();
  renderPosiciones();
  renderRacks();
  updateCountersUI();
}

// ====== Inicialización de render y timers ======
renderAll();
// Refresco ágil para la cuenta regresiva de salida
setInterval(() => renderSalidas(), 1000);

// ====== Sección Comentarios (placeholder) ======
document.getElementById("formComentario")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const txt = (document.getElementById("comentario")?.value || "").trim();
  if (!txt) return;
  const arr = JSON.parse(localStorage.getItem("comentarios") || "[]");
  const user = JSON.parse(localStorage.getItem("CURRENT_USER") || "null");
  arr.push({ by: user?.name || "Patinero", text: txt, at: new Date().toISOString() });
  localStorage.setItem("comentarios", JSON.stringify(arr));
  e.target.reset();
  alert("Comentario enviado.");
});

// ====== Botones de escaneo QR en el formulario principal ======
const btnScanSeco = inputCodigoSeco?.closest(".with-actions")?.querySelector("button");
const btnScanNumRack = inputNumRack?.closest(".with-actions")?.querySelector("button");
const btnScanPosRack = inputPosRack?.closest(".with-actions")?.querySelector("button");

btnScanSeco?.addEventListener("click", () => openQrScanner(inputCodigoSeco, 'text'));
btnScanNumRack?.addEventListener("click", () => openQrScanner(inputNumRack, 'rack'));
btnScanPosRack?.addEventListener("click", () => openQrScanner(inputPosRack, 'pos'));
