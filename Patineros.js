// ================================
// Patineros.js (completo con lector de CÓDIGOS DE BARRAS - Quagga)
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

// ====== Usuario actual ======
const CURRENT_USER = loadJSON("CURRENT_USER", null);

// ====== Estado persistente ======
const enUso         = loadJSON(LS_KEYS.EN_USO, { posiciones:{}, racks:{} });
const retirarListas = loadJSON(LS_KEYS.RETIRAR, {1:[],2:[],3:[]});
const salidasListas = loadJSON(LS_KEYS.SALIDAS, {1:[],2:[],3:[]});

// Mapas de solo lectura (llenados por Controlistas)
const statusPosDet   = loadJSON(LS_KEYS.STATUS_POS_DET, {});
const statusRacksDet = loadJSON(LS_KEYS.STATUS_RACKS_DET, {});

// ====== Reconciliación de estados ======
function reconcileEnUso() {
  const nuevo = { posiciones: {}, racks: {} };

  const s = loadJSON(LS_KEYS.SALIDAS, {1:[],2:[],3:[]});
  [1,2,3].forEach(l => {
    (s[l] || []).forEach(reg => {
      if (!reg?.salida) {
        if (reg?.posicion) nuevo.posiciones[reg.posicion] = true;
        if (reg?.rack)     nuevo.racks[reg.rack] = true;
      }
    });
  });

  const r = loadJSON(LS_KEYS.RETIRAR, {1:[],2:[],3:[]});
  [1,2,3].forEach(l => {
    (r[l] || []).forEach(item => {
      if (item?.posicion) nuevo.posiciones[item.posicion] = true;
      if (item?.rack)     nuevo.racks[item.rack] = true;
    });
  });

  enUso.posiciones = nuevo.posiciones;
  enUso.racks = nuevo.racks;
  safeSave(LS_KEYS.EN_USO, enUso);
}
reconcileEnUso();

// ====== DOM ======
const form                  = document.getElementById("formRegistro");
const inputOperador         = document.getElementById("operador");
const inputCodigoSeco       = document.getElementById("codigoSeco");
const inputFirmando         = document.getElementById("firmandoAcum");
const inputCantidad         = document.getElementById("cantidad");
const inputNumRack          = document.getElementById("numRack");
const inputPosRack          = document.getElementById("posRack");

const tablaRetirar1         = document.querySelector("#tablaRetirar1 tbody");
const tablaRetirar2         = document.querySelector("#tablaRetirar2 tbody");
const tablaRetirar3         = document.querySelector("#tablaRetirar3 tbody");

const tablaSalidas1         = document.querySelector("#tablaSalidas1 tbody");
const tablaSalidas2         = document.querySelector("#tablaSalidas2 tbody");
const tablaSalidas3         = document.querySelector("#tablaSalidas3 tbody");

const tablaPosiciones       = document.querySelector("#tablaPosiciones tbody");
const tablaRacks            = document.querySelector("#tablaRacks tbody");

const modalEntrada          = document.getElementById("modalEntrada");
const modalSalida           = document.getElementById("modalSalida");
const modalInfo             = document.getElementById("modalInfo");
const infoDetalle           = document.getElementById("infoDetalle");

const entradaResumen        = document.getElementById("entradaResumen");
const salidaResumen         = document.getElementById("salidaResumen");
const formEntrada           = document.getElementById("formEntrada");
const formSalida            = document.getElementById("formSalida");
const inputPatineroEntrada  = document.getElementById("patineroEntrada");
const inputValidacionPatinero = document.getElementById("validacionPatinero");

// Confirmación de línea y escaneo en modal de entrada
const confirmLineaContainer = document.getElementById("confirmLineaBtns");
const inputConfirmLineaValue= document.getElementById("confirmLineaValue");
const inputConfirmRack      = document.getElementById("confirmRack");
const btnScanRack           = document.getElementById("btnScanRack");

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

const RX_PATTERN  = /^Rack\d{3}$/;
const POS_PATTERN = /^P\d{3}$/;

function autoformatRack(value) {
  const v = (value || "").trim();
  if (RX_PATTERN.test(v)) return v;
  if (/^\d{1,3}$/.test(v)) return `Rack${pad3(parseInt(v,10))}`;
  const m = /^Rack(\d{1,3})$/.exec(v);
  if (m) return `Rack${pad3(parseInt(m[1],10))}`;
  return v;
}
function autoformatPos(value) {
  const v = (value || "").trim();
  if (POS_PATTERN.test(v)) return v;
  if (/^\d{1,3}$/.test(v)) return `P${pad3(parseInt(v,10))}`;
  const m = /^P(\d{1,3})$/.exec(v);
  if (m) return `P${pad3(parseInt(m[1],10))}`;
  return v;
}

// ====== Lector de CÓDIGOS DE BARRAS (Quagga) ======
const SECURE_ORIGIN = location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname);
let barModal = null, barRegion = null, barInputTarget = null, barUploadBtn = null, barHiddenFile = null;

function ensureBarDomRefs() {
  if (!barModal)  barModal  = document.getElementById("modalBAR");
  if (!barRegion) barRegion = document.getElementById("barRegion");
  if (!barUploadBtn) barUploadBtn = document.getElementById("btnBarUpload");

  // input file oculto para fallback (decodeSingle)
  if (!barHiddenFile) {
    barHiddenFile = document.createElement("input");
    barHiddenFile.type = "file";
    barHiddenFile.accept = "image/*";
    barHiddenFile.capture = "environment";
    barHiddenFile.style.display = "none";
    barRegion?.parentElement?.appendChild(barHiddenFile);
    barHiddenFile.addEventListener("change", async (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataURL(file);
        await decodeBarcodeFromImage(dataUrl); // si decodifica, cierra modal
      } catch (e) {
        console.error(e);
        alert("No se pudo leer el código de la imagen.");
      } finally {
        barHiddenFile.value = "";
      }
    });
  }
  barUploadBtn?.addEventListener("click", () => barHiddenFile?.click(), { once: false });
}
function readFileAsDataURL(file){
  return new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

function isQuaggaLoaded() {
  return typeof window.Quagga === "object" && typeof window.Quagga.init === "function";
}

async function openBarcodeScanner(targetInput, mode='text') {
  ensureBarDomRefs();
  if (!SECURE_ORIGIN) {
    alert("La cámara requiere HTTPS o localhost.");
    return;
  }
  if (!isQuaggaLoaded()) {
    alert("No se cargó la librería de códigos de barras (Quagga). Verifica el <script> del CDN.");
    return;
  }
  barInputTarget = targetInput;
  barModal.showModal();

  // limpiar región
  barRegion.innerHTML = "";

  const config = {
    inputStream: {
      type: "LiveStream",
      target: barRegion,
      constraints: {
        facingMode: "environment", // trasera
        aspectRatio: { min: 1, max: 2.5 }
      }
    },
    locator: { patchSize: "medium", halfSample: true },
    numOfWorkers: navigator.hardwareConcurrency ? Math.max(1, navigator.hardwareConcurrency - 1) : 2,
    frequency: 10,
    decoder: {
      // Lista de formatos comunes; agrega/quita según tus etiquetas
      readers: [
        "code_128_reader",
        "ean_reader",
        "ean_8_reader",
        "code_39_reader",
        "upc_reader",
        "upc_e_reader",
        "code_93_reader",
        "i2of5_reader" // interleaved 2 of 5
      ]
    },
    locate: true
  };

  try {
    await new Promise((resolve, reject) => {
      Quagga.init(config, (err) => err ? reject(err) : resolve());
    });

    let handled = false;
    Quagga.onDetected(onDetected);
    Quagga.onProcessed(onProcessed);
    Quagga.start();

    function onDetected(result) {
      if (handled) return;
      const code = result?.codeResult?.code;
      if (!code) return;

      handled = true;
      let v = (code || "").trim();
      if (mode === 'rack') v = autoformatRack(v);
      if (mode === 'pos')  v = autoformatPos(v);

      if (barInputTarget) {
        barInputTarget.value = v;
        barInputTarget.dispatchEvent(new Event("input"));
        barInputTarget.dispatchEvent(new Event("blur"));
      }
      stopBarcodeScanner();
    }

    function onProcessed(result) {
      // (opcional) dibujar cajas si quieres debug:
      // const ctx = Quagga.canvas.ctx.overlay;
      // const canvas = Quagga.canvas.dom.overlay;
      // ctx.clearRect(0, 0, canvas.width, canvas.height);
      // if (result && result.boxes) { ... }
    }
  } catch (e) {
    console.error("Error al iniciar Quagga:", e);
    alert("No se pudo iniciar la cámara. Puedes usar 'Subir imagen' como alternativa.");
  }
}

async function stopBarcodeScanner() {
  try {
    if (isQuaggaLoaded()) {
      Quagga.offDetected();
      Quagga.offProcessed();
      Quagga.stop();
    }
  } catch {}
  if (barModal?.open) barModal.close();
  barInputTarget = null;
  // limpiar región
  if (barRegion) barRegion.innerHTML = "";
}

async function decodeBarcodeFromImage(dataUrl) {
  if (!isQuaggaLoaded()) throw new Error("Quagga no cargó.");
  return new Promise((resolve, reject) => {
    Quagga.decodeSingle({
      src: dataUrl,
      numOfWorkers: 0,
      decoder: {
        readers: [
          "code_128_reader",
          "ean_reader",
          "ean_8_reader",
          "code_39_reader",
          "upc_reader",
          "upc_e_reader",
          "code_93_reader",
          "i2of5_reader"
        ]
      },
      locate: true
    }, (result) => {
      const code = result?.codeResult?.code;
      if (code) {
        // Aplica al input activo, no sabemos si era rack/pos; intenta dar formato
        let v = code.trim();
        // Si parece número de 1-3 dígitos, podríamos formatear a Rack###/P###
        if (/^\d{1,3}$/.test(v) && barInputTarget) {
          if (barInputTarget.id === "numRack" || barInputTarget.id === "confirmRack") v = autoformatRack(v);
          if (barInputTarget.id === "posRack") v = autoformatPos(v);
        }
        if (barInputTarget) {
          barInputTarget.value = v;
          barInputTarget.dispatchEvent(new Event("input"));
          barInputTarget.dispatchEvent(new Event("blur"));
        }
        stopBarcodeScanner();
        resolve(v);
      } else {
        reject(new Error("No se detectó código en la imagen."));
      }
    });
  });
}

// Cancelar modal
document.getElementById("btnBarCancel")?.addEventListener("click", () => { stopBarcodeScanner(); });

// ====== Helper visual para tabla (OK / Dañado / —) ======
function damageCellHTML(val) {
  if (val === true)  return `<td class="busy">Dañado</td>`;
  if (val === false) return `<td class="ok">OK</td>`;
  return `<td>—</td>`;
}

// ====== Último formulario por línea ======
function loadLastByLine() { return loadJSON(LS_KEYS.FORM_LAST_BY_LINE, {1:null,2:null,3:null,4:null}); }
function saveLastByLine(map) { safeSave(LS_KEYS.FORM_LAST_BY_LINE, map); }
function prefillFromLast(linea) {
  const map = loadLastByLine();
  const last = map[linea] || null;
  if (!last) return;
  inputOperador.value   = last.operador || "";
  inputCodigoSeco.value = last.codigoSeco || "";
  inputFirmando.value   = last.firmando || "— Se autocompleta al validar —";
  inputCantidad.value   = last.cantidad || "";
  inputNumRack.value    = last.numRack || "";
  inputPosRack.value    = last.posRack || "";
}

// ====== Persistencia de pestañas ======
function loadTabs() { return loadJSON(TAB_KEY, { retirar:'sal1', salidas:'salout1' }); }
function saveTabs(v) { safeSave(TAB_KEY, v); }
(function restoreTabs(){
  const st = loadTabs();
  document.getElementById(st.retirar)?.setAttribute("checked", "checked");
  document.getElementById(st.salidas)?.setAttribute("checked", "checked");
})();
["sal1","sal2","sal3"].forEach(id=>{
  document.getElementById(id)?.addEventListener("change", ()=>{
    const st = loadTabs(); st.retirar = id; saveTabs(st);
  });
});
["salout1","salout2","salout3"].forEach(id=>{
  document.getElementById(id)?.addEventListener("change", ()=>{
    const st = loadTabs(); st.salidas = id; saveTabs(st);
  });
});

// ====== Listeners de formulario/inputs ======
document.querySelectorAll('input[name="linea"]').forEach(r=>{
  r.addEventListener("change", ()=>{
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
(function prefillInit(){
  const linea = getLineaSeleccionada();
  if (linea) prefillFromLast(linea);
})();
inputCodigoSeco.addEventListener("input", () => {
  inputFirmando.value = inputCodigoSeco.value ? `Acum: ${inputCodigoSeco.value.toUpperCase()}` : "— Se autocompleta al validar —";
});
inputNumRack.addEventListener("blur", () => { inputNumRack.value = autoformatRack(inputNumRack.value); });
inputPosRack.addEventListener("blur", () => { inputPosRack.value = autoformatPos(inputPosRack.value); });
[inputNumRack, inputPosRack].forEach(inp=>{
  inp.addEventListener("input", ()=>{
    const v = (inp === inputNumRack) ? autoformatRack(inp.value) : autoformatPos(inp.value);
    if (/^Rack\d{0,3}$/.test(v) || /^P\d{0,3}$/.test(v)) inp.value = v;
  });
});

// ====== Guardar Registro ======
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const linea     = getLineaSeleccionada();
  const operador  = inputOperador.value.trim();
  const codigoSeco= inputCodigoSeco.value.trim();
  const firmando  = inputFirmando.value.trim();
  const cantidad  = Number.parseInt(inputCantidad.value || "0", 10);

  let rack     = autoformatRack(inputNumRack.value);
  let posicion = autoformatPos(inputPosRack.value);
  inputNumRack.value = rack;
  inputPosRack.value = posicion;

  if (!linea || !operador || !codigoSeco || !rack || !posicion) {
    alert("Completa todos los campos del registro.");
    return;
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    alert("La cantidad debe ser un entero mayor que 0.");
    inputCantidad.focus();
    return;
  }
  if (!RX_PATTERN.test(rack))     { alert('El número de rack debe tener formato "Rack###", ej. "Rack001".'); inputNumRack.focus(); return; }
  if (!POS_PATTERN.test(posicion)){ alert('La posición debe tener formato "P###", ej. "P002".');            inputPosRack.focus(); return; }

  reconcileEnUso();
  if (enUso.posiciones[posicion]) { alert(`La posición ${posicion} ya está en uso. Elige otra.`); inputPosRack.focus(); return; }
  if (enUso.racks[rack])          { alert(`El rack ${rack} ya está en uso. Elige otro.`);         inputNumRack.focus(); return; }

  const map = loadLastByLine();
  map[linea] = { linea, operador, codigoSeco, firmando, cantidad, numRack: "", posRack: "" };
  saveLastByLine(map);

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

  enUso.posiciones[posicion] = true;
  enUso.racks[rack] = true;
  safeSave(LS_KEYS.EN_USO, enUso);

  (retirarListas[linea] = retirarListas[linea] || []).push({
    posicion, rack, linea, refId: nuevo.id,
    operador: nuevo.operador, empleado: nuevo.registradoPorId,
    codigoSeco, cantidad, creadoEn: nuevo.creadoEn, registradoPorNombre: nuevo.registradoPorNombre
  });
  safeSave(LS_KEYS.RETIRAR, retirarListas);

  inputNumRack.value = "";
  inputPosRack.value = "";

  try { renderAll(); } catch(e) { console.error("Error en renderAll()", e); }
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
    entrada: null,
    salida: null,
    entradaGuardadaEn: null
  };

  const yaExiste = (salidasListas[linea] || []).some(r => r.rack === item.rack && r.posicion === item.posicion && !r.salida);
  if (!yaExiste) {
    (salidasListas[linea] = salidasListas[linea] || []).push(registro);
    safeSave(LS_KEYS.SALIDAS, salidasListas);
  }

  const arr = retirarListas[linea] || [];
  const idx = arr.findIndex(x => x.posicion === item.posicion && x.rack === item.rack);
  if (idx >= 0) { arr.splice(idx,1); retirarListas[linea] = arr; safeSave(LS_KEYS.RETIRAR, retirarListas); }

  try { renderAll(); } catch(e) { console.error("Error en renderAll()", e); }
}

// ====== Entrada / Salida ======
function attachRowInfoHandlers(tbody, lista){
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

function openEntradaModal(reg) {
  currentSalida = reg;
  entradaLineaConfirmada = false;
  inputConfirmLineaValue.value = "";
  confirmLineaContainer?.querySelectorAll("button[data-linea]")
    .forEach(b => b.classList.remove("active"));

  entradaResumen.textContent = `Línea ${reg.linea} | Posición ${reg.posicion} | Rack ${reg.rack}`;
  inputPatineroEntrada.value = CURRENT_USER?.name || "";
  inputConfirmRack.value = "";
  modalEntrada.showModal();
  setTimeout(()=> inputPatineroEntrada?.focus(), 50);
}

confirmLineaContainer?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-linea]");
  if (!btn) return;
  const lineaSel = parseInt(btn.dataset.linea, 10);
  if (!Number.isInteger(lineaSel)) return;

  inputConfirmLineaValue.value = String(lineaSel);
  entradaLineaConfirmada = true;

  confirmLineaContainer.querySelectorAll("button[data-linea]")
    .forEach(b => b.classList.toggle("active", b === btn));
});

// Escanear para confirmar Rack en ENTRADA
btnScanRack?.addEventListener("click", () => openBarcodeScanner(inputConfirmRack, 'rack'));

formEntrada.addEventListener("click", (e) => {
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;

  if (btn.value === "save" && currentSalida) {
    const byName = inputPatineroEntrada.value.trim() || CURRENT_USER?.name || "";
    const byId   = CURRENT_USER?.id || null;

    const lineaSeleccionada = parseInt(inputConfirmLineaValue.value, 10);
    if (!entradaLineaConfirmada || lineaSeleccionada !== currentSalida.linea) {
      alert(`Debes seleccionar la línea correcta (Línea ${currentSalida.linea}).`);
      return;
    }

    let confirmRack = autoformatRack(inputConfirmRack.value.trim());
    if (!confirmRack) { alert("Debes confirmar el Rack (ej. Rack001)."); inputConfirmRack.focus(); return; }
    inputConfirmRack.value = confirmRack;
    if (confirmRack !== currentSalida.rack) { alert(`El Rack confirmado (${confirmRack}) no coincide con el asignado (${currentSalida.rack}).`); inputConfirmRack.focus(); return; }

    currentSalida.entrada = { byId, byName, confirmLinea: currentSalida.linea, confirmRack, at: nowISO() };
    currentSalida.entradaGuardadaEn = Date.now();
    safeSave(LS_KEYS.SALIDAS, salidasListas);

    modalEntrada.close();
    try { renderAll(); } catch(e2){ console.error("renderAll() tras entrada", e2); }
  }

  if (btn.value === "cancel") modalEntrada.close();
});

function canShowDarSalida(reg) {
  if (!reg.entradaGuardadaEn) return false;
  return (Date.now() - reg.entradaGuardadaEn) >= 60 * 1000;
}
function secondsToEnable(reg) {
  if (!reg.entradaGuardadaEn) return 60;
  const diff = 60 - Math.floor((Date.now() - reg.entradaGuardadaEn)/1000);
  return Math.max(0, diff);
}

function openSalidaModal(reg) {
  currentSalida = reg;
  salidaResumen.textContent = `Línea ${reg.linea} | Posición ${reg.posicion} | Rack ${reg.rack}`;
  inputValidacionPatinero.value = CURRENT_USER?.name || "";
  modalSalida.showModal();
  setTimeout(()=> inputValidacionPatinero?.focus(), 50);
}

formSalida.addEventListener("click", (e) => {
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;

  if (btn.value === "save" && currentSalida) {
    const byName = inputValidacionPatinero.value.trim() || CURRENT_USER?.name || "";
    const byId   = CURRENT_USER?.id || null;
    if (!byName) return;

    currentSalida.salida = { byId, byName, at: nowISO() };

    delete enUso.posiciones[currentSalida.posicion];
    delete enUso.racks[currentSalida.rack];
    safeSave(LS_KEYS.EN_USO, enUso);

    const lista = salidasListas[currentSalida.linea] || [];
    const idx   = lista.findIndex(x => x.id === currentSalida.id);
    if (idx >= 0) { lista.splice(idx,1); salidasListas[currentSalida.linea] = lista; }
    safeSave(LS_KEYS.SALIDAS, salidasListas);

    modalSalida.close();
    try { renderAll(); } catch(e2){ console.error("renderAll() tras salida", e2); }
  }

  if (btn.value === "cancel") modalSalida.close();
});

// ====== Render ======
function renderRetirar() {
  if (!tablaRetirar1 || !tablaRetirar2 || !tablaRetirar3) return;
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
  fill(tablaRetirar1, retirarListas[1]||[], 1);
  fill(tablaRetirar2, retirarListas[2]||[], 2);
  fill(tablaRetirar3, retirarListas[3]||[], 3);
}

function renderSalidas() {
  if (!tablaSalidas1 || !tablaSalidas2 || !tablaSalidas3) return;
  function fill(tbody, lista) {
    tbody.innerHTML = "";
    const activo   = (lista || []).find(r => r.entrada && !r.salida);
    const activoId = activo?.id || null;

    if (!lista || !lista.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; opacity:.7">Sin elementos</td></tr>`;
      return;
    }

    lista.forEach(reg => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${reg.posicion}</td><td>${reg.rack}</td><td></td><td></td>`;

      if (activoId && reg.id !== activoId) {
        // Otro activo en esta línea: sin botones
      } else {
        if (!reg.entrada) {
          if (!activoId) {
            const btnEntrada = document.createElement("button");
            btnEntrada.type = "button";
            btnEntrada.textContent = "Dar entrada";
            btnEntrada.className = "primary";
            btnEntrada.addEventListener("click", () => openEntradaModal(reg));
            tr.children[2].appendChild(btnEntrada);
          }
        } else {
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
  fill(tablaSalidas1, salidasListas[1]||[]);
  fill(tablaSalidas2, salidasListas[2]||[]);
  fill(tablaSalidas3, salidasListas[3]||[]);
}

function renderPosiciones() {
  if (!tablaPosiciones) return;
  tablaPosiciones.innerHTML = "";
  for (let i = 1; i <= 450; i++) {
    const p = `P${pad3(i)}`;
    const libre = !enUso.posiciones[p];

    const det = statusPosDet[p] || {};
    const tdActuador = damageCellHTML(det.actuador);
    const tdTarjeta  = damageCellHTML(det.tarjeta);
    const tdAbraz    = damageCellHTML(det.abrazaderas);
    const tdCable    = damageCellHTML(det.cable_bajada);

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
  if (!tablaRacks) return;
  tablaRacks.innerHTML = "";
  for (let i = 1; i <= 435; i++) {
    const r = `Rack${pad3(i)}`;
    const libre = !enUso.racks[r];

    const det = statusRacksDet[r] || {};
    const tdSoporte = damageCellHTML(det.soporte_dren);
    const tdPorta   = damageCellHTML(det.porta_manguera);
    const tdTina    = damageCellHTML(det.tina);

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

function updateCountersUI(){
  const hRet = document.querySelector('#retirar .panel-header h2');
  const hSal = document.querySelector('#salidas .panel-header h2');

  const r1=(retirarListas[1]||[]).length, r2=(retirarListas[2]||[]).length, r3=(retirarListas[3]||[]).length;
  const s1=(salidasListas[1]||[]).length, s2=(salidasListas[2]||[]).length, s3=(salidasListas[3]||[]).length;

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
try { renderAll(); }
catch (e) { console.error("Error en renderAll()", e); alert("Ocurrió un error al dibujar las tablas. Revisa la consola."); }

setInterval(() => {
  try { renderSalidas(); }
  catch (e) { console.error("Error en renderSalidas()", e); }
}, 1000);

window.addEventListener("hashchange", () => {
  const id = location.hash.replace("#","");
  if (id === "racks" || id === "posiciones" || id === "salidas" || id === "retirar") {
    try { renderAll(); } catch(e){ console.error("renderAll() on hashchange", e); }
  }
});

// ====== Botones de escaneo (form principal) ======
document.getElementById("btnScanSeco")   ?.addEventListener("click", () => openBarcodeScanner(document.getElementById("codigoSeco"), 'text'));
document.getElementById("btnScanNumRack")?.addEventListener("click", () => openBarcodeScanner(document.getElementById("numRack"), 'rack'));
document.getElementById("btnScanPosRack")?.addEventListener("click", () => openBarcodeScanner(document.getElementById("posRack"), 'pos'));
