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
const statusPosDet = loadJSON(LS_KEYS.STATUS_POS_DET, {});   // P001:{estado: 'disponible'|'en_uso'|'mantenimiento', ...}
const statusRacksDet = loadJSON(LS_KEYS.STATUS_RACKS_DET, {}); // Rack001:{estado: 'disponible'|'en_uso'|'mantenimiento', ...}

// ====== Reconciliación de estados ======
// - En SALIDAS sin salida: ocupa SOLO el rack (la posición ya quedó libre al retirar).
function reconcileEnUso() {
  const nuevo = { posiciones: {}, racks: {} };
  const s = loadJSON(LS_KEYS.SALIDAS, { 1: [], 2: [], 3: [] });
  [1, 2, 3].forEach(l => {
    (s[l] || []).forEach(reg => {
      if (!reg?.salida) {
        if (reg?.rack) nuevo.racks[reg.rack] = true;  // SOLO rack
      }
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

// Confirmación de línea (modal Entrada)
const confirmLineaContainer = document.getElementById("confirmLineaBtns");
const inputConfirmLineaValue = document.getElementById("confirmLineaValue");
const inputConfirmRack = document.getElementById("confirmRack");
const btnScanRack = document.getElementById("btnScanRack"); // deshabilitado si así lo tenías

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

(function restoreTabs() {
  const st = loadTabs();
  document.getElementById(st.retirar)?.setAttribute("checked", "checked");
  document.getElementById(st.salidas)?.setAttribute("checked", "checked");
})();
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
(function prefillInit() {
  const linea = getLineaSeleccionada();
  if (linea) prefillFromLast(linea);
})();
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
  const cantidad = Number.parseInt(inputCantidad.value || "0", 10);

  let rack = autoformatRack(inputNumRack.value);
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
  if (!RX_PATTERN.test(rack)) { alert('El número de rack debe tener formato "Rack###".'); inputNumRack.focus(); return; }
  if (!POS_PATTERN.test(posicion)) { alert('La posición debe tener formato "P###".'); inputPosRack.focus(); return; }

  reconcileEnUso();
  if (enUso.racks[rack]) { alert(`El rack ${rack} ya está en uso.`); inputNumRack.focus(); return; }

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

  // Ocupa POS y RACK hasta retirar
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

  renderAll();
  alert("Registro guardado y enviado a Controlistas.");
});

// ====== Retirar -> mover a Salidas (libera POSICIÓN) ======
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

  const yaExiste = (salidasListas[linea] || []).some(r =>
    r.rack === item.rack && r.posicion === item.posicion && !r.salida
  );
  if (!yaExiste) {
    (salidasListas[linea] = salidasListas[linea] || []).push(registro);
    safeSave(LS_KEYS.SALIDAS, salidasListas);
  }

  const arr = retirarListas[linea] || [];
  const idx = arr.findIndex(x => x.posicion === item.posicion && x.rack === item.rack);
  if (idx >= 0) {
    arr.splice(idx, 1);
    retirarListas[linea] = arr;
    safeSave(LS_KEYS.RETIRAR, retirarListas);
  }

  // Libera la posición (el rack sigue ocupado hasta SALIDA)
  delete enUso.posiciones[item.posicion];
  safeSave(LS_KEYS.EN_USO, enUso);

  renderAll();
}

// ====== Entrada / Salida ======
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
  setTimeout(() => inputPatineroEntrada?.focus(), 50);
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
btnScanRack?.addEventListener("click", () => { /* opcional: deshabilitado */ });

formEntrada.addEventListener("click", (e) => {
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;

  if (btn.value === "save" && currentSalida) {
    const byName = inputPatineroEntrada.value.trim() || CURRENT_USER?.name || "";
    const byId = CURRENT_USER?.id || null;

    const lineaSeleccionada = parseInt(inputConfirmLineaValue.value, 10);
    if (!entradaLineaConfirmada || lineaSeleccionada !== currentSalida.linea) {
      alert(`Debes seleccionar la línea correcta (Línea ${currentSalida.linea}).`);
      return;
    }

    let confirmRack = autoformatRack(inputConfirmRack.value.trim());
    if (!confirmRack) { alert("Debes confirmar el Rack (ej. Rack001)."); inputConfirmRack.focus(); return; }
    inputConfirmRack.value = confirmRack;
    if (confirmRack !== currentSalida.rack) {
      alert(`El Rack confirmado (${confirmRack}) no coincide con el asignado (${currentSalida.rack}).`);
      inputConfirmRack.focus(); return;
    }

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

function secondsToEnable(reg) {
  if (!reg.entradaGuardadaEn) return 60;
  const diff = 60 - Math.floor((Date.now() - reg.entradaGuardadaEn) / 1000);
  return Math.max(0, diff);
}

function openSalidaModal(reg) {
  currentSalida = reg;
  salidaResumen.textContent = `Línea ${reg.linea} | Posición ${reg.posicion} | Rack ${reg.rack}`;
  inputValidacionPatinero.value = CURRENT_USER?.name || "";
  modalSalida.showModal();
  setTimeout(() => inputValidacionPatinero?.focus(), 50);
}

formSalida.addEventListener("click", (e) => {
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;

  if (btn.value === "save" && currentSalida) {
    const byName = inputValidacionPatinero.value.trim() || CURRENT_USER?.name || "";
    const byId = CURRENT_USER?.id || null;
    if (!byName) return;

    currentSalida.salida = { byId, byName, at: nowISO() };

    // Libera SOLO el RACK
    delete enUso.racks[currentSalida.rack];
    safeSave(LS_KEYS.EN_USO, enUso);

    // Enviar a CONTROLISTAS (historial para ellos)
    const controlistasPend = loadJSON(LS_KEYS.CONTROLISTAS, []);
    controlistasPend.push({
      id: crypto.randomUUID(),
      tipo: "salida",
      linea: currentSalida.linea,
      posicion: currentSalida.posicion,
      rack: currentSalida.rack,
      entrada: currentSalida.entrada || null,
      salida: currentSalida.salida,
      refId: currentSalida.refId || null,
      creadoEn: nowISO(),
      operador: currentSalida.operador || null,
      codigoSeco: currentSalida.codigoSeco || null,
      cantidad: currentSalida.cantidad ?? null,
      registradoPorNombre: currentSalida.registradoPorNombre || null,
      validadoPorId: currentSalida.salida.byId,
      validadoPorNombre: currentSalida.salida.byName
    });
    safeSave(LS_KEYS.CONTROLISTAS, controlistasPend);

    // Quitar el registro de salidasListas (ya fue enviado a Controlistas)
    const arr = salidasListas[currentSalida.linea] || [];
    const idx = arr.findIndex(r => r.id === currentSalida.id);
    if (idx >= 0) {
      arr.splice(idx, 1);
      salidasListas[currentSalida.linea] = arr;
      safeSave(LS_KEYS.SALIDAS, salidasListas);
    }

    modalSalida.close();
    renderAll();
  }

  if (btn.value === "cancel") modalSalida.close();
});

// ====== Render ======
function renderRetirar() {
  function groupByCodigo(lista) {
    const map = {};
    (lista || []).forEach(it => {
      const key = (it.codigoSeco && String(it.codigoSeco).trim()) || "—";
      (map[key] = map[key] || []).push(it);
    });
    return map;
  }
  function fill(tbody, lista, linea) {
    tbody.innerHTML = "";
    if (!lista || !lista.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; opacity:.7">Sin elementos</td></tr>`;
      return;
    }
    const groups = groupByCodigo(lista);
    const orderedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "—") return 1;
      if (b === "—") return -1;
      return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
    });
    orderedKeys.forEach(code => {
      const items = groups[code];
      const trHead = document.createElement("tr");
      trHead.innerHTML = `
        <td colspan="3" style="background:#f3f4f6;border-top:2px solid #e5e7eb;font-weight:800;color:#2563eb;">
          Código: <span style="font-weight:900;">${code}</span>
          <small style="opacity:.75; margin-left:.5rem;">(${items.length})</small>
        </td>`;
      tbody.appendChild(trHead);
      items.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.posicion}</td>
          <td>${item.rack}</td>
          <td><button class="accent" type="button">Retirar</button></td>
        `;
        tr.querySelector("button").addEventListener("click", () => handleRetirar(item, linea));
        tbody.appendChild(tr);
      });
    });
  }
  fill(tablaRetirar1, retirarListas[1] || [], 1);
  fill(tablaRetirar2, retirarListas[2] || [], 2);
  fill(tablaRetirar3, retirarListas[3] || [], 3);
}

function renderSalidas() {
  function groupByCodigo(lista) {
    const map = {};
    (lista || []).forEach(it => {
      const key = (it.codigoSeco && String(it.codigoSeco).trim()) || "—";
      (map[key] = map[key] || []).push(it);
    });
    return map;
  }
  function fill(tbody, lista) {
    tbody.innerHTML = "";
    if (!lista || !lista.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; opacity:.7">Sin elementos</td></tr>`;
      return;
    }
    const activo = (lista || []).find(r => r.entrada && !r.salida);
    const activoId = activo?.id || null;

    const groups = groupByCodigo(lista);
    const orderedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "—") return 1;
      if (b === "—") return -1;
      return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
    });

    const rowsModel = [];

    orderedKeys.forEach(code => {
      const items = groups[code];
      const trHead = document.createElement("tr");
      trHead.innerHTML = `
        <td colspan="4" style="background:#f3f4f6;border-top:2px solid #e5e7eb;font-weight:800;color:#2563eb;">
          Código: <span style="font-weight:900;">${code}</span>
          <small style="opacity:.75; margin-left:.5rem;">(${items.length})</small>
        </td>`;
      tbody.appendChild(trHead);
      rowsModel.push(null);

      items.forEach(reg => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${reg.posicion}</td><td>${reg.rack}</td><td></td><td></td>`;
        if (activoId && reg.id !== activoId) {
          // otro activo bloquea
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
        rowsModel.push(reg);
      });
    });

    attachRowInfoHandlers(tbody, rowsModel);
  }

  fill(tablaSalidas1, salidasListas[1] || []);
  fill(tablaSalidas2, salidasListas[2] || []);
  fill(tablaSalidas3, salidasListas[3] || []);
}

/* ====== NUEVO: Estado de Posiciones/Racks con prioridad de orden ====== */
function estadoPos(key) {
  const det = statusPosDet[key];
  if (det?.estado === "mantenimiento") return "mantenimiento";
  if (enUso.posiciones[key]) return "ocupada";
  return "disponible";
}
function estadoRack(key) {
  const det = statusRacksDet[key];
  if (det?.estado === "mantenimiento") return "mantenimiento";
  if (enUso.racks[key]) return "en_uso";
  return "disponible";
}
function estadoTdHTMLPos(estado) {
  if (estado === "mantenimiento") return `<td class="warn">Mantenimiento</td>`;
  if (estado === "ocupada") return `<td class="busy">Ocupada</td>`;
  return `<td class="ok">Libre</td>`;
}
function estadoTdHTMLRack(estado) {
  if (estado === "mantenimiento") return `<td class="warn">Mantenimiento</td>`;
  if (estado === "en_uso") return `<td class="busy">En uso</td>`;
  return `<td class="ok">Listo</td>`;
}

function renderPosiciones() {
  tablaPosiciones.innerHTML = "";
  const libres = [], mantenimiento = [], ocupadas = [];

  for (let i = 1; i <= 450; i++) {
    const p = `P${pad3(i)}`;
    const est = estadoPos(p); // 'disponible' | 'mantenimiento' | 'ocupada'
    const det = statusPosDet[p] || {};
    const item = { p, est, det, idNum: i };
    if (est === "disponible") libres.push(item);
    else if (est === "mantenimiento") mantenimiento.push(item);
    else ocupadas.push(item);
  }

  libres.sort((a,b)=>a.idNum-b.idNum);
  mantenimiento.sort((a,b)=>a.idNum-b.idNum);
  ocupadas.sort((a,b)=>a.idNum-b.idNum);

  const renderRow = ({ p, est, det }) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p}</td>
      ${estadoTdHTMLPos(est)}
      ${damageCellHTML(det.actuador)}
      ${damageCellHTML(det.tarjeta)}
      ${damageCellHTML(det.abrazaderas)}
      ${damageCellHTML(det.cable_bajada)}
      <td>${det.obs ? det.obs : "—"}</td>
    `;
    tablaPosiciones.appendChild(tr);
  };

  [...libres, ...mantenimiento, ...ocupadas].forEach(renderRow);
}

function renderRacks() {
  tablaRacks.innerHTML = "";
  const disponibles = [], mantenimiento = [], enUsoList = [];

  for (let i = 1; i <= 435; i++) {
    const r = `Rack${pad3(i)}`;
    const est = estadoRack(r); // 'disponible' | 'mantenimiento' | 'en_uso'
    const det = statusRacksDet[r] || {};
    const item = { r, est, det, idNum: i };
    if (est === "disponible") disponibles.push(item);
    else if (est === "mantenimiento") mantenimiento.push(item);
    else enUsoList.push(item);
  }

  disponibles.sort((a,b)=>a.idNum-b.idNum);
  mantenimiento.sort((a,b)=>a.idNum-b.idNum);
  enUsoList.sort((a,b)=>a.idNum-b.idNum);

  const renderRow = ({ r, est, det }) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r}</td>
      ${estadoTdHTMLRack(est)}
      ${damageCellHTML(det.soporte_dren)}
      ${damageCellHTML(det.porta_manguera)}
      ${damageCellHTML(det.tina)}
    `;
    tablaRacks.appendChild(tr);
  };

  [...disponibles, ...mantenimiento, ...enUsoList].forEach(renderRow);
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
  reconcileEnUso();
  renderRetirar();
  renderSalidas();
  renderPosiciones();
  renderRacks();
  updateCountersUI();
}

// ====== Inicialización ======
renderAll();
// refresco ligero para countdown de salida
setInterval(() => renderSalidas(), 1000);

// ====== Comentarios ======
// (MODIFICADO) Envía ping para notificación en Controlistas
document.getElementById("formComentario")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const txt = (document.getElementById("comentario")?.value || "").trim();
  if (!txt) return;

  const arr = JSON.parse(localStorage.getItem("comentarios") || "[]");
  const user = JSON.parse(localStorage.getItem("CURRENT_USER") || "null");
  const item = { by: user?.name || "Patinero", text: txt, at: new Date().toISOString() };

  arr.push(item);
  localStorage.setItem("comentarios", JSON.stringify(arr));
  e.target.reset();
  alert("Comentario enviado.");

  // 🔔 Ping a Controlistas: dispara el evento 'storage' en otras pestañas
  try {
    const payload = {
      id: crypto.randomUUID(),
      by: item.by,
      text: item.text,
      at: Date.now()
    };
    localStorage.setItem("comment_ping", JSON.stringify(payload));
  } catch {}
});

// Deshabilitar botones de escaneo (si existen)
const btnScanSeco    = inputCodigoSeco?.closest(".with-actions")?.querySelector("button");
const btnScanNumRack = inputNumRack?.closest(".with-actions")?.querySelector("button");
const btnScanPosRack = inputPosRack?.closest(".with-actions")?.querySelector("button");
[btnScanSeco, btnScanNumRack, btnScanPosRack, btnScanRack].forEach(b => {
  if (b) {
    b.disabled = true;
    b.title = "Escaneo deshabilitado";
    b.setAttribute("aria-disabled", "true");
  }
});
