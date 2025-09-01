// ====== Keys ======
const LS_KEYS = {
  CONTROLISTAS: "controlistas_pendientes",
  PRODUCCION:   "controlistas_produccion",
  RETIRAR:      "retirar_listas",        // usado por Patineros (activo)
  RETIRAR_HIST: "retirar_historial_all", // histórico Controlistas
  STATUS_POS_DET:  "status_posiciones_detalle",
  STATUS_RACKS_DET: "status_racks_detalle",
  COMMENTS:     "comentarios",
  COMMENTS_READ:"comentarios_leidos",
  EN_USO:       "en_uso",                // {posiciones:{}, racks:{}}
  HIST:         "historial_movimientos"
};

// ====== Utils ======
const $ = (sel, root=document)=> root.querySelector(sel);
const $$ = (sel, root=document)=> Array.from(root.querySelectorAll(sel));
function loadJSON(k, fb){ try{ const r=localStorage.getItem(k); return r?JSON.parse(r):fb; }catch{return fb;} }
function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
function pad3(n){ return String(n).padStart(3,"0"); }
function fmtDT(iso){ const d=new Date(iso); return d.toLocaleString(); }
function currentUser(){ try{return JSON.parse(localStorage.getItem("CURRENT_USER")||"null");}catch{return null;} }

// ====== Estado ======
let pendientes = loadJSON(LS_KEYS.CONTROLISTAS, []);
let produccion = loadJSON(LS_KEYS.PRODUCCION, []);
let retirar    = loadJSON(LS_KEYS.RETIRAR, {1:[],2:[],3:[],4:[]});
let retirarHist= loadJSON(LS_KEYS.RETIRAR_HIST, []);
let posStatus  = loadJSON(LS_KEYS.STATUS_POS_DET, {});  // P001:{estado, actuador, tarjeta, abrazaderas, cable_bajada, obs}
let rackStatus = loadJSON(LS_KEYS.STATUS_RACKS_DET, {});// Rack001:{estado, soporte_dren, porta_manguera, tina, obs}
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
const ulRet = { 1: $("#ulRet1"), 2: $("#ulRet2"), 3: $("#ulRet3") };
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

// Modal Info
const modalInfo = $("#modalInfo");
const infoBody  = $("#infoBody");
const infoActions = $("#infoActions");

// Modales Pos/Rack
const modalPos  = $("#modalPos");
const posTitle  = $("#posTitle");
const formPos   = $("#formPos");
const posEstado = $("#posEstado");
const posObs    = $("#posObs");
const posActuador = $("#posActuador");
const posTarjeta  = $("#posTarjeta");
const posAbraz    = $("#posAbraz");
const posCable    = $("#posCable");

const modalRack = $("#modalRack");
const rackTitle = $("#rackTitle");
const formRack  = $("#formRack");
const rkEstado  = $("#rkEstado");
const rkObs     = $("#rkObs");
const rkSoporte = $("#rkSoporte");
const rkPorta   = $("#rkPorta");
const rkTina    = $("#rkTina");

// ====== Renders ======
function renderPendientes(){
  const byLine = {1:[],2:[],3:[],4:[]};
  pendientes.forEach(r => (byLine[r.linea] = byLine[r.linea] || []).push(r));

  [1,2,3,4].forEach(l => {
    const tb = tblPend[l]; tb.innerHTML = "";
    const arr = byLine[l] || [];
    if (!arr.length){
      tb.innerHTML = `<tr><td colspan="8" style="text-align:center;opacity:.7">Sin pendientes</td></tr>`;
      return;
    }
    arr.forEach(reg => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtDT(reg.creadoEn)}</td>
        <td>${reg.operador}</td>
        <td>${reg.codigoSeco}</td>
        <td>${reg.cantidad ?? "—"}</td>
        <td>${reg.rack}</td>
        <td>${reg.posicion}</td>
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
    updateProdTotal();
    return;
  }

  // Agrupar por código de seco
  const grupos = {};
  produccion.forEach(r => {
    const key = r.codigoSeco || "Sin código";
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(r);
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
        <td>${reg.operador}</td>
        <td>${reg.codigoSeco}</td>
        <td>${reg.cantidad ?? "—"}</td>
        <td>${reg.rack}</td>
        <td>${reg.posicion}</td>
        <td>${reg.validadoPorNombre ?? "—"}</td>
      `;
      tr.addEventListener("click", ()=> openInfoRegistro(reg));
      tblProdAll.appendChild(tr);
    });
  });

  updateProdTotal();
}

// RETIRAR — histórico permanente (1–3)
function renderRetirar(){
  const byLine = {1:[],2:[],3:[]};
  (retirarHist || []).forEach(it => {
    const ln = Number(it.linea);
    if (ln>=1 && ln<=3) byLine[ln].push(it);
  });

  [1,2,3].forEach(l => {
    const ul = ulRet[l]; ul.innerHTML = "";
    const arr = (byLine[l] || []).slice().sort((a,b)=> new Date(b.creadoEn) - new Date(a.creadoEn));
    if (!arr.length){
      ul.innerHTML = `<li style="opacity:.7">Sin elementos</li>`;
      return;
    }
    arr.forEach(it => {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${it.posicion} • ${it.rack}</strong>
        <small>Creado: ${fmtDT(it.creadoEn)} — Operador: ${it.operador ?? "—"} — Código: ${it.codigoSeco ?? "—"} — Cant.: ${it.cantidad ?? "—"}</small>
        <small>Registrado por: ${it.registradoPorNombre ?? "—"}</small>
      `;
      li.addEventListener("click", ()=> openInfoRegistro(it));
      ul.appendChild(li);
    });
  });
}

/* ==== POSICIONES / RACKS estilo Patineros + buscador ==== */
function tileHTML(label, ocupado){
  const stateClass = ocupado ? 'state-busy' : 'state-ok';
  const stateText  = ocupado ? 'Ocupada' : 'Disponible';
  return `
    <div class="tile-title">${label}</div>
    <div class="tile-state ${stateClass}">${stateText}</div>
  `;
}

function renderPosCatalogo(filter=""){
  gridPos.innerHTML = "";
  const f = (filter||"").toLowerCase().trim();
  for (let i=1;i<=450;i++){
    const key = "P"+pad3(i);
    if (f && !key.toLowerCase().includes(f)) continue;
    const ocupado = !!enUso.posiciones?.[key];
    const li = document.createElement("li");
    li.innerHTML = tileHTML(key, ocupado);
    li.addEventListener("click", ()=> openPosEditor(key));
    gridPos.appendChild(li);
  }
}
function renderRackCatalogo(filter=""){
  gridRack.innerHTML = "";
  const f = (filter||"").toLowerCase().trim();
  for (let i=1;i<=435;i++){
    const key = "Rack"+pad3(i);
    if (f && !key.toLowerCase().includes(f)) continue;
    const ocupado = !!enUso.racks?.[key];
    const li = document.createElement("li");
    li.innerHTML = tileHTML(key, ocupado);
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

function renderComentarios(){
  ulComentarios.innerHTML = "";
  ulComentariosLeidos.innerHTML = "";
  if (!comentarios.length){
    ulComentarios.innerHTML = `<li style="opacity:.7">Sin comentarios pendientes</li>`;
  } else {
    comentarios.slice().reverse().forEach(c => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="row">
          <strong>${c.by || "Patinero"}</strong>
          <small>${fmtDT(c.at)}</small>
        </div>
        <div>${c.text}</div>
        <div class="actions end"><button class="ghost">Leído</button></div>
      `;
      li.querySelector("button").addEventListener("click", ()=>{
        comentarios = comentarios.filter(x => x !== c);
        comentariosLeidos.push(c);
        saveJSON(LS_KEYS.COMMENTS, comentarios);
        saveJSON(LS_KEYS.COMMENTS_READ, comentariosLeidos);
        renderComentarios();
      });
      ulComentarios.appendChild(li);
    });
  }
  if (!comentariosLeidos.length){
    ulComentariosLeidos.innerHTML = `<li style="opacity:.7">Sin comentarios leídos</li>`;
  } else {
    comentariosLeidos.slice().reverse().forEach(c => {
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
  renderRetirar();
  renderCatalogos();
  renderComentarios();
}

// ====== Validar (Pendientes) ======
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

// ====== Info producción/retirar (elegir línea 1–3 y mandar a Patineros) ======
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

  // 1) Enviar a Patineros (activo)
  const arr = retirar[lineaSel] = retirar[lineaSel] || [];
  const exists = arr.some(x => x.posicion === item.posicion && x.rack === item.rack && x.creadoEn === item.creadoEn);
  if (!exists) arr.push(item);
  saveJSON(LS_KEYS.RETIRAR, retirar);

  // 2) Guardar histórico Controlistas
  const hist = loadJSON(LS_KEYS.RETIRAR_HIST, []);
  const histExists = hist.some(x =>
    x.posicion === item.posicion && x.rack === item.rack && x.creadoEn === item.creadoEn && x.linea === item.linea
  );
  if (!histExists) {
    hist.push(item);
    saveJSON(LS_KEYS.RETIRAR_HIST, hist);
    retirarHist = hist;
  }

  // 3) Quitar de Producción
  produccion = produccion.filter(x => x.id !== currentInfoReg.id);
  saveJSON(LS_KEYS.PRODUCCION, produccion);

  alert(`Enviado a Retirar (Patineros) en Línea ${lineaSel}: ${item.posicion} • ${item.rack}`);
  modalInfo.close();
  currentInfoReg = null;
  renderAll();
});

// ====== Editores: Posiciones / Racks ======
let currentPosKey = null;
function openPosEditor(key){
  currentPosKey = key;
  posTitle.textContent = `Editar posición ${key}`;

  // estado actual (desde en_uso y status detalle)
  const enUsoActual = !!enUso.posiciones?.[key];
  posEstado.value = enUsoActual ? "ocupada" : "disponible";

  const st = posStatus[key] || {};
  posObs.value = st.obs || "";
  posActuador.checked = !!st.actuador;
  posTarjeta.checked  = !!st.tarjeta;
  posAbraz.checked    = !!st.abrazaderas;
  posCable.checked    = !!st.cable_bajada;

  modalPos.showModal();
}
formPos.addEventListener("click", (e)=>{
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;

  if (btn.value === "save" && currentPosKey){
    // estado -> en_uso
    const ocupado = posEstado.value === "ocupada";
    enUso.posiciones = enUso.posiciones || {};
    if (ocupado) enUso.posiciones[currentPosKey] = true;
    else delete enUso.posiciones[currentPosKey];
    saveJSON(LS_KEYS.EN_USO, enUso);

    // detalle + observaciones
    posStatus[currentPosKey] = {
      estado: ocupado ? "ocupada" : "disponible",
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

let currentRackKey = null;
function openRackEditor(key){
  currentRackKey = key;
  rackTitle.textContent = `Editar ${key}`;

  const enUsoActual = !!enUso.racks?.[key];
  rkEstado.value = enUsoActual ? "ocupado" : "disponible";

  const st = rackStatus[key] || {};
  rkObs.value = st.obs || "";
  rkSoporte.checked = !!st.soporte_dren;
  rkPorta.checked   = !!st.porta_manguera;
  rkTina.checked    = !!st.tina;

  modalRack.showModal();
}
formRack.addEventListener("click", (e)=>{
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;

  if (btn.value === "save" && currentRackKey){
    const ocupado = rkEstado.value === "ocupado";
    enUso.racks = enUso.racks || {};
    if (ocupado) enUso.racks[currentRackKey] = true;
    else delete enUso.racks[currentRackKey];
    saveJSON(LS_KEYS.EN_USO, enUso);

    rackStatus[currentRackKey] = {
      estado: ocupado ? "ocupado" : "disponible",
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

// ====== Inicial ======
renderAll();
setInterval(renderAll, 4000);
