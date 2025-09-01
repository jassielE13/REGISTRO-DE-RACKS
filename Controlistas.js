// ====== Keys ======
const LS_KEYS = {
  CONTROLISTAS: "controlistas_pendientes",   // enviados por Patineros (pendientes de validar)
  PRODUCCION:   "controlistas_produccion",    // validados por Controlista
  RETIRAR:      "retirar_listas",             // {1:[],2:[],3:[],4:[]}  —— usado por Patineros (activo)
  RETIRAR_HIST: "retirar_historial_all",      // [] historial permanente mostrado en Controlistas
  STATUS_POS_DET:  "status_posiciones_detalle",
  STATUS_RACKS_DET: "status_racks_detalle",
  COMMENTS:     "comentarios",
  COMMENTS_READ:"comentarios_leidos",
  EN_USO:       "en_uso",                     // {posiciones:{}, racks:{}}
  HIST:         "historial_movimientos"       // [{rack,posicion,evento,by,at,extra}]
};

// ====== Utils ======
const $ = (sel, root=document)=> root.querySelector(sel);
const $$ = (sel, root=document)=> Array.from(root.querySelectorAll(sel));
function loadJSON(k, fb){ try{ const r=localStorage.getItem(k); return r?JSON.parse(r):fb; }catch{return fb;} }
function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
function pad3(n){ return String(n).padStart(3,"0"); }
function fmtDT(iso){ const d=new Date(iso); return d.toLocaleString(); }
function simulateQRScan(ph=""){ const v = prompt("Simulación de escaneo QR\nPega/teclea el valor:", ph); return v || ""; }
function currentUser(){ try{return JSON.parse(localStorage.getItem("CURRENT_USER")||"null");}catch{return null;} }
function anyTrue(obj){ return !!obj && Object.values(obj).some(v=>v===true); }

// ====== Estado ======
let pendientes = loadJSON(LS_KEYS.CONTROLISTAS, []);
let produccion = loadJSON(LS_KEYS.PRODUCCION, []);
let retirar    = loadJSON(LS_KEYS.RETIRAR, {1:[],2:[],3:[],4:[]}); // ACTIVO (Patineros)
let retirarHist = loadJSON(LS_KEYS.RETIRAR_HIST, []);              // Histórico para vista Controlistas
let posStatus  = loadJSON(LS_KEYS.STATUS_POS_DET, {});
let rackStatus = loadJSON(LS_KEYS.STATUS_RACKS_DET, {});
let comentarios= loadJSON(LS_KEYS.COMMENTS, []);
let comentariosLeidos = loadJSON(LS_KEYS.COMMENTS_READ, []);
let enUso      = loadJSON(LS_KEYS.EN_USO, {posiciones:{}, racks:{}});
let historial  = loadJSON(LS_KEYS.HIST, []); // (Patineros lo llena al dar entrada/salida)

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
const ulComentarios = $("#ulComentarios");
const ulComentariosLeidos = $("#ulComentariosLeidos");

// Modales
const modalValidar = $("#modalValidar");
const formValidar = $("#formValidar");
const valResumen = $("#valResumen");
const valDetalle = $("#valDetalle");
const valChips   = $("#valChips");
const valCodigo  = $("#valCodigo");
const btnScanVal = $("#btnScanVal");

const modalInfo = $("#modalInfo");
const infoBody  = $("#infoBody");
const infoActions = $("#infoActions");

const modalPos  = $("#modalPos");
const posTitle  = $("#posTitle");
const formPos   = $("#formPos");
const posAct    = $("#posActuador");
const posTar    = $("#posTarjeta");
const posAbr    = $("#posAbraz");
const posCab    = $("#posCable");
const posResp   = $("#posResp");
const posObs    = $("#posObs");

const modalRack = $("#modalRack");
const rackTitle = $("#rackTitle");
const formRack  = $("#formRack");
const rkSup     = $("#rkSoporte");
const rkPor     = $("#rkPorta");
const rkTin     = $("#rkTina");
const rkResp    = $("#rkResp");
const rkObs     = $("#rkObs");

// ====== Helpers ======
function groupByLinea(arr){
  const map = {1:[],2:[],3:[],4:[]};
  arr.forEach(r => { (map[r.linea] = map[r.linea] || []).push(r); });
  return map;
}
function buildStatusChipsHTML(reg){
  const pos = reg.posicion;
  const rack = reg.rack;
  const posOcup = !!enUso.posiciones?.[pos];
  const rackOcup = !!enUso.racks?.[rack];
  const posDet = posStatus[pos] || {};
  const rackDet = rackStatus[rack] || {};
  const posDamage = anyTrue(posDet);
  const rackDamage = anyTrue(rackDet);
  const posMain = `<span class="chip stat ${posOcup?'busy':'ok'}">${pos} • ${posOcup?'Ocupada':'Libre'}</span>`;
  const rackMain= `<span class="chip stat ${rackOcup?'busy':'ok'}">${rack} • ${rackOcup?'En uso':'Listo'}</span>`;
  const posDmg  = posDamage ? `<span class="chip stat warn">Posición con daños</span>` : '';
  const rackDmg = rackDamage ? `<span class="chip stat warn">Rack con daños</span>` : '';
  return `${posMain} ${posDmg} ${rackMain} ${rackDmg}`;
}

// ====== Renders ======
function renderPendientes(){
  const byLine = groupByLinea(pendientes);
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
    // separador
    const sep = document.createElement("tr");
    sep.classList.add("tr-separator");
    sep.innerHTML = `<td colspan="8">Código de seco: ${codigo}</td>`;
    tblProdAll.appendChild(sep);

    // registros del grupo
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
      li.addEventListener("click", ()=> openInfoRegistro(it)); // abre detalle (sin historial)
      ul.appendChild(li);
    });
  });
}

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

function renderCatalogos(){
  gridPos.innerHTML = "";
  for (let i=1;i<=450;i++){
    const key = "P"+pad3(i);
    const li = document.createElement("li");
    li.textContent = key;
    li.addEventListener("click", ()=> openPosEditor(key));
    gridPos.appendChild(li);
  }
  gridRack.innerHTML = "";
  for (let i=1;i<=435;i++){
    const key = "Rack"+pad3(i);
    const li = document.createElement("li");
    li.textContent = key;
    li.addEventListener("click", ()=> openRackEditor(key));
    gridRack.appendChild(li);
  }
}

function renderAll(){
  pendientes = loadJSON(LS_KEYS.CONTROLISTAS, []);
  produccion = loadJSON(LS_KEYS.PRODUCCION, []);
  retirar    = loadJSON(LS_KEYS.RETIRAR, {1:[],2:[],3:[],4:[]}); // activo (Patineros)
  retirarHist= loadJSON(LS_KEYS.RETIRAR_HIST, []);               // histórico Controlistas
  posStatus  = loadJSON(LS_KEYS.STATUS_POS_DET, {});
  rackStatus = loadJSON(LS_KEYS.STATUS_RACKS_DET, {});
  comentarios= loadJSON(LS_KEYS.COMMENTS, []);
  comentariosLeidos = loadJSON(LS_KEYS.COMMENTS_READ, []);
  enUso      = loadJSON(LS_KEYS.EN_USO, {posiciones:{}, racks:{}});
  historial  = loadJSON(LS_KEYS.HIST, []);

  renderPendientes();
  renderProduccion();
  renderRetirar();
  renderComentarios();
  renderCatalogos();
}

// ====== Modales ======
// Validar (Pendientes)
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
  valChips.innerHTML = buildStatusChipsHTML(reg);
  valCodigo.value = "";
  modalValidar.showModal();
}
btnScanVal.addEventListener("click", ()=>{
  const v = simulateQRScan(currentPendiente?.codigoSeco || "");
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

// Info (Producción / Retirar) —— sin historial visual
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

// Botones: mandar a Retirar (Líneas 1–3) —> Patineros (activo) + histórico Controlistas
infoActions.addEventListener("click", e=>{
  const btn = e.target.closest("button[data-linea]");
  if (!btn || !currentInfoReg) return;

  const lineaSel = parseInt(btn.dataset.linea, 10);

  const item = {
    id: currentInfoReg.id || crypto.randomUUID(),
    posicion: currentInfoReg.posicion,
    rack: currentInfoReg.rack,
    linea: lineaSel,                    // línea de salida elegida (1–3)
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

  // 2) Guardar en histórico para vista Controlistas
  const histExists = retirarHist.some(x =>
    x.posicion === item.posicion && x.rack === item.rack && x.creadoEn === item.creadoEn && x.linea === item.linea
  );
  if (!histExists) {
    retirarHist.push(item);
    saveJSON(LS_KEYS.RETIRAR_HIST, retirarHist);
  }

  // 3) Quitar de Producción si venía de ahí
  produccion = produccion.filter(x => x.id !== currentInfoReg.id);
  saveJSON(LS_KEYS.PRODUCCION, produccion);

  alert(`Enviado a Retirar (Patineros) en Línea ${lineaSel}: ${item.posicion} • ${item.rack}`);
  modalInfo.close();
  currentInfoReg = null;
  renderAll();
});

// Posiciones (modal editor)
let currentPosKey = null;
function openPosEditor(key){
  currentPosKey = key;
  posTitle.textContent = `Editar posición ${key}`;
  const st = (posStatus[key] = posStatus[key] || {});
  posAct.checked = !!st.actuador;
  posTar.checked = !!st.tarjeta;
  posAbr.checked = !!st.abrazaderas;
  posCab.checked = !!st.cable_bajada;
  posResp.value = st.responsable || "";
  posObs.value = st.observaciones || "";
  modalPos.showModal();
}
formPos.addEventListener("click", (e)=>{
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;
  if (btn.value === "save" && currentPosKey){
    posStatus[currentPosKey] = {
      actuador: !!posAct.checked,
      tarjeta: !!posTar.checked,
      abrazaderas: !!posAbr.checked,
      cable_bajada: !!posCab.checked,
      responsable: posResp.value.trim() || null,
      observaciones: posObs.value.trim() || null
    };
    saveJSON(LS_KEYS.STATUS_POS_DET, posStatus);
    modalPos.close();
  }
  if (btn.value === "cancel"){ modalPos.close(); }
});

// Racks (modal editor)
let currentRackKey = null;
function openRackEditor(key){
  currentRackKey = key;
  rackTitle.textContent = `Editar ${key}`;
  const st = (rackStatus[key] = rackStatus[key] || {});
  rkSup.checked = !!st.soporte_dren;
  rkPor.checked = !!st.porta_manguera;
  rkTin.checked = !!st.tina;
  rkResp.value = st.responsable || "";
  rkObs.value = st.observaciones || "";
  modalRack.showModal();
}
formRack.addEventListener("click", (e)=>{
  const btn = e.target;
  if (!(btn instanceof HTMLButtonElement)) return;
  if (btn.value === "save" && currentRackKey){
    rackStatus[currentRackKey] = {
      soporte_dren: !!rkSup.checked,
      porta_manguera: !!rkPor.checked,
      tina: !!rkTin.checked,
      responsable: rkResp.value.trim() || null,
      observaciones: rkObs.value.trim() || null
    };
    saveJSON(LS_KEYS.STATUS_RACKS_DET, rackStatus);
    modalRack.close();
  }
  if (btn.value === "cancel"){ modalRack.close(); }
});

function updateProdTotal(){
  const el = $("#prodTotal");
  if (!el) return;
  const total = (produccion || []).reduce((sum, r) => {
    const n = parseFloat(r?.cantidad);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  el.textContent = `Total: ${total}`;
}

// ====== Inicial ======
renderAll();
// refresco por si Patineros mueve estado en otros equipos
setInterval(renderAll, 4000);
