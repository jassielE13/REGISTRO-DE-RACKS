// ====== Keys ======
const LS_KEYS = {
  CONTROLISTAS: "controlistas_pendientes",
  PRODUCCION:   "controlistas_produccion",
  RETIRAR:      "retirar_listas",
  RETIRAR_HIST: "retirar_historial_all",
  STATUS_POS_DET:  "status_posiciones_detalle",
  STATUS_RACKS_DET: "status_racks_detalle",
  COMMENTS:     "comentarios",
  COMMENTS_READ:"comentarios_leidos",
  EN_USO:       "en_uso",
  HIST:         "historial_movimientos"
};

// ====== Utils ======
const $ = (sel, root=document)=> root.querySelector(sel);
const $$ = (sel, root=document)=> Array.from(root.querySelectorAll(sel));
function loadJSON(k, fb){ try{ const r=localStorage.getItem(k); return r?JSON.parse(r):fb; }catch{return fb;} }
function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
function pad3(n){ return String(n).padStart(3,"0"); }
function fmtDT(iso){ if(!iso) return "—"; const d=new Date(iso); return isNaN(d)? "—" : d.toLocaleString(); }
function currentUser(){ try{return JSON.parse(localStorage.getItem("CURRENT_USER")||"null");}catch{return null;} }

// ====== Notificaciones (permiso al cargar) ======
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission().catch(()=>{});
}
function notifyNewComment(data){
  // Atualiza la lista de comentarios
  try { renderComentarios(); } catch {}
  // Si la pestaña no está en foco y hay permiso, muestra notificación
  if ("Notification" in window && Notification.permission === "granted" && !document.hasFocus()) {
    try {
      new Notification("Nuevo comentario", {
        body: `${data.by || "Patinero"}: ${String(data.text||"").slice(0, 90)}`,
        tag: data.id,
        renotify: false
      });
    } catch {}
  }
}
// Escuchar pings desde Patineros
window.addEventListener("storage", (e) => {
  if (e.key === "comment_ping" && e.newValue) {
    try { notifyNewComment(JSON.parse(e.newValue)); } catch {}
  }
});

// ====== Estado ======
let pendientes = loadJSON(LS_KEYS.CONTROLISTAS, []);
let produccion = loadJSON(LS_KEYS.PRODUCCION, []);
let retirar    = loadJSON(LS_KEYS.RETIRAR, {1:[],2:[],3:[],4:[]});
let retirarHist= loadJSON(LS_KEYS.RETIRAR_HIST, []);
let posStatus  = loadJSON(LS_KEYS.STATUS_POS_DET, {});
let rackStatus = loadJSON(LS_KEYS.STATUS_RACKS_DET, {});
let comentarios= loadJSON(LS_KEYS.COMMENTS, []);
let comentariosLeidos = loadJSON(LS_KEYS.COMMENTS_READ, []);
let enUso      = loadJSON(LS_KEYS.EN_USO, {posiciones:{}, racks:{}});

// ====== Nav activo ======
function highlightActive(){
  const hash = location.hash || "#pendientes";
  $$("#mainNav a").forEach(a => a.classList.toggle("active", a.getAttribute("href")===hash));
}
window.addEventListener("hashchange", highlightActive);
highlightActive();

// ====== DOM refs ======
const tblPend = { 1: $("#tblPend1 tbody"), 2: $("#tblPend2 tbody"), 3: $("#tblPend3 tbody"), 4: $("#tblPend4 tbody") };
const tblProdAll = $("#tblProdAll tbody");
const tblHistAll = $("#tblHistAll tbody");
const histRange  = $("#histRange");

const gridPos = $("#gridPos");
const gridRack = $("#gridRack");
const posSearch = $("#posSearch");
const rackSearch = $("#rackSearch");
const ulComentarios = $("#ulComentarios");
const ulComentariosLeidos = $("#ulComentariosLeidos");

// Modales Validación
const modalValidar = $("#modalValidar");
const formValidar = $("#formValidar");
const valResumen = $("#valResumen");
const valDetalle = $("#valDetalle");
const valChips   = $("#valChips");
const valCodigo  = $("#valCodigo");
const btnScanVal = $("#btnScanVal");

// Modal Info (Producción)
const modalInfo = $("#modalInfo");
const infoBody  = $("#infoBody");
const infoActions = $("#infoActions");

// Modal Info Historial
const modalHistInfo = $("#modalHistInfo");
const histInfoBody  = $("#histInfoBody");

// Modales Pos/Rack
const modalPos  = $("#modalPos");
const posTitle  = $("#posTitle");
const formPos   = $("#formPos");
const posEstado = $("#posEstado");
const posEstadoIndicador = $("#posEstadoIndicador");
const posObs    = $("#posObs");
const posActuador = $("#posActuador");
const posTarjeta  = $("#posTarjeta");
const posAbraz    = $("#posAbraz");
const posCable    = $("#posCable");

const modalRack = $("#modalRack");
const rackTitle = $("#rackTitle");
const formRack  = $("#formRack");
const rkEstado  = $("#rkEstado");
const rkEstadoIndicador = $("#rkEstadoIndicador");
const rkObs     = $("#rkObs");
const rkSoporte = $("#rkSoporte");
const rkPorta   = $("#rkPorta");
const rkTina    = $("#rkTina");

// ====== Renders (Pendientes / Producción) ======
function renderPendientes(){
  const byLine = {1:[],2:[],3:[],4:[]};
  const base = (pendientes || []).filter(r => r?.tipo !== "salida");
  base.forEach(r => (byLine[r.linea] = byLine[r.linea] || []).push(r));

  [1,2,3,4].forEach(l => {
    const tb = tblPend[l]; if (!tb) return; tb.innerHTML = "";
    const arr = byLine[l] || [];
    if (!arr.length){
      tb.innerHTML = `<tr><td colspan="8" style="text-align:center;opacity:.7">Sin pendientes</td></tr>`;
      return;
    }
    arr.forEach(reg => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtDT(reg.creadoEn)}</td>
        <td>${reg.operador ?? "—"}</td>
        <td>${reg.codigoSeco ?? "—"}</td>
        <td>${reg.cantidad ?? "—"}</td>
        <td>${reg.rack ?? "—"}</td>
        <td>${reg.posicion ?? "—"}</td>
        <td>${reg.registradoPorNombre ?? "—"}</td>
        <td><button class="primary">Validar</button></td>
      `;
      tr.querySelector("button").addEventListener("click", ()=> openValidar(reg));
      tb.appendChild(tr);
    });
  });
}
function updateProdTotal(){
  const el = $("#prodTotal");
  if (!el) return;
  const total = (produccion || []).reduce((sum, r) => {
    const n = parseFloat(r?.cantidad);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  el.textContent = `Total: ${total}`;
}
function renderProduccion(){
  tblProdAll.innerHTML = "";
  if (!produccion.length){
    tblProdAll.innerHTML = `<tr><td colspan="8" style="text-align:center;opacity:.7">Sin registros</td></tr>`;
    updateProdTotal(); return;
  }
  const grupos = {};
  (produccion||[]).forEach(r => {
    const key = r.codigoSeco || "Sin código";
    (grupos[key] = grupos[key] || []).push(r);
  });
  Object.entries(grupos).forEach(([codigo, regs]) => {
    const sep = document.createElement("tr");
    sep.classList.add("tr-separator");
    sep.innerHTML = `<td colspan="8">Código de seco: ${codigo}</td>`;
    tblProdAll.appendChild(sep);
    regs.forEach(reg => {
      const tr = document.createElement("tr");
      tr.classList.add("clickable");
      tr.innerHTML = `
        <td>${fmtDT(reg.creadoEn)}</td>
        <td>${reg.linea}</td>
        <td>${reg.operador ?? "—"}</td>
        <td>${reg.codigoSeco ?? "—"}</td>
        <td>${reg.cantidad ?? "—"}</td>
        <td>${reg.rack ?? "—"}</td>
        <td>${reg.posicion ?? "—"}</td>
        <td>${reg.validadoPorNombre ?? "—"}</td>
      `;
      tr.addEventListener("click", ()=> openInfoRegistro(reg));
      tblProdAll.appendChild(tr);
    });
  });
  updateProdTotal();
}

/* ===== Enriquecedor (Historial) ===== */
function enrichSalida(rec){
  if (!rec) return rec;
  const rid = rec.refId || rec.id;
  const prodArr = loadJSON(LS_KEYS.PRODUCCION, []);
  const retHist = loadJSON(LS_KEYS.RETIRAR_HIST, []);
  const pending = loadJSON(LS_KEYS.CONTROLISTAS, []);
  const source =
    (prodArr.find(x => x.id === rid)) ||
    (retHist.find(x => x.id === rid || x.refId === rid)) ||
    (pending.find(x => x.id === rid));
  if (!source) return rec;
  return {
    ...source,
    ...rec,
    operador: rec.operador ?? source.operador,
    codigoSeco: rec.codigoSeco ?? source.codigoSeco,
    cantidad: rec.cantidad ?? source.cantidad,
    creadoEn: rec.creadoEn ?? source.creadoEn,
    registradoPorNombre: rec.registradoPorNombre ?? source.registradoPorNombre,
    posicion: rec.posicion ?? source.posicion,
    rack: rec.rack ?? source.rack,
    linea: rec.linea ?? source.linea
  };
}

/* ===== HISTORIAL (salidas) ===== */
function renderHistorialSalidas(){
  if (!tblHistAll) return;
  tblHistAll.innerHTML = "";

  const all = loadJSON(LS_KEYS.CONTROLISTAS, []);
  let salidas = (all || []).filter(it => it && it.tipo === "salida").map(enrichSalida);

  const mode = histRange?.value || "all";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (mode === "today"){
    salidas = salidas.filter(s => {
      const t = new Date(s.salida?.at || s.creadoEn || 0).getTime();
      return t >= startOfToday;
    });
  } else if (mode === "7" || mode === "30"){
    const days = parseInt(mode,10);
    const cutoff = now.getTime() - days*24*60*60*1000;
    salidas = salidas.filter(s => new Date(s.salida?.at || s.creadoEn || 0).getTime() >= cutoff);
  }

  if (!salidas.length){
    tblHistAll.innerHTML = `<tr><td colspan="8" style="text-align:center;opacity:.7">Sin salidas registradas</td></tr>`;
    return;
  }

  salidas.sort((a,b)=>{
    const ta = new Date(a.salida?.at || a.creadoEn || 0).getTime();
    const tb = new Date(b.salida?.at || b.creadoEn || 0).getTime();
    return tb - ta;
  });

  const grupos = {};
  salidas.forEach(r => {
    const key = r.codigoSeco || "Sin código";
    (grupos[key] = grupos[key] || []).push(r);
  });

  Object.entries(grupos).forEach(([codigo, regs]) => {
    const sep = document.createElement("tr");
    sep.classList.add("tr-separator");
    sep.innerHTML = `<td colspan="8">Código de seco: ${codigo}</td>`;
    tblHistAll.appendChild(sep);

    regs.forEach(reg => {
      const salidaFecha = reg.salida?.at || reg.creadoEn;
      const validadoPor = reg.salida?.byName || reg.validadoPorNombre || "—";
      const tr = document.createElement("tr");
      tr.classList.add("clickable");
      tr.innerHTML = `
        <td>${fmtDT(salidaFecha)}</td>
        <td>${reg.linea ?? "—"}</td>
        <td>${reg.operador ?? "—"}</td>
        <td>${reg.codigoSeco ?? "—"}</td>
        <td>${reg.cantidad ?? "—"}</td>
        <td>${reg.rack ?? "—"}</td>
        <td>${reg.posicion ?? "—"}</td>
        <td>${validadoPor}</td>
      `;
      tr.addEventListener("click", ()=> openHistInfo(reg));
      tblHistAll.appendChild(tr);
    });
  });
}
histRange?.addEventListener("change", renderHistorialSalidas);

function openHistInfo(reg){
  const r = enrichSalida(reg);
  histInfoBody.innerHTML = `
    <dl>
      <dt>Código seco</dt><dd>${r.codigoSeco ?? "—"}</dd>
      <dt>Cantidad</dt><dd>${r.cantidad ?? "—"}</dd>
      <dt>Línea</dt><dd>${r.linea ?? "—"}</dd>
      <dt>Posición</dt><dd>${r.posicion ?? "—"}</dd>
      <dt>Rack</dt><dd>${r.rack ?? "—"}</dd>

      <dt>Operador (registro)</dt><dd>${r.operador ?? "—"}</dd>
      <dt>Registrado por</dt><dd>${r.registradoPorNombre ?? "—"}</dd>
      <dt>Creado</dt><dd>${fmtDT(r.creadoEn)}</dd>

      <dt>Validado por</dt><dd>${r.validadoPorNombre ?? "—"}</dd>
      <dt>Validado en</dt><dd>${fmtDT(r.validadoEn)}</dd>

      <dt>Entrada — Patinero</dt><dd>${r.entrada?.byName ?? "—"}</dd>
      <dt>Entrada — Fecha</dt><dd>${fmtDT(r.entrada?.at)}</dd>
      <dt>Entrada — Línea conf.</dt><dd>${r.entrada?.confirmLinea ?? "—"}</dd>
      <dt>Entrada — Rack conf.</dt><dd>${r.entrada?.confirmRack ?? "—"}</dd>

      <dt>Salida — Patinero</dt><dd>${r.salida?.byName ?? "—"}</dd>
      <dt>Salida — Fecha</dt><dd>${fmtDT(r.salida?.at)}</dd>
    </dl>
  `;
  modalHistInfo.showModal();
}

/* ====== Helpers de estado (OK / ROJO / ÁMBAR) ====== */
function estadoToBadge(estado){
  if (estado === "en_uso") {
    return { cls: "state-busy", text: "En uso" };
  }
  if (estado === "mantenimiento") {
    return { cls: "state-warn", text: "Mantenimiento" };
  }
  return { cls: "state-ok", text: "Disponible" };
}

/* ====== POSICIONES (3 estados con ámbar) ====== */
function tilePosHTML(label, estado){
  const { cls, text } = estadoToBadge(estado);
  return `
    <div class="tile-title">${label}</div>
    <div class="tile-state ${cls}">${text}</div>
  `;
}
function obtenerEstadoPos(key){
  const st = posStatus?.[key]?.estado;
  if (st) return st; // 'disponible' | 'en_uso' | 'mantenimiento'
  return enUso.posiciones?.[key] ? "en_uso" : "disponible";
}
function renderPosCatalogo(filter=""){
  if (!gridPos) return;
  gridPos.innerHTML = "";
  const f = (filter||"").toLowerCase().trim();
  for (let i=1;i<=450;i++){
    const key = "P"+pad3(i);
    if (f && !key.toLowerCase().includes(f)) continue;
    const estado = obtenerEstadoPos(key);
    const li = document.createElement("li");
    li.innerHTML = tilePosHTML(key, estado);
    li.addEventListener("click", ()=> openPosEditor(key));
    gridPos.appendChild(li);
  }
}

/* ====== RACKS (3 estados con ámbar) ====== */
function tileRackHTML(label, estado){
  const { cls, text } = estadoToBadge(estado);
  return `
    <div class="tile-title">${label}</div>
    <div class="tile-state ${cls}">${text}</div>
  `;
}
function obtenerEstadoRack(key){
  const st = rackStatus?.[key]?.estado;
  if (st) return st; // 'disponible' | 'en_uso' | 'mantenimiento'
  return enUso.racks?.[key] ? "en_uso" : "disponible";
}
function renderRackCatalogo(filter=""){
  if (!gridRack) return;
  gridRack.innerHTML = "";
  const f = (filter||"").toLowerCase().trim();
  for (let i=1;i<=435;i++){
    const key = "Rack"+pad3(i);
    if (f && !key.toLowerCase().includes(f)) continue;
    const estado = obtenerEstadoRack(key);
    const li = document.createElement("li");
    li.innerHTML = tileRackHTML(key, estado);
    li.addEventListener("click", ()=> openRackEditor(key));
    gridRack.appendChild(li);
  }
}
function renderCatalogos(){
  renderPosCatalogo(posSearch?.value);
  renderRackCatalogo(rackSearch?.value);
}
posSearch?.addEventListener("input", ()=> renderPosCatalogo(posSearch.value));
rackSearch?.addEventListener("input", ()=> renderRackCatalogo(rackSearch.value));

/* ====== Comentarios ====== */
function renderComentarios(){
  ulComentarios.innerHTML = "";
  ulComentariosLeidos.innerHTML = "";

  // Carga fresca desde localStorage
  let pendientes = loadJSON(LS_KEYS.COMMENTS, []);
  let leidos = loadJSON(LS_KEYS.COMMENTS_READ, []);

  // PENDIENTES
  if (!pendientes.length){
    ulComentarios.innerHTML = `<li style="opacity:.7">Sin comentarios pendientes</li>`;
  } else {
    pendientes.slice().reverse().forEach(c => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="row">
          <strong>${c.by || "Patinero"}</strong>
          <small>${fmtDT(c.at)}</small>
        </div>
        <div>${c.text}</div>
        <div class="actions end"><button class="ghost">Leído</button></div>
      `;
      li.querySelector("button").addEventListener("click", ()=> {
        // 1) Quitar de pendientes
        pendientes = loadJSON(LS_KEYS.COMMENTS, []).filter(x =>
          !(x.by === c.by && x.text === c.text && x.at === c.at)
        );
        saveJSON(LS_KEYS.COMMENTS, pendientes);

        // 2) Agregar a leídos
        leidos = loadJSON(LS_KEYS.COMMENTS_READ, []);
        leidos.push(c);
        saveJSON(LS_KEYS.COMMENTS_READ, leidos);

        // 3) Notificar a otras pestañas (opcional)
        try {
          localStorage.setItem("comment_read_ping", JSON.stringify({
            id: crypto.randomUUID(),
            at: Date.now(),
            by: c.by,
            text: c.text
          }));
        } catch {}

        // 4) Re-render inmediato (desaparece de pendientes)
        renderComentarios();
      });
      ulComentarios.appendChild(li);
    });
  }

  // LEÍDOS
  if (!leidos.length){
    ulComentariosLeidos.innerHTML = `<li style="opacity:.7">Sin comentarios leídos</li>`;
  } else {
    leidos.slice().reverse().forEach(c => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="row">
          <strong>${c.by || "Patinero"}</strong>
          <small>${fmtDT(c.at)}</small>
        </div>
        <div>${c.text}</div>
      `;
      ulComentariosLeidos.appendChild(li);
    });
  }
}

/* ====== Validar / Info Producción ====== */
let currentPendiente = null;
function openValidar(reg){
  currentPendiente = reg;
  valResumen.textContent = `Línea ${reg.linea} | Posición ${reg.posicion} | Rack ${reg.rack}`;
  valDetalle.innerHTML = `
    <dl>
      <dt>Operador</dt><dd>${reg.operador ?? "—"}</dd>
      <dt>Código de seco (esperado)</dt><dd>${reg.codigoSeco ?? "—"}</dd>
      <dt>Cantidad</dt><dd>${reg.cantidad ?? "—"}</dd>
      <dt>Registrado por</dt><dd>${reg.registradoPorNombre ?? "—"}</dd>
      <dt>Creado en</dt><dd>${fmtDT(reg.creadoEn)}</dd>
    </dl>
  `;
  valChips.innerHTML = `
    <span class="tile-state ${enUso.posiciones?.[reg.posicion]?'state-busy':'state-ok'}">
      Posición ${enUso.posiciones?.[reg.posicion]?'Ocupada':'Disponible'}
    </span>
    <span class="tile-state ${enUso.racks?.[reg.rack]?'state-busy':'state-ok'}">
      ${enUso.racks?.[reg.rack]?'Rack en uso':'Rack listo'}
    </span>
  `;
  valCodigo.value = "";
  modalValidar.showModal();
}
btnScanVal.addEventListener("click", ()=>{
  const v = prompt("Simulación de escaneo QR\nPega/teclea el código de seco:");
  if (v) valCodigo.value = v;
});
formValidar.addEventListener("click", (e)=>{
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;
  if (btn.value === "save" && currentPendiente){
    const val = (valCodigo.value || "").trim();
    if (!val){ alert("Captura o escanea el código de seco."); return; }
    if (val !== currentPendiente.codigoSeco){
      alert("El código capturado no coincide con el código de seco del registro.");
      return;
    }
    const u = currentUser();
    const validado = {
      ...currentPendiente,
      validadoEn: new Date().toISOString(),
      validadoPorId: u?.id || null,
      validadoPorNombre: u?.name || "Controlista"
    };
    produccion.push(validado);
    saveJSON(LS_KEYS.PRODUCCION, produccion);
    pendientes = pendientes.filter(r => r.id !== currentPendiente.id);
    saveJSON(LS_KEYS.CONTROLISTAS, pendientes);
    modalValidar.close();
    currentPendiente = null;
    renderAll();
  }
  if (btn.value === "cancel"){ modalValidar.close(); currentPendiente = null; }
});

let currentInfoReg = null;
function openInfoRegistro(reg){
  currentInfoReg = reg;
  infoBody.innerHTML = `
    <dl>
      <dt>Línea (actual)</dt><dd>${reg.linea ?? "—"}</dd>
      <dt>Operador</dt><dd>${reg.operador ?? "—"}</dd>
      <dt>Código seco</dt><dd>${reg.codigoSeco ?? "—"}</dd>
      <dt>Cantidad</dt><dd>${reg.cantidad ?? "—"}</dd>
      <dt>Rack</dt><dd>${reg.rack ?? "—"}</dd>
      <dt>Posición</dt><dd>${reg.posicion ?? "—"}</dd>
      <dt>Registrado por</dt><dd>${reg.registradoPorNombre ?? "—"}</dd>
      <dt>Creado</dt><dd>${fmtDT(reg.creadoEn ?? new Date().toISOString())}</dd>
      ${reg.validadoPorNombre ? `<dt>Validado por</dt><dd>${reg.validadoPorNombre} (${fmtDT(reg.validadoEn)})</dd>` : ""}
    </dl>
  `;
  modalInfo.showModal();
}
infoActions.addEventListener("click", e=>{
  const btn = e.target.closest("button[data-linea]");
  if (!btn || !currentInfoReg) return;

  const lineaSel = parseInt(btn.dataset.linea, 10);
  const item = {
    id: currentInfoReg.id || crypto.randomUUID(),
    posicion: currentInfoReg.posicion,
    rack: currentInfoReg.rack,
    linea: lineaSel,
    refId: currentInfoReg.id,
    operador: currentInfoReg.operador,
    empleado: currentInfoReg.registradoPorId,
    codigoSeco: currentInfoReg.codigoSeco,
    cantidad: currentInfoReg.cantidad,
    creadoEn: currentInfoReg.creadoEn,
    registradoPorNombre: currentInfoReg.registradoPorNombre
  };

  const ret = loadJSON(LS_KEYS.RETIRAR, {1:[],2:[],3:[],4:[]});
  (ret[lineaSel] = ret[lineaSel] || []).push(item);
  saveJSON(LS_KEYS.RETIRAR, ret);

  const hist = loadJSON(LS_KEYS.RETIRAR_HIST, []);
  hist.push(item); saveJSON(LS_KEYS.RETIRAR_HIST, hist);

  produccion = produccion.filter(x => x.id !== currentInfoReg.id);
  saveJSON(LS_KEYS.PRODUCCION, produccion);

  alert(`Enviado a Retirar (Patineros) en Línea ${lineaSel}: ${item.posicion} • ${item.rack}`);
  modalInfo.close();
  currentInfoReg = null;
  renderAll();
});

/* ====== Indicadores de estado (pill) ====== */
function actualizarIndicadorPos(estado){
  const { cls, text } = estadoToBadge(estado);
  posEstadoIndicador.classList.remove("state-ok","state-busy","state-warn");
  posEstadoIndicador.classList.add(cls);
  posEstadoIndicador.textContent = text;
}
function actualizarIndicadorRack(estado){
  const { cls, text } = estadoToBadge(estado);
  rkEstadoIndicador.classList.remove("state-ok","state-busy","state-warn");
  rkEstadoIndicador.classList.add(cls);
  rkEstadoIndicador.textContent = text;
}

/* ====== Editores: Posiciones ====== */
let currentPosKey = null;
function openPosEditor(key){
  currentPosKey = key;
  posTitle.textContent = `Editar posición ${key}`;

  const estadoActual = obtenerEstadoPos(key);
  posEstado.value = estadoActual;
  actualizarIndicadorPos(estadoActual);

  const st = posStatus[key] || {};
  posObs.value = st.obs || "";
  posActuador.checked = !!st.actuador;
  posTarjeta.checked  = !!st.tarjeta;
  posAbraz.checked    = !!st.abrazaderas;
  posCable.checked    = !!st.cable_bajada;

  modalPos.showModal();
}
posEstado?.addEventListener("change", ()=>{
  actualizarIndicadorPos(posEstado.value);
});
formPos.addEventListener("click", (e)=>{
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;

  if (btn.value === "save" && currentPosKey){
    const estado = posEstado.value;

    enUso.posiciones = enUso.posiciones || {};
    if (estado === "disponible") delete enUso.posiciones[currentPosKey];
    else enUso.posiciones[currentPosKey] = true;
    saveJSON(LS_KEYS.EN_USO, enUso);

    posStatus[currentPosKey] = {
      ...(posStatus[currentPosKey] || {}),
      estado,
      actuador: !!posActuador.checked,
      tarjeta: !!posTarjeta.checked,
      abrazaderas: !!posAbraz.checked,
      cable_bajada: !!posCable.checked,
      obs: posObs.value.trim() || ""
    };
    saveJSON(LS_KEYS.STATUS_POS_DET, posStatus);

    modalPos.close();
    renderCatalogos();
  }
  if (btn.value === "cancel"){ modalPos.close(); }
});

/* ====== Editores: Racks ====== */
let currentRackKey = null;
function openRackEditor(key){
  currentRackKey = key;
  rackTitle.textContent = `Editar ${key}`;

  const estadoActual = obtenerEstadoRack(key);
  rkEstado.value = estadoActual;
  actualizarIndicadorRack(estadoActual);

  const st = rackStatus[key] || {};
  rkObs.value = st.obs || "";
  rkSoporte.checked = !!st.soporte_dren;
  rkPorta.checked   = !!st.porta_manguera;
  rkTina.checked    = !!st.tina;

  modalRack.showModal();
}
rkEstado?.addEventListener("change", ()=>{
  actualizarIndicadorRack(rkEstado.value);
});
formRack.addEventListener("click", (e)=>{
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;

  if (btn.value === "save" && currentRackKey){
    const estado = rkEstado.value; // 'disponible' | 'en_uso' | 'mantenimiento'

    enUso.racks = enUso.racks || {};
    if (estado === "disponible") delete enUso.racks[currentRackKey];
    else enUso.racks[currentRackKey] = true;
    saveJSON(LS_KEYS.EN_USO, enUso);

    rackStatus[currentRackKey] = {
      ...(rackStatus[currentRackKey] || {}),
      estado,
      soporte_dren: !!rkSoporte.checked,
      porta_manguera: !!rkPorta.checked,
      tina: !!rkTina.checked,
      obs: rkObs.value.trim() || ""
    };
    saveJSON(LS_KEYS.STATUS_RACKS_DET, rackStatus);

    modalRack.close();
    renderCatalogos();
  }
  if (btn.value === "cancel"){ modalRack.close(); }
});

/* ====== Inicial ====== */
function renderAll(){
  pendientes = loadJSON(LS_KEYS.CONTROLISTAS, []);
  produccion = loadJSON(LS_KEYS.PRODUCCION, []);
  retirar    = loadJSON(LS_KEYS.RETIRAR, {1:[],2:[],3:[],4:[]});
  retirarHist= loadJSON(LS_KEYS.RETIRAR_HIST, []);
  posStatus  = loadJSON(LS_KEYS.STATUS_POS_DET, {});
  rackStatus = loadJSON(LS_KEYS.STATUS_RACKS_DET, {});
  comentarios= loadJSON(LS_KEYS.COMMENTS, []);
  comentariosLeidos = loadJSON(LS_KEYS.COMMENTS_READ, []);
  enUso      = loadJSON(LS_KEYS.EN_USO, {posiciones:{}, racks:{}});

  renderPendientes();
  renderProduccion();
  renderHistorialSalidas();
  renderCatalogos();
  renderComentarios();
}
renderAll();
setInterval(renderAll, 4000);

window.addEventListener("storage", (e)=>{
  if (e.key === LS_KEYS.COMMENTS || e.key === LS_KEYS.COMMENTS_READ || e.key === "comment_read_ping") {
    renderComentarios();
  }
});
