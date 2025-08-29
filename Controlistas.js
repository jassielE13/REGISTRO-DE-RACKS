const LS_KEYS = {
  CONTROLISTAS: "controlistas_pendientes",
  EN_USO: "en_uso",
  RETIRAR: "retirar_listas",
  SALIDAS: "salidas_listas"
};
function loadJSON(key, fallback) { try{const r=localStorage.getItem(key); return r?JSON.parse(r):fallback;}catch{return fallback;} }
function saveJSON(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

let controlistasPend = loadJSON(LS_KEYS.CONTROLISTAS, []);
let retirarListas = loadJSON(LS_KEYS.RETIRAR, {1:[],2:[],3:[]});
let salidasListas = loadJSON(LS_KEYS.SALIDAS, {1:[],2:[],3:[]});
let enUso = loadJSON(LS_KEYS.EN_USO, { posiciones:{}, racks:{} });

const tbodyPend = document.querySelector("#tablaPendientes tbody");
const tbodyRet1 = document.querySelector("#tablaRet1 tbody");
const tbodyRet2 = document.querySelector("#tablaRet2 tbody");
const tbodyRet3 = document.querySelector("#tablaRet3 tbody");
const tbodySal1 = document.querySelector("#tablaSal1 tbody");
const tbodySal2 = document.querySelector("#tablaSal2 tbody");
const tbodySal3 = document.querySelector("#tablaSal3 tbody");
const tbodyPos = document.querySelector("#tablaPos tbody");
const tbodyRack = document.querySelector("#tablaRack tbody");

function fmtDate(iso){ const d=new Date(iso||Date.now()); return d.toLocaleString([], { dateStyle:'short', timeStyle:'short' }); }
function pad3(n){ return String(n).padStart(3,"0"); }
function generatePosList(){ const a=[]; for(let i=1;i<=450;i++) a.push(`P${pad3(i)}`); return a; }
function generateRackList(){ const a=[]; for(let i=1;i<=435;i++) a.push(`Rack${pad3(i)}`); return a; }

// Enviar pendiente a Retirar (línea 1–3)
function enviarARetirar(pend, lineaSalida){
  if (!retirarListas[lineaSalida]) retirarListas[lineaSalida] = [];
  retirarListas[lineaSalida].push({
    posicion: pend.posicion,
    rack: pend.rack,
    linea: lineaSalida,
    refId: pend.id
  });
  saveJSON(LS_KEYS.RETIRAR, retirarListas);

  pend._estado = "enviado";
  saveJSON(LS_KEYS.CONTROLISTAS, controlistasPend);
  renderAll();
}

function eliminarPendiente(pendId){
  controlistasPend = controlistasPend.filter(p => p.id !== pendId);
  saveJSON(LS_KEYS.CONTROLISTAS, controlistasPend);
  renderAll();
}

function renderPendientes(){
  tbodyPend.innerHTML = "";
  if (!controlistasPend.length){
    tbodyPend.innerHTML = `<tr><td colspan="9" style="text-align:center;opacity:.7">Sin pendientes</td></tr>`;
    return;
  }
  controlistasPend.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(p.creadoEn)}</td>
      <td>${p.linea ?? "-"}</td>
      <td>${p.operador ?? "-"}</td>
      <td>${p.codigoSeco ?? "-"}</td>
      <td>${p.cantidad ?? "-"}</td>
      <td>${p.rack ?? "-"}</td>
      <td>${p.posicion ?? "-"}</td>
      <td>${p.registradoPorNombre ?? "-"}</td>
      <td></td>
    `;

    const box = document.createElement("div");
    box.style.display = "flex";
    box.style.gap = ".35rem";
    [1,2,3].forEach(n => {
      const btn = document.createElement("button");
      btn.className = "small primary";
      btn.textContent = `Enviar a ${n}`;
      btn.addEventListener("click", () => enviarARetirar(p, n));
      box.appendChild(btn);
    });
    const del = document.createElement("button");
    del.className = "small secondary";
    del.textContent = "Quitar";
    del.addEventListener("click", () => eliminarPendiente(p.id));
    box.appendChild(del);

    if (p._estado === "enviado"){
      const chip = document.createElement("span");
      chip.textContent = "Enviado";
      chip.style.marginLeft = ".4rem";
      chip.style.fontWeight = "700";
      chip.style.color = "var(--brand-2)";
      box.appendChild(chip);
    }

    tr.children[8].appendChild(box);
    tbodyPend.appendChild(tr);
  });
}


function renderRetirar(){
  function fill(tbody, items){
    tbody.innerHTML = "";
    if (!items || !items.length){
      tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;opacity:.7">Sin elementos</td></tr>`;
      return;
    }
    items.forEach(it=>{
      const tr=document.createElement("tr");
      tr.innerHTML = `<td>${it.posicion}</td><td>${it.rack}</td>`;
      tbody.appendChild(tr);
    });
  }
  fill(tbodyRet1, retirarListas[1]);
  fill(tbodyRet2, retirarListas[2]);
  fill(tbodyRet3, retirarListas[3]);
}

function renderSalidas(){
  function fill(tbody, lista){
    tbody.innerHTML = "";
    if (!lista || !lista.length){
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;opacity:.7">Sin elementos</td></tr>`;
      return;
    }
    lista.forEach(reg=>{
      const entradaTxt = reg.entrada ? `${reg.entrada.byName||"-"} • ${new Date(reg.entrada.at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : "—";
      const salidaTxt  = reg.salida  ? `${reg.salida.byName||"-"} • ${new Date(reg.salida.at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : "—";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${reg.posicion}</td><td>${reg.rack}</td><td>${entradaTxt}</td><td>${salidaTxt}</td>`;
      tbody.appendChild(tr);
    });
  }
  fill(tbodySal1, salidasListas[1]);
  fill(tbodySal2, salidasListas[2]);
  fill(tbodySal3, salidasListas[3]);
}

function renderInventario(){
  tbodyPos.innerHTML = "";
  generatePosList().forEach(p=>{
    const libre = !enUso.posiciones[p];
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p}</td><td class="${libre?'ok':'busy'}">${libre?'Libre':'Ocupada'}</td>`;
    tbodyPos.appendChild(tr);
  });

  tbodyRack.innerHTML = "";
  generateRackList().forEach(r=>{
    const libre = !enUso.racks[r];
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r}</td><td class="${libre?'ok':'busy'}">${libre?'Listo':'En uso'}</td>`;
    tbodyRack.appendChild(tr);
  });
}

function renderAll(){
  // refrescar por si Patineros cambió algo
  controlistasPend = loadJSON(LS_KEYS.CONTROLISTAS, []);
  retirarListas = loadJSON(LS_KEYS.RETIRAR, {1:[],2:[],3:[]});
  salidasListas = loadJSON(LS_KEYS.SALIDAS, {1:[],2:[],3:[]});
  enUso = loadJSON(LS_KEYS.EN_USO, { posiciones:{}, racks:{} });

  renderPendientes();
  renderRetirar();
  renderSalidas();
  renderInventario();
}

renderAll();
setInterval(renderAll, 10000);

// Comentarios (placeholder)
document.getElementById("formComentario")?.addEventListener("submit", (e)=>{
  e.preventDefault();
  alert("Comentario enviado (demo).");
});
