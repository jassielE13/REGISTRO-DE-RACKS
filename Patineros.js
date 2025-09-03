// ====== Helpers de almacenamiento ======
const LS_KEYS = {
  FORM_LAST_BY_LINE: "patineros_form_last_by_line", // último formulario por línea
  CONTROLISTAS: "controlistas_pendientes",
  EN_USO: "en_uso",            // {posiciones:{}, racks:{}}
  RETIRAR: "retirar_listas",   // {1:[{...}],2:[...],3:[...]}
  SALIDAS: "salidas_listas",   // {1:[{...}],2:[...],3:[...]}
  // Solo vista (los llena Controlistas)
  STATUS_POS_DET: "status_posiciones_detalle", // { "P001": {actuador:true/false, tarjeta:true/false, abrazaderas:true/false, cable_bajada:true/false}, ... }
  STATUS_RACKS_DET: "status_racks_detalle",     // { "Rack001": {soporte_dren:true/false, porta_manguera:true/false, tina:true/false}, ... }
  // 👇 NUEVO: histórico permanente que ve Controlistas en su pestaña “Retirar”
  RETIRAR_HIST: "retirar_historial_all"
};

function loadJSON(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

// ====== Usuario actual (del Login) ======
const CURRENT_USER = loadJSON("CURRENT_USER", null);

// ====== Estado ======
const enUso = loadJSON(LS_KEYS.EN_USO, { posiciones:{}, racks:{} });
const retirarListas = loadJSON(LS_KEYS.RETIRAR, {1:[],2:[],3:[]});
const salidasListas = loadJSON(LS_KEYS.SALIDAS, {1:[],2:[],3:[]});

// Mapas de solo lectura (los llena Controlistas)
const statusPosDet = loadJSON(LS_KEYS.STATUS_POS_DET, {});     // p.ej: { "P001": { actuador:true, tarjeta:false, ... } }
const statusRacksDet = loadJSON(LS_KEYS.STATUS_RACKS_DET, {}); // p.ej: { "Rack001": { soporte_dren:true, ... } }

// ====== Formatos y utilidades ======
function getLineaSeleccionada() { const r = document.querySelector('input[name="linea"]:checked'); return r ? parseInt(r.value,10) : null; }
function setLineaSeleccionada(v) { const r = document.getElementById(`l${v}`); if (r) r.checked = true; }
function nowISO() { return new Date().toISOString(); }
function fmtDateTime(iso){ const d = new Date(iso); return d.toLocaleString(); }
function pad3(n){ return String(n).padStart(3,"0"); }

const RX_RACK = /^Rack\d{3}$/;
const RX_POS  = /^P\d{3}$/;

function autoformatRack(value) {
  const v = (value || "").trim();
  if (RX_RACK.test(v)) return v;
  if (/^\d{1,3}$/.test(v)) return `Rack${pad3(parseInt(v,10))}`;
  const m = /^Rack(\d{1,3})$/.exec(v);
  if (m) return `Rack${pad3(parseInt(m[1],10))}`;
  return v;
}
function autoformatPos(value) {
  const v = (value || "").trim();
  if (RX_POS.test(v)) return v;
  if (/^\d{1,3}$/.test(v)) return `P${pad3(parseInt(v,10))}`;
  const m = /^P(\d{1,3})$/.exec(v);
  if (m) return `P${pad3(parseInt(m[1],10))}`;
  return v;
}

// ====== Reconciliación de estados (repara ocupaciones previas) ======
function reconcileEnUso() {
  const nuevo = { posiciones: {}, racks: {} };

  // Los que están en SALIDAS sin salida aún ocupan recursos
  const s = loadJSON(LS_KEYS.SALIDAS, {1:[],2:[],3:[]});
  [1,2,3].forEach(l => {
    (s[l] || []).forEach(reg => {
      if (!reg?.salida) {
        if (reg?.posicion) nuevo.posiciones[reg.posicion] = true;
        if (reg?.rack) nuevo.racks[reg.rack] = true;
      }
    });
  });

  // Lo que esté en RETIRAR también ocupa
  const r = loadJSON(LS_KEYS.RETIRAR, {1:[],2:[],3:[]});
  [1,2,3].forEach(l => {
    (r[l] || []).forEach(item => {
      if (item?.posicion) nuevo.posiciones[item.posicion] = true;
      if (item?.rack) nuevo.racks[item.rack] = true;
    });
  });

  enUso.posiciones = nuevo.posiciones;
  enUso.racks = nuevo.racks;
  saveJSON(LS_KEYS.EN_USO, enUso);
}
// Ejecutar reparación al cargar
reconcileEnUso();

// ====== DOM ======
const form = document.getElementById("formRegistro");
const inputOperador = document.getElementById("operador");
const inputCodigoSeco = document.getElementById("codigoSeco");
const inputFirmando = document.getElementById("firmandoAcum");
const inputCantidad = document.getElementById("cantidad");
const inputNumRack = document.getElementById("numRack");
const inputPosRack = document.getElementById("posRack");

// Botones de escaneo junto a inputs (toman el primer botón dentro de .with-actions)
const btnScanSeco = inputCodigoSeco?.closest(".with-actions")?.querySelector("button");
const btnScanNumRack = inputNumRack?.closest(".with-actions")?.querySelector("button");
const btnScanPosRack = inputPosRack?.closest(".with-actions")?.querySelector("button");

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

// Confirmación de línea (delegación) y escáner rack
const confirmLineaContainer = document.getElementById("confirmLineaBtns");
const inputConfirmLineaValue = document.getElementById("confirmLineaValue");
const inputConfirmRack = document.getElementById("confirmRack");
const btnScanRackConfirm = document.getElementById("btnScanRack");

// Estado interno para entrada
let currentSalida = null;
let entradaLineaConfirmada = false;

// ====== Utils vista ======
function damageCellHTML(val) {
  if (val === true) return `<td class="busy">Dañado</td>`;
  if (val === false) return `<td class="ok">OK</td>`;
  return `<td>—</td>`;
}

// ====== “Último formulario” por línea ======
function loadLastByLine(){
  return loadJSON(LS_KEYS.FORM_LAST_BY_LINE, {1:null,2:null,3:null,4:null});
}
function saveLastByLine(map){
  saveJSON(LS_KEYS.FORM_LAST_BY_LINE, map);
}
function prefillFromLast(linea){
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

// Cuando cambie la línea, precargar su último formulario
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

// ====== Prefill inicial ======
(function prefillInit(){
  const linea = getLineaSeleccionada();
  if (linea) prefillFromLast(linea);
})();

// Autocompletar “Firmando el acumulador”
inputCodigoSeco.addEventListener("input", () => {
  inputFirmando.value = inputCodigoSeco.value ? `Acum: ${inputCodigoSeco.value.toUpperCase()}` : "— Se autocompleta al validar —";
});
inputNumRack.addEventListener("blur", () => { inputNumRack.value = autoformatRack(inputNumRack.value); });
inputPosRack.addEventListener("blur", () => { inputPosRack.value = autoformatPos(inputPosRack.value); });

// ====== Guardar Registro ======
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const linea = getLineaSeleccionada();
  const operador = inputOperador.value.trim();
  const codigoSeco = inputCodigoSeco.value.trim();
  const firmando = inputFirmando.value.trim();
  const cantidad = parseInt(inputCantidad.value || "0",10);

  // Normaliza formatos clave ANTES de validar/consultar enUso
  let rack = autoformatRack(inputNumRack.value);
  let posicion = autoformatPos(inputPosRack.value);
  inputNumRack.value = rack;
  inputPosRack.value = posicion;

  // Validaciones básicas
  if (!linea || !operador || !codigoSeco || !cantidad || !rack || !posicion) {
    alert("Completa todos los campos del registro.");
    return;
  }
  if (!RX_RACK.test(rack)) { alert('El número de rack debe tener formato "Rack###", ej. "Rack001".'); inputNumRack.focus(); return; }
  if (!RX_POS.test(posicion)) { alert('La posición debe tener formato "P###", ej. "P002".'); inputPosRack.focus(); return; }

  // ⚠️ Validación de OCUPACIÓN (bloquea si ya están en uso)
  reconcileEnUso(); // sincroniza por si quedó mal en sesiones previas
  if (enUso.posiciones[posicion]) {
    alert(`La posición ${posicion} ya está en uso. Elige otra.`);
    inputPosRack.focus();
    return;
  }
  if (enUso.racks[rack]) {
    alert(`El rack ${rack} ya está en uso. Elige otro.`);
    inputNumRack.focus();
    return;
  }

  // 1) Persistir "último formulario" por línea, dejando rack/posición en blanco para el siguiente
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
  saveJSON(LS_KEYS.CONTROLISTAS, controlistasPend);

  // 3) Marcar EN USO de inmediato
  enUso.posiciones[posicion] = true;
  enUso.racks[rack] = true;
  saveJSON(LS_KEYS.EN_USO, enUso);

  // 4) Añadir a RETIRAR
  (retirarListas[linea] = retirarListas[linea] || []).push({
    posicion, rack, linea, refId: nuevo.id,
    operador: nuevo.operador, empleado: nuevo.registradoPorId,
    codigoSeco, cantidad, creadoEn: nuevo.creadoEn, registradoPorNombre: nuevo.registradoPorNombre
  });
  saveJSON(LS_KEYS.RETIRAR, retirarListas);

  // 5) Dejar SOLO rack y posición en blanco en la UI actual
  inputNumRack.value = "";
  inputPosRack.value = "";

  renderAll();
  alert("Registro guardado y enviado a Controlistas.");
});

// ====== Retirar -> mover a Salidas ======
function handleRetirar(item, linea) {
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
    entrada: null,   // {byId, byName, confirmLinea, confirmRack, at}
    salida: null,    // {byId, byName, at}
    entradaGuardadaEn: null
  };

  // Evita duplicados por misma clave (rack+pos) en la línea
  const yaExiste = (salidasListas[linea] || []).some(r => r.rack === item.rack && r.posicion === item.posicion && !r.salida);
  if (!yaExiste) {
    (salidasListas[linea] = salidasListas[linea] || []).push(registro);
    saveJSON(LS_KEYS.SALIDAS, salidasListas);
  }

  // quitar de retirar
  const arr = retirarListas[linea] || [];
  const idx = arr.findIndex(x => x.posicion === item.posicion && x.rack === item.rack);
  if (idx >= 0) { arr.splice(idx,1); retirarListas[linea] = arr; saveJSON(LS_KEYS.RETIRAR, retirarListas); }

  renderAll();
}

// ====== Entrada / Salida ======

// Abrir detalle al hacer click en fila (sin activar si se hizo click en botón)
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

// Abrir modal de ENTRADA
function openEntradaModal(reg) {
  currentSalida = reg;

  // Reset de confirmación de línea
  entradaLineaConfirmada = false;
  inputConfirmLineaValue.value = "";
  confirmLineaContainer
    ?.querySelectorAll("button[data-linea]")
    .forEach(b => b.classList.remove("active"));

  // Resumen
  entradaResumen.textContent = `Línea ${reg.linea} | Posición ${reg.posicion} | Rack ${reg.rack}`;

  // Sugerir nombre (editable)
  inputPatineroEntrada.value = CURRENT_USER?.name || "";

  // Limpiar confirmación de rack
  inputConfirmRack.value = "";

  modalEntrada.showModal();
}

// Delegación: botones "Línea 1/2/3/4"
confirmLineaContainer?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-linea]");
  if (!btn) return;
  const lineaSel = parseInt(btn.dataset.linea, 10);
  if (!Number.isInteger(lineaSel)) return;

  inputConfirmLineaValue.value = String(lineaSel);
  entradaLineaConfirmada = true;

  // Marcar botón activo
  confirmLineaContainer.querySelectorAll("button[data-linea]")
    .forEach(b => b.classList.toggle("active", b === btn));
});

// Guardar ENTRADA
formEntrada.addEventListener("click", (e) => {
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;

  if (btn.value === "save" && currentSalida) {
    const byName = inputPatineroEntrada.value.trim() || CURRENT_USER?.name || "";
    const byId = CURRENT_USER?.id || null;

    // 1) Línea confirmada por botones y que coincida con la del registro
    const lineaSeleccionada = parseInt(inputConfirmLineaValue.value, 10);
    if (!entradaLineaConfirmada || lineaSeleccionada !== currentSalida.linea) {
      alert(`Debes seleccionar la línea correcta (Línea ${currentSalida.linea}).`);
      return;
    }

    // 2) Confirmación de Rack obligatoria y coincidente
    let confirmRack = autoformatRack(inputConfirmRack.value.trim());
    if (!confirmRack) {
      alert("Debes confirmar el Rack (ej. Rack001).");
      inputConfirmRack.focus();
      return;
    }
    inputConfirmRack.value = confirmRack; // normaliza en UI
    if (confirmRack !== currentSalida.rack) {
      alert(`El Rack confirmado (${confirmRack}) no coincide con el asignado (${currentSalida.rack}).`);
      inputConfirmRack.focus();
      return;
    }

    // Guardar entrada
    currentSalida.entrada = {
      byId,
      byName,
      confirmLinea: currentSalida.linea,
      confirmRack,
      at: nowISO()
    };
    currentSalida.entradaGuardadaEn = Date.now();
    saveJSON(LS_KEYS.SALIDAS, salidasListas);

    modalEntrada.close();
    renderAll();
  }

  if (btn.value === "cancel") modalEntrada.close();
});

// Habilitar "Dar salida" tras 1 minuto
function canShowDarSalida(reg) {
  if (!reg.entradaGuardadaEn) return false;
  return (Date.now() - reg.entradaGuardadaEn) >= 60 * 1000; // 1 min
}

// Abrir modal de SALIDA
function openSalidaModal(reg) {
  currentSalida = reg;
  salidaResumen.textContent = `Línea ${reg.linea} | Posición ${reg.posicion} | Rack ${reg.rack}`;
  inputValidacionPatinero.value = CURRENT_USER?.name || "";
  modalSalida.showModal();
}

// Guardar SALIDA (no elimina; libera en_uso; copia a histórico de Controlistas)
formSalida.addEventListener("click", (e) => {
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;

  if (btn.value === "save" && currentSalida) {
    const byName = inputValidacionPatinero.value.trim() || CURRENT_USER?.name || "";
    const byId = CURRENT_USER?.id || null;
    if (!byName) return;

    // 1) Guardar salida (mantener registro en la lista para que quede visible)
    currentSalida.salida = { byId, byName, at: nowISO() };
    saveJSON(LS_KEYS.SALIDAS, salidasListas);

    // 2) Liberar enUso
    delete enUso.posiciones[currentSalida.posicion];
    delete enUso.racks[currentSalida.rack];
    saveJSON(LS_KEYS.EN_USO, enUso);

    // 3) Enviar al HISTÓRICO que ve Controlistas (Retirar)
    const hist = loadJSON(LS_KEYS.RETIRAR_HIST, []);
    const payload = {
      id: currentSalida.id,
      refId: currentSalida.refId || null,
      linea: currentSalida.linea,
      posicion: currentSalida.posicion,
      rack: currentSalida.rack,
      operador: currentSalida.operador ?? null,
      empleado: currentSalida.empleado ?? null,
      codigoSeco: currentSalida.codigoSeco ?? null,
      cantidad: currentSalida.cantidad ?? null,
      creadoEn: currentSalida.creadoEn,
      registradoPorNombre: currentSalida.registradoPorNombre ?? null,
      entrada: currentSalida.entrada ? {
        byId: currentSalida.entrada.byId ?? null,
        byName: currentSalida.entrada.byName ?? null,
        at: currentSalida.entrada.at
      } : null,
      salida: {
        byId, byName, at: currentSalida.salida.at
      },
      confirmadoPorId: byId,
      confirmadoPorNombre: byName,
      confirmadoEn: currentSalida.salida.at
    };
    hist.push(payload);
    saveJSON(LS_KEYS.RETIRAR_HIST, hist);

    // 4) Cerrar modal y refrescar vistas
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
  fill(tablaRetirar1, retirarListas[1]||[], 1);
  fill(tablaRetirar2, retirarListas[2]||[], 2);
  fill(tablaRetirar3, retirarListas[3]||[], 3);
}

function renderSalidas() {
  function fill(tbody, lista) {
    tbody.innerHTML = "";

    // Activo (con entrada y sin salida) SOLO dentro de ESTA línea
    const activo = (lista || []).find(r => r.entrada && !r.salida);
    const activoId = activo?.id || null;

    if (!lista || !lista.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; opacity:.7">Sin elementos</td></tr>`;
      return;
    }

    lista.forEach(reg => {
      const tr = document.createElement("tr");
      const entradaTxt = reg.entrada ? fmtDateTime(reg.entrada.at) : "";
      const salidaTxt  = reg.salida  ? fmtDateTime(reg.salida.at)  : "";

      tr.innerHTML = `<td>${reg.posicion}</td><td>${reg.rack}</td><td>${entradaTxt}</td><td>${salidaTxt}</td>`;

      // Si ya tiene salida, no mostramos botones (queda como histórico visible)
      if (reg.salida) {
        // nada
      } else {
        if (activoId && reg.id !== activoId) {
          // Mientras otro esté activo en esta línea, este no muestra botones
        } else {
          if (!reg.entrada) {
            // No hay activo en esta línea: puede dar entrada
            if (!activoId) {
              const btnEntrada = document.createElement("button");
              btnEntrada.type = "button";
              btnEntrada.textContent = "Dar entrada";
              btnEntrada.className = "primary";
              btnEntrada.addEventListener("click", () => openEntradaModal(reg));
              tr.children[2].innerHTML = "";
              tr.children[2].appendChild(btnEntrada);
            }
          } else {
            // Es el activo de la línea: muestra salida (verde si habilitado)
            const btnSalida = document.createElement("button");
            btnSalida.type = "button";
            btnSalida.textContent = "Dar salida";
            if (canShowDarSalida(reg)) {
              btnSalida.className = "accent"; // verde
              btnSalida.disabled = false;
              btnSalida.addEventListener("click", () => openSalidaModal(reg));
            } else {
              btnSalida.className = "primary";
              btnSalida.disabled = true;
            }
            tr.children[3].innerHTML = "";
            tr.children[3].appendChild(btnSalida);
          }
        }
      }

      tbody.appendChild(tr);
    });

    // detalle on row click
    attachRowInfoHandlers(tbody, lista);
  }

  fill(tablaSalidas1, salidasListas[1]||[]);
  fill(tablaSalidas2, salidasListas[2]||[]);
  fill(tablaSalidas3, salidasListas[3]||[]);
}

function renderPosiciones() {
  tablaPosiciones.innerHTML = "";
  for (let i = 1; i <= 450; i++) {
    const p = `P${pad3(i)}`;
    const libre = !enUso.posiciones[p];

    // Detalle (solo vista) que mantiene Controlistas
    const det = statusPosDet[p] || {};
    const tdActuador = damageCellHTML(det.actuador);
    const tdTarjeta = damageCellHTML(det.tarjeta);
    const tdAbraz   = damageCellHTML(det.abrazaderas); // Abrazaderas de manifold
    const tdCable   = damageCellHTML(det.cable_bajada);

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

    // Detalle (solo vista) que mantiene Controlistas
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

function renderAll() {
  renderRetirar();
  renderSalidas();
  renderPosiciones();
  renderRacks();
}

// Render inicial + refresco periódico (para habilitar salida al minuto)
renderAll();
setInterval(() => renderSalidas(), 5000);

// Comentarios (placeholder)
document.getElementById("formComentario")?.addEventListener("submit", (e)=>{
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

// =========================
// = Escáner de Barras (Quagga) fullscreen =
// =========================

const SECURE_ORIGIN = location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname);
let modalBAR, barRegion, btnBarUpload, btnBarCancel, hiddenFileInput;
let scanTargetInput = null, scanMode = 'text';

function ensureBarModal(){
  if (modalBAR) return;
  const tpl = document.createElement("div");
  tpl.innerHTML = `
    <dialog id="modalBAR" class="modal" style="max-width:none;width:100vw;height:100vh;border-radius:0;padding:0;">
      <div class="modal-content" style="width:100%;height:100%;padding:0;border-radius:0;background:#000;display:grid;grid-template-rows:1fr auto">
        <div id="barRegion" style="width:100%;height:100%;background:#000"></div>
        <div style="position:fixed;bottom:12px;left:0;right:0;display:flex;justify-content:center;gap:.5rem;z-index:2">
          <button class="secondary" id="btnBarUpload" type="button">Subir imagen</button>
          <button class="secondary" id="btnBarCancel" type="button">Cancelar</button>
        </div>
        <div style="position:fixed;top:10px;left:0;right:0;color:#fff;text-align:center;opacity:.85;z-index:2">Apunta la cámara al código. Válidos: <b>Rack###</b> / <b>P###</b> / texto.</div>
      </div>
    </dialog>
  `.trim();
  document.body.appendChild(tpl.firstElementChild);
  modalBAR     = document.getElementById("modalBAR");
  barRegion    = document.getElementById("barRegion");
  btnBarUpload = document.getElementById("btnBarUpload");
  btnBarCancel = document.getElementById("btnBarCancel");
  btnBarCancel?.addEventListener("click", closeScanner);
  btnBarUpload?.addEventListener("click", ()=> hiddenFileInput?.click());
  // archivo oculto
  hiddenFileInput = document.createElement("input");
  hiddenFileInput.type = "file";
  hiddenFileInput.accept = "image/*";
  hiddenFileInput.capture = "environment";
  hiddenFileInput.style.display = "none";
  document.body.appendChild(hiddenFileInput);
  hiddenFileInput.addEventListener("change", async (ev)=>{
    const f = ev.target.files?.[0]; if (!f) return;
    try {
      const dataUrl = await readAsDataURL(f);
      await decodeFromImage(dataUrl, scanMode);
    } catch(e) {
      console.error(e); alert("No se pudo leer el código de la imagen.");
    } finally {
      hiddenFileInput.value = "";
    }
  });
}

function readAsDataURL(file){
  return new Promise((res,rej)=>{
    const fr = new FileReader();
    fr.onload = ()=> res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

function isQuaggaLoaded(){ return typeof window.Quagga === "object" && typeof window.Quagga.init === "function"; }
async function loadQuaggaIfNeeded(){
  if (isQuaggaLoaded()) return true;
  await new Promise((resolve, reject)=>{
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js";
    s.onload = resolve; s.onerror = ()=> reject(new Error("No se pudo cargar Quagga"));
    document.head.appendChild(s);
  });
  return isQuaggaLoaded();
}
function flashInvalid(){ barRegion?.classList.add("invalid-flash"); setTimeout(()=> barRegion?.classList.remove("invalid-flash"), 250); }
function isValidByMode(mode, value){
  const v = (value||"").trim();
  if (!v) return false;
  if (mode === 'rack') return RX_RACK.test(v);
  if (mode === 'pos')  return RX_POS.test(v);
  return true; // texto libre
}

async function openScanner(targetInput, mode='text'){
  ensureBarModal();
  if (!SECURE_ORIGIN) { alert("La cámara requiere HTTPS o localhost."); return; }
  const okLib = await loadQuaggaIfNeeded().catch(()=>false);
  if (!okLib){ alert("No se cargó Quagga. Revisa tu conexión/CDN."); return; }

  scanTargetInput = targetInput;
  scanMode = mode;

  modalBAR.showModal();
  barRegion.innerHTML = "";

  const config = {
    inputStream: { type:"LiveStream", target:barRegion, constraints:{ facingMode:"environment", width:{ideal:1920}, height:{ideal:1080}, aspectRatio:{min:1, max:2.5} } },
    locator: { patchSize:"medium", halfSample:true },
    numOfWorkers: navigator.hardwareConcurrency ? Math.max(1, navigator.hardwareConcurrency - 1) : 2,
    frequency: 10,
    decoder: { readers: ["code_128_reader","ean_reader","ean_8_reader","code_39_reader","upc_reader","upc_e_reader","code_93_reader","i2of5_reader"] },
    locate: true
  };

  try{
    await new Promise((res,rej)=> Quagga.init(config, err=> err?rej(err):res()));
    let handled = false;
    Quagga.onDetected(onDetected);
    Quagga.start();

    function onDetected(result){
      if (handled) return;
      const raw = result?.codeResult?.code?.trim();
      if (!raw) return;
      if (!isValidByMode(scanMode, raw)){
        flashInvalid();
        if (scanMode==='rack') alert('Formato inválido. Debe ser: Rack### (ej. Rack001).');
        else if (scanMode==='pos') alert('Formato inválido. Debe ser: P### (ej. P002).');
        return;
      }
      handled = true;
      if (scanTargetInput){
        scanTargetInput.value = raw;
        scanTargetInput.dispatchEvent(new Event("input"));
        scanTargetInput.dispatchEvent(new Event("blur"));
      }
      closeScanner();
    }
  }catch(e){
    console.error("Error al iniciar Quagga:", e);
    alert("No se pudo iniciar la cámara. Usa 'Subir imagen'.");
  }
}

function closeScanner(){
  try{ Quagga?.offDetected(); Quagga?.stop(); }catch{}
  if (modalBAR?.open) modalBAR.close();
  barRegion && (barRegion.innerHTML = "");
  scanTargetInput = null; scanMode = 'text';
}

async function decodeFromImage(dataUrl, mode='text'){
  if (!isQuaggaLoaded()) throw new Error("Quagga no cargó.");
  return new Promise((resolve, reject)=>{
    Quagga.decodeSingle({
      src: dataUrl, numOfWorkers:0,
      decoder:{ readers:["code_128_reader","ean_reader","ean_8_reader","code_39_reader","upc_reader","upc_e_reader","code_93_reader","i2of5_reader"] },
      locate:true
    }, (result)=>{
      const raw = result?.codeResult?.code?.trim();
      if (!raw) return reject(new Error("No se detectó código en la imagen."));
      if (!isValidByMode(mode, raw)){
        flashInvalid();
        if (mode==='rack') alert('Formato inválido en imagen. Debe ser: Rack###.');
        else if (mode==='pos') alert('Formato inválido en imagen. Debe ser: P###.');
        return reject(new Error("Formato inválido"));
      }
      if (scanTargetInput){
        scanTargetInput.value = raw;
        scanTargetInput.dispatchEvent(new Event("input"));
        scanTargetInput.dispatchEvent(new Event("blur"));
      }
      closeScanner();
      resolve(raw);
    });
  });
}

// Conectar botones de escaneo en el formulario principal
btnScanSeco?.addEventListener("click", ()=> openScanner(inputCodigoSeco, 'text'));
btnScanNumRack?.addEventListener("click", ()=> openScanner(inputNumRack, 'rack'));
btnScanPosRack?.addEventListener("click", ()=> openScanner(inputPosRack, 'pos'));

// Conectar botón de escaneo en modal de Entrada (confirmación de rack)
btnScanRackConfirm?.addEventListener("click", ()=> openScanner(inputConfirmRack, 'rack'));

