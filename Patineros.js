// ================================
// Patineros.js (completo con lector de CÓDIGOS DE BARRAS - Quagga)
// Scanner fullscreen + validación estricta Rack### / P###
// ================================

// ====== Claves de almacenamiento ======
const LS_KEYS = {
  FORM_LAST_BY_LINE: "patineros_form_last_by_line",
  CONTROLISTAS: "controlistas_pendientes",
  EN_USO: "en_uso",              // { posiciones:{}, racks:{} }
  RETIRAR: "retirar_listas",     // { 1:[...], 2:[...], 3:[...] } -> vista Patineros
  SALIDAS: "salidas_listas",     // { 1:[...], 2:[...], 3:[...] } -> vista Patineros
  STATUS_POS_DET: "status_posiciones_detalle",
  STATUS_RACKS_DET: "status_racks_detalle",
  // NUEVO: cola de "Retirar" para Controlistas (lo que Patinero manda al dar SALIDA)
  CONTROLISTAS_RETIRAR: "controlistas_retirar"
  RETIRAR_HIST: "retirar_historial_all"
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

/* ================================
   Lector de CÓDIGOS DE BARRAS (Quagga)
   - Fullscreen
   - Validación estricta Rack### / P###
=================================== */
const SECURE_ORIGIN = location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname);
let barModal = null, barRegion = null, barInputTarget = null, barUploadBtn = null, barHiddenFile = null;
let currentScanMode = 'text';

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
        await decodeBarcodeFromImage(dataUrl, currentScanMode);
      } catch (e) {
        console.error(e);
        alert("No se pudo leer el código de la imagen.");
        flashInvalid();
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

/* Validación estricta para lecturas */
function isValidByMode(mode, value){
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (mode === 'rack') return /^Rack\d{3}$/.test(v);
  if (mode === 'pos')  return /^P\d{3}$/.test(v);
  return v.length > 0; // 'text' acepta cualquier cosa no vacía
}

function flashInvalid(){
  barRegion?.classList.add("invalid-flash");
  setTimeout(()=>barRegion?.classList.remove("invalid-flash"), 250);
}

async function openBarcodeScanner(targetInput, mode='text') {
  ensureBarDomRefs();
  if (!SECURE_ORIGIN) { alert("La cámara requiere HTTPS o localhost."); return; }
  if (!isQuaggaLoaded()) { alert("No se cargó la librería de códigos de barras (Quagga). Verifica el <script> del CDN."); return; }

  barInputTarget = targetInput;
  currentScanMode = mode;

  // Abrir modal a pantalla completa
  barModal.showModal();
  barRegion.innerHTML = "";

  const config = {
    inputStream: {
      type: "LiveStream",
      target: barRegion,
      constraints: {
        facingMode: "environment",
        width: { ideal: 1920 },
        height:{ ideal: 1080 },
        aspectRatio: { min: 1, max: 2.5 }
      }
    },
    locator: { patchSize: "medium", halfSample: true },
    numOfWorkers: navigator.hardwareConcurrency ? Math.max(1, navigator.hardwareConcurrency - 1) : 2,
    frequency: 10,
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
      const raw = result?.codeResult?.code?.trim();
      if (!raw) return;

      // Validación estricta
      if (!isValidByMode(currentScanMode, raw)) {
        flashInvalid();
        if (currentScanMode === 'rack') alert('Formato inválido.\nSe requiere exactamente: Rack### (ej. Rack001).');
        else if (currentScanMode === 'pos') alert('Formato inválido.\nSe requiere exactamente: P### (ej. P002).');
        return; // sigue escaneando
      }

      handled = true;
      if (barInputTarget) {
        barInputTarget.value = raw;
        barInputTarget.dispatchEvent(new Event("input"));
        barInputTarget.dispatchEvent(new Event("blur"));
      }
      stopBarcodeScanner();
    }

    function onProcessed(_result) {
      // opcional: dibujar cajas de depuración
    }
  } catch (e) {
    console.error("Error al iniciar Quagga:", e);
    alert("No se pudo iniciar la cámara. Usa 'Subir imagen' como alternativa.");
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
  currentScanMode = 'text';
  if (barRegion) barRegion.innerHTML = "";
}

async function decodeBarcodeFromImage(dataUrl, mode='text') {
  if (!isQuaggaLoaded()) throw new Error("Quagga no cargó.");
  return new Promise((resolve, reject) => {
    Quagga.decodeSingle({
      src: dataUrl,
      numOfWorkers: 0,
      decoder: {
        readers: [
          "code_128_reader","ean_reader","ean_8_reader",
          "code_39_reader","upc_reader","upc_e_reader",
          "code_93_reader","i2of5_reader"
        ]
      },
      locate: true
    }, (result) => {
      const raw = result?.codeResult?.code?.trim();
      if (!raw) return reject(new Error("No se detectó código en la imagen."));

      if (!isValidByMode(mode, raw)) {
        flashInvalid();
        if (mode === 'rack') alert('Formato inválido en imagen.\nSe requiere exactamente: Rack### (ej. Rack001).');
        else if (mode === 'pos') alert('Formato inválido en imagen.\nSe requiere exactamente: P### (ej. P002).');
        return reject(new Error("Formato inválido"));
      }

      if (barInputTarget) {
        barInputTarget.value = raw;
        barInputTarget.dispatchEvent(new Event("input"));
        barInputTarget.dispatchEvent(new Event("blur"));
      }
      stopBarcodeScanner();
      resolve(raw);
    });
  });
}

// Cancelar modal (botón)
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

    let confirmRack = inputConfirmRack.value.trim();
    if (!RX_PATTERN.test(confirmRack)) { alert('Formato inválido. Se requiere: Rack### (ej. Rack001).'); inputConfirmRack.focus(); return; }
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

    // 1) Marcar salida en el registro actual (conservar toda la traza)
    currentSalida.salida = { byId, byName, at: nowISO() };

    // 2) Liberar recursos en uso (posición y rack)
    delete enUso.posiciones[currentSalida.posicion];
    delete enUso.racks[currentSalida.rack];
    safeSave(LS_KEYS.EN_USO, enUso);

    // 3) MOVER el registro COMPLETO a la cola de "RETIRAR" para CONTROLISTAS
    //    (se conserva entrada/salida y metadatos)
    const ctlRet = loadJSON(LS_KEYS.CONTROLISTAS_RETIRAR, []);
    // Clon profundo para no compartir referencias
    const clonado = JSON.parse(JSON.stringify(currentSalida));
    clonado.movedToControlistasAt = nowISO();
    ctlRet.push(clonado);
    safeSave(LS_KEYS.CONTROLISTAS_RETIRAR, ctlRet);

    // 4) Quitar de la lista de SALIDAS (solo de la vista del patinero)
    const lista = salidasListas[currentSalida.linea] || [];
    const idx   = lista.findIndex(x => x.id === currentSalida.id);
    if (idx >= 0) { lista.splice(idx,1); salidasListas[currentSalida.linea] = lista; }
    safeSave(LS_KEYS.SALIDAS, salidasListas);

    modalSalida.close();
    try { renderAll(); } catch(e2){ console.error("renderAll() tras salida", e2); }
    alert("Salida registrada. El controlista verá este registro en su apartado de 'Retirar'.");
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

