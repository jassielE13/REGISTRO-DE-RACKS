// ========== Controlistas.js ==========
const K={
  PEND:"controlistas_pendientes",ARR:"controlistas_arranque",ORD:"controlistas_ordenes",
  CON:"controlistas_confirm",PROD:"controlistas_produccion",RET:"retirar_listas",
  RETH:"retirar_historial_all",PSTAT:"status_posiciones_detalle",RSTAT:"status_racks_detalle",
  COM:"comentarios",COMR:"comentarios_leidos",USE:"en_uso"
};
const $=(s,r=document)=>r.querySelector(s),
      $$=(s,r=document)=>Array.from(r.querySelectorAll(s)),
      J=(k,f)=>{try{let v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{return f}},
      S=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const pad=n=>String(n).padStart(3,"0"),
      now=()=>new Date().toISOString(),
      dt=s=>{if(!s)return"—";let d=new Date(s);return isNaN(d)?"—":d.toLocaleString()},
      cur=()=>{try{return JSON.parse(localStorage.getItem("CURRENT_USER")||"null")}catch{return null}},
      isoLocal=t=>{if(!t)return now();let d=new Date(t);return isNaN(d)?now():d.toISOString()},
      hms=ms=>{if(ms<0)ms=0;let s=Math.floor(ms/1e3),h=String(Math.floor(s/3600)).padStart(2,"0"),m=String(Math.floor(s%3600/60)).padStart(2,"0"),se=String(s%60).padStart(2,"0");return`${h}:${m}:${se}`};

// ===== broadcast racks (observaciones)
const RACKS_STATUS_CH = new BroadcastChannel('racks-status-updates');

let P=J(K.PEND,[]),A=J(K.ARR,[]),O=J(K.ORD,[]),C=J(K.CON,[]),PR=J(K.PROD,[]),
    PS=J(K.PSTAT,{}),RS=J(K.RSTAT,{}),EU=J(K.USE,{posiciones:{},racks:{}});

// Sidebar
const mT=$("#menuToggle"), sb=$("#sidebar"), bd=$("#backdrop");
function menu(o){document.body.classList.toggle("menu-open",!!o); sb?.setAttribute("aria-hidden",o?"false":"true"); mT?.setAttribute("aria-expanded",o?"true":"false"); bd.hidden=!o}
mT?.addEventListener("click",()=>menu(!document.body.classList.contains("menu-open")));
bd?.addEventListener("click",()=>menu(false));
$$(".sidenav a").forEach(a=>a.addEventListener("click",()=>menu(false)));

// ===== Secciones: solo una visible
const SECTIONS = $$("main .panel");
function showOnly(hash){
  const h = (hash || location.hash || "#validar").toLowerCase();
  const id = h.replace(/^#/, "");
  let shown=false;
  SECTIONS.forEach(sec=>{
    if(sec.id===id){sec.hidden=false; shown=true;}
    else sec.hidden=true;
  });
  if(!shown){ const v=$("#validar"); if(v) v.hidden=false; }
  markActive();
  if(h==="#home") renderHome();
  if(h==="#confirmacion") rCon();
  if(h==="#status") renderStatus();
}
window.addEventListener("hashchange", ()=>showOnly());
document.addEventListener("DOMContentLoaded", ()=>showOnly());

// Topnav activo
function markActive(){
  const h=(location.hash||"").toLowerCase()||"#validar";
  $$(".topnav a").forEach(a=>a.classList.toggle("active", a.getAttribute("href").toLowerCase()===h));
}

// ======= Tabs Validación: mostrar un pane a la vez =======
(function wireTabs(){
  const group = $("#valTabs");
  if(!group) return;
  const radios = $$('input[type="radio"]', group);
  const panes = $$('.tab-content .tab-pane', group);
  function sync(){
    let idx = radios.findIndex(r=>r.checked);
    if(idx<0) idx=0;
    panes.forEach((p,i)=> p.style.display = (i===idx)?'block':'none');
  }
  radios.forEach(r=>r.addEventListener('change', sync));
  sync();
})();

// ==== Refs ====
const TP={1:$("#tblPend1 tbody"),2:$("#tblPend2 tbody"),3:$("#tblPend3 tbody"),4:$("#tblPend4 tbody")},
      TA=$("#tblArranque tbody"), TO=$("#tblOrdenes tbody"), TC=$("#tblConfirm tbody"),
      TPA=$("#tblProdAll tbody"), PT=$("#prodTotal"), CHK_ALL=$("#chkAll"),
      SEL_COUNT=$("#selCount"), SEND1=$("#sendL1"), SEND2=$("#sendL2"), SEND3=$("#sendL3");

const TH=$("#tblHistAll tbody"), HR=$("#histRange"), SR=$("#shiftRange"), CSV=$("#histCSV");

const GP=$("#gridPos"), GR=$("#gridRack"), PSR=$("#posSearch"), RSR=$("#rackSearch");

const MDV=$("#modalValidar"), FMV=$("#formValidar"), VRES=$("#valResumen"), VDET=$("#valDetalle"), VCH=$("#valChips"),
      VC=$("#valCodigo"), VPOS=$("#valPosicion"), VRK=$("#valRack"),
      BTN_SCAN_POS=$("#btnScanPos"), BTN_SCAN_RK=$("#btnScanRack"), BTN_SCAN_CODE=$("#btnScanVal");

const MDA=$("#modalArranque"), FMA=$("#formArranque");
const MDI=$("#modalInfo"), IB=$("#infoBody");
const MDH=$("#modalHistInfo"), HIB=$("#histInfoBody");

// ====== ESCÁNER (Quagga) ======
const SCAN_MODAL = $("#scannerModal");
const SCAN_STATUS = $("#scanStatus");
const CAMERA_SELECT = $("#cameraSelect");
const SCAN_VIEWPORT = $("#scannerViewport");
let scanTargetInput = null;
let quaggaRunning = false;

function setScanStatus(txt, ok=false){
  if(!SCAN_STATUS) return;
  SCAN_STATUS.textContent = txt;
  SCAN_STATUS.classList.toggle('scan-found', ok);
}

function listCameras(){
  CAMERA_SELECT.innerHTML = "";
  return navigator.mediaDevices.enumerateDevices().then(devs=>{
    const vids = devs.filter(d=>d.kind==="videoinput");
    vids.forEach((d,idx)=>{
      const opt=document.createElement("option");
      opt.value = d.deviceId || "";
      opt.textContent = d.label || `Cámara ${idx+1}`;
      CAMERA_SELECT.appendChild(opt);
    });
    return vids;
  });
}

function quaggaConfig(deviceId){
  return {
    inputStream: {
      type: "LiveStream",
      target: SCAN_VIEWPORT,
      constraints: {
        facingMode: "environment",
        ...(deviceId ? { deviceId } : {}),
        width: { min: 640, ideal: 1280 },
        height:{ min: 360, ideal: 720 }
      }
    },
    locator: { patchSize: "medium", halfSample: true },
    numOfWorkers: navigator.hardwareConcurrency ? Math.min(4, navigator.hardwareConcurrency) : 2,
    frequency: 10,
    decoder: {
      readers: [
        "code_128_reader","code_39_reader","code_39_vin_reader",
        "ean_reader","ean_8_reader","upc_reader","upc_e_reader",
        "codabar_reader","i2of5_reader","2of5_reader","interleaved_2_of_5_reader"
      ].map(r=>({format:r, config:{}}))
    },
    locate: true
  };
}

function startScanner(deviceId){
  if(!window.Quagga){ alert("No se pudo cargar el lector. Revisa tu red/CDN."); return; }
  setScanStatus("Inicializando cámara…");
  Quagga.init(quaggaConfig(deviceId), err=>{
    if(err){ console.error(err); setScanStatus("Error al iniciar la cámara"); return; }
    Quagga.start(); quaggaRunning = true;
    setScanStatus("Listo. Enfoca el código de barras.");
  });

  Quagga.offDetected(); // limpiar handlers previos
  Quagga.onDetected(res=>{
    const code = res?.codeResult?.code || "";
    if(code){
      setScanStatus(`Detectado: ${code}`, true);
      if(scanTargetInput){
        scanTargetInput.value = code;
        // pequeña pausa para que el usuario vea el valor
        setTimeout(closeScanner, 250);
      }
    }
  });
}

function stopScanner(){
  try{
    if(window.Quagga && quaggaRunning){ Quagga.stop(); quaggaRunning=false; }
  }catch{}
}

function openScannerFor(inputEl){
  scanTargetInput = inputEl;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    alert("Este navegador no permite acceso a la cámara.");
    return;
  }
  SCAN_MODAL.showModal();
  setScanStatus("Buscando cámaras…");
  listCameras().then(vids=>{
    if(!vids.length){ setScanStatus("No se encontraron cámaras"); return; }
    const deviceId = CAMERA_SELECT.value || vids[0]?.deviceId || undefined;
    startScanner(deviceId);
  }).catch(()=> setScanStatus("No se pudo acceder a la cámara"));
}
function closeScanner(){
  stopScanner();
  scanTargetInput = null;
  SCAN_MODAL.close();
}
CAMERA_SELECT?.addEventListener("change", ()=>{
  if(!quaggaRunning) return;
  stopScanner();
  const id = CAMERA_SELECT.value || undefined;
  startScanner(id);
});
$("#scanCloseBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); closeScanner(); });
SCAN_MODAL?.addEventListener("close", stopScanner);

// Conectar botones de “Escanear”
BTN_SCAN_POS?.addEventListener("click", ()=> openScannerFor(VPOS));
BTN_SCAN_RK ?.addEventListener("click", ()=> openScannerFor(VRK));
BTN_SCAN_CODE?.addEventListener("click", ()=> openScannerFor(VC));

// ===== Validación =====
function rPend(){
  let by={1:[],2:[],3:[],4:[]};
  (P||[]).filter(r=>r?.tipo!=="salida").forEach(r=>(by[r.linea]=by[r.linea]||[]).push(r));
  [1,2,3,4].forEach(l=>{
    let tb=TP[l]; if(!tb) return; tb.innerHTML="";
    let arr=by[l]||[];
    if(!arr.length){tb.innerHTML=`<tr><td colspan="8" style="text-align:center;opacity:.7">Sin pendientes</td></tr>`;return}
    arr.forEach(r=>{
      let tr=document.createElement("tr");
      tr.innerHTML=`<td>${dt(r.creadoEn)}</td><td>${r.operador??"—"}</td><td>${r.codigoSeco??"—"}</td><td>${r.cantidad??"—"}</td><td>${r.rack??"—"}</td><td>${r.posicion??"—"}</td><td>${r.registradoPorNombre??"—"}</td><td><button class="primary">Validar</button></td>`;
      tr.querySelector("button").onclick=()=>oVal(r);
      tb.appendChild(tr);
    });
  });
}
let curV=null;
function oVal(r){
  curV=r;
  VRES.textContent=`Línea ${r.linea} | Posición ${r.posicion??"—"} | Rack ${r.rack??"—"}`;
  VDET.innerHTML=`<dl><dt>Operador</dt><dd>${r.operador??"—"}</dd><dt>Código de seco (esperado)</dt><dd>${r.codigoSeco??"—"}</dd><dt>Cantidad</dt><dd>${r.cantidad??"—"}</dd><dt>Registrado por</dt><dd>${r.registradoPorNombre??"—"}</dd><dt>Creado en</dt><dd>${dt(r.creadoEn)}</dd></dl>`;
  VCH.innerHTML=`<span class="tile-state ${EU.posiciones?.[r.posicion]?'state-busy':'state-ok'}">${EU.posiciones?.[r.posicion]?'Posición Ocupada':'Posición Disponible'}</span>
                 <span class="tile-state ${EU.racks?.[r.rack]?'state-busy':'state-ok'}">${EU.racks?.[r.rack]?'Rack en uso':'Rack listo'}</span>`;
  VPOS.value=""; VRK.value=""; VC.value="";
  MDV.showModal();
}
FMV?.addEventListener("click",e=>{
  let b=e.target; if(!(b instanceof HTMLButtonElement))return;
  if(b.value==="save"&&curV){
    let pos=VPOS.value.trim(), rk=VRK.value.trim(), cod=VC.value.trim();
    if(!pos) return alert("Captura la Posición.");
    if(!rk)  return alert("Captura el Rack.");
    if(!cod) return alert("Captura o escanea el Código de seco.");
    if(curV.codigoSeco && cod!==curV.codigoSeco && !confirm("No coincide el código. ¿Continuar?")) return;

    let u=cur();
    let v={...curV,posicion:pos,rack:rk,codigoSeco:cod,validadoEn:now(),validadoPorId:u?.id||null,validadoPorNombre:u?.name||"Controlista"};
    let arr=J(K.ARR,[]); arr.push(v); S(K.ARR,arr);
    P=P.filter(x=>x.id!==curV.id); S(K.PEND,P);
    MDV.close(); curV=null; render();
  }
  if(b.value==="cancel"){MDV.close(); curV=null;}
});

// ===== Arranque / Órdenes =====
let curA=null;
function oArr(r){
  curA=r;
  let d=new Date(),p=n=>String(n).padStart(2,"0");
  $("#arranqueDT").value=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  $("#arranqueHoras").value=24;
  $("#modalArranque").showModal();
}
$("#formArranque")?.addEventListener("click",e=>{
  const b=e.target; if(!(b instanceof HTMLButtonElement))return;
  if(b.value==="save"&&curA){
    const t=$("#arranqueDT").value, h=parseInt($("#arranqueHoras").value,10);
    if(!t||isNaN(h)||h<1) return alert("Datos de arranque inválidos.");
    const u=cur();
    const st={...curA,arranque:{at:isoLocal(t),byId:u?.id||null,byName:u?.name||"Controlista"},carga:{ms:h*3600*1000,from:isoLocal(t)}};
    const nx=J(K.ORD,[]); nx.push(st); S(K.ORD,nx);
    S(K.ARR,(J(K.ARR,[])||[]).filter(x=>(x.id||x._id)!==(curA.id||curA._id)));
    $("#modalArranque").close(); curA=null; render();
  }
  if(b.value==="cancel"){ $("#modalArranque").close(); curA=null; }
});

function rArr(){
  TA.innerHTML="";
  let a=J(K.ARR,[]);
  if(!a.length){TA.innerHTML=`<tr><td colspan="8" style="text-align:center;opacity:.7">Sin registros</td></tr>`;return}
  a.forEach(r=>{
    let tr=document.createElement("tr");
    tr.innerHTML=`<td>${dt(r.creadoEn)}</td><td>${r.linea??"—"}</td><td>${r.operador??"—"}</td><td>${r.codigoSeco??"—"}</td><td>${r.cantidad??"—"}</td><td>${r.rack??"—"}</td><td>${r.posicion??"—"}</td><td><button class="accent">Arrancar</button></td>`;
    tr.querySelector("button").onclick=()=>oArr(r);
    TA.appendChild(tr);
  });
}
function rOrd(){
  TO.innerHTML="";
  let a=J(K.ORD,[]);
  if(!a.length){TO.innerHTML=`<tr><td colspan="8" style="text-align:center;opacity:.7">Sin registros</td></tr>`;return}
  a.forEach(r=>{
    let tr=document.createElement("tr");
    tr.innerHTML=`<td>${dt(r.arranque?.at)}</td><td>${r.linea??"—"}</td><td>${r.operador??"—"}</td><td>${r.codigoSeco??"—"}</td><td>${r.cantidad??"—"}</td><td>${r.rack??"—"}</td><td>${r.posicion??"—"}</td><td><button class="primary">Orden creada</button></td>`;
    tr.querySelector("button").onclick=()=>{
      let u=cur(), o={...r,orden:{at:now(),byId:u?.id||null,byName:u?.name||"Controlista"}};
      o.carga={ms:o.carga?.ms??24*3600*1000,from:o.carga?.from??(o.arranque?.at||now())};
      let nx=J(K.CON,[]); nx.push(o); S(K.CON,nx);
      S(K.ORD,(J(K.ORD,[])||[]).filter(x=>(x.id||x._id)!==(r.id||r._id)));
      render();
    };
    TO.appendChild(tr);
  });
}

// ===== Confirmación: barra restante =====
let timers=[];
function clearTimers(){timers.forEach(id=>clearInterval(id)); timers=[]}
function makeRestanteCell(fromISO, msDur){
  const from=new Date(fromISO), end=from.getTime()+msDur;
  const wrap=document.createElement("div"); wrap.className="restante-wrap";
  const p=document.createElement("div"); p.className="progress";
  const bar=document.createElement("div"); bar.className="bar";
  const lbl=document.createElement("div"); lbl.className="label"; lbl.textContent="—";
  p.append(bar,lbl); wrap.appendChild(p);

  const tick=()=>{
    const tnow=Date.now(); const total=msDur; const elapsed=Math.max(0, tnow - from.getTime());
    const remain=Math.max(0, end - tnow);
    const pct = Math.min(100, Math.max(0, (elapsed/total)*100));
    bar.style.width = `${pct}%`;
    lbl.textContent = hms(remain);
    if(remain<=0){ p.classList.add("completed"); lbl.textContent="Completado"; return true; }
    return false;
  };
  tick();
  const id=setInterval(()=>{ if(tick()) clearInterval(id); },1000);
  timers.push(id);
  return wrap;
}
function rCon(){
  clearTimers(); TC.innerHTML="";
  const a=J(K.CON,[]);
  if(!a.length){TC.innerHTML=`<tr><td colspan="8" style="text-align:center;opacity:.7">Sin registros</td></tr>`; return;}
  a.forEach(r=>{
    const tr=document.createElement("tr");
    const fromISO=r.carga?.from||r.arranque?.at||now(); const msDur=r.carga?.ms??24*3600*1000;
    const td=v=>{const x=document.createElement("td"); x.textContent=v??"—"; return x};
    const tdRest=document.createElement("td"); tdRest.appendChild(makeRestanteCell(fromISO, msDur));
    const btn=document.createElement("button"); btn.className="primary"; btn.textContent="Enviar";
    btn.onclick=()=>{
      const end=new Date(fromISO).getTime()+msDur;
      if(Date.now()<end && !confirm("Aún no se completa el tiempo. ¿Continuar?")) return;
      let mv={...r,completado:{at:now()}},
          nx=J(K.PROD,[]); nx.push(mv); S(K.PROD,nx);
      S(K.CON,(J(K.CON,[])||[]).filter(x=>(x.id||x._id)!==(r.id||r._id)));
      render();
    };
    const tdAct=document.createElement("td"); tdAct.appendChild(btn);
    tr.append(td(r.arranque?.at?dt(r.arranque.at):"—"), td(hms(msDur)), tdRest, td(r.linea), td(r.codigoSeco), td(r.rack), td(r.posicion), tdAct);
    TC.appendChild(tr);
  });
}

// ===== Producción: selección múltiple + enviar a patineros =====
const selectedIds = new Set();
function updateSelBadge(){ if(SEL_COUNT) SEL_COUNT.textContent = `Seleccionados: ${selectedIds.size}`; }
function sendSelected(linea){
  if(selectedIds.size===0) { alert("Selecciona al menos un registro."); return; }
  const ret = J(K.RET,{1:[],2:[],3:[],4:[]});
  const hist = J(K.RETH,[]);
  const left = [];

  (PR||[]).forEach(r=>{
    const id = r.id || r._id || r.creadoEn; // fallback
    if(selectedIds.has(id)){
      const item = {
        id: id,
        refId: id,
        posicion: r.posicion,
        rack: r.rack,
        linea: linea,
        operador: r.operador,
        empleado: r.registradoPorId,
        codigoSeco: r.codigoSeco,
        cantidad: r.cantidad,
        creadoEn: r.creadoEn,
        registradoPorNombre: r.registradoPorNombre
      };
      (ret[linea]=ret[linea]||[]).push(item);
      hist.push(item);
    } else {
      left.push(r);
    }
  });

  S(K.RET, ret);
  S(K.RETH, hist);
  S(K.PROD, left);
  selectedIds.clear(); CHK_ALL && (CHK_ALL.checked=false); updateSelBadge();
  alert(`Registros enviados a Línea ${linea}.`);
  render();
}
SEND1?.addEventListener('click', ()=> sendSelected(1));
SEND2?.addEventListener('click', ()=> sendSelected(2));
SEND3?.addEventListener('click', ()=> sendSelected(3));
CHK_ALL?.addEventListener('change', ()=>{
  const checks = $$('#tblProdAll tbody input[type="checkbox"][data-id]');
  checks.forEach(c=>{ c.checked = CHK_ALL.checked; const id=c.getAttribute('data-id'); if(c.checked) selectedIds.add(id); else selectedIds.delete(id); });
  updateSelBadge();
});

function total(){if(!PT)return; PT.textContent=`Total: ${(PR||[]).reduce((s,r)=>s+(isNaN(parseFloat(r?.cantidad))?0:parseFloat(r.cantidad)),0)}`}
function rProd(){
  TPA.innerHTML=""; PR=J(K.PROD,PR);
  selectedIds.clear(); updateSelBadge(); if(CHK_ALL) CHK_ALL.checked=false;

  if(!PR.length){
    TPA.innerHTML=`<tr><td colspan="9" style="text-align:center;opacity:.7">Sin registros</td></tr>`;
    total(); return;
  }

  let g={};
  PR.forEach(r=>{let k=r.codigoSeco||"Sin código"; (g[k]=g[k]||[]).push(r)});
  Object.entries(g).forEach(([k,rs])=>{
    let sep=document.createElement("tr");
    sep.classList.add("tr-separator");
    sep.innerHTML=`<td colspan="9">Código de seco: ${k}</td>`;
    TPA.appendChild(sep);

    rs.forEach(r=>{
      const id = r.id || r._id || r.creadoEn || crypto.randomUUID();
      r.id = id;

      let tr=document.createElement("tr");
      tr.innerHTML=`
        <td><input type="checkbox" data-id="${id}"/></td>
        <td>${dt(r.creadoEn)}</td>
        <td>${r.linea}</td>
        <td>${r.operador??"—"}</td>
        <td>${r.codigoSeco??"—"}</td>
        <td>${r.cantidad??"—"}</td>
        <td>${r.rack??"—"}</td>
        <td>${r.posicion??"—"}</td>
        <td>${r.validadoPorNombre??r.orden?.byName??"—"}</td>
      `;
      tr.addEventListener("click", (ev)=>{
        if(ev.target.matches('input[type="checkbox"]')) return;
        IB.innerHTML=`<dl>
          <dt>Línea</dt><dd>${r.linea??"—"}</dd><dt>Operador</dt><dd>${r.operador??"—"}</dd>
          <dt>Código seco</dt><dd>${r.codigoSeco??"—"}</dd><dt>Cantidad</dt><dd>${r.cantidad??"—"}</dd>
          <dt>Rack</dt><dd>${r.rack??"—"}</dd><dt>Posición</dt><dd>${r.posicion??"—"}</dd>
          <dt>Registrado por</dt><dd>${r.registradoPorNombre??"—"}</dd><dt>Creado</dt><dd>${dt(r.creadoEn)}</dd>
          ${r.validadoPorNombre?`<dt>Validado por</dt><dd>${r.validadoPorNombre} (${dt(r.validadoEn)})</dd>`:""}
          ${r.arranque?.byName?`<dt>Arranque</dt><dd>${r.arranque.byName} (${dt(r.arranque.at)})</dd>`:""}
          ${r.orden?.byName?`<dt>Orden creada</dt><dd>${r.orden.byName} (${dt(r.orden.at)})</dd>`:""}
          ${r.completado?.at?`<dt>Completado</dt><dd>${dt(r.completado.at)}</dd>`:""}
        </dl>`;
        $("#modalInfo").showModal();
      });

      const chk = tr.querySelector('input[type="checkbox"]');
      chk.addEventListener('change', ()=>{
        if(chk.checked) selectedIds.add(id); else selectedIds.delete(id);
        updateSelBadge();
      });

      TPA.appendChild(tr);
    });
  });
  total();
}

// ===== Pos/Rack catálogos =====
function posSt(k){return PS?.[k]?.estado || (EU.posiciones?.[k]?"en_uso":"disponible")}
function rackSt(k){return RS?.[k]?.estado || (EU.racks?.[k]?"en_uso":"disponible")}
function rPos(q=""){
  if(!GP) return;
  GP.innerHTML=""; q=(q||"").toLowerCase().trim();
  for(let i=1;i<=450;i++){
    let k="P"+pad(i); if(q && !k.toLowerCase().includes(q))continue;
    let st=posSt(k), li=document.createElement("li");
    li.innerHTML=`<div class="tile-title">${k}</div><div class="tile-state ${st==='en_uso'?'state-busy':st==='mantenimiento'?'state-warn':'state-ok'}">${st==='en_uso'?'En uso':st==='mantenimiento'?'Mantenimiento':'Disponible'}</div>`;
    GP.appendChild(li);
  }
}
function rRack(q=""){
  if(!GR) return;
  GR.innerHTML=""; q=(q||"").toLowerCase().trim();
  for(let i=1;i<=435;i++){
    let k="Rack"+pad(i); if(q && !k.toLowerCase().includes(q))continue;
    let st=rackSt(k), li=document.createElement("li");
    li.innerHTML=`<div class="tile-title">${k}</div><div class="tile-state ${st==='en_uso'?'state-busy':st==='mantenimiento'?'state-warn':'state-ok'}">${st==='en_uso'?'En uso':st==='mantenimiento'?'Mantenimiento':'Disponible'}</div>`;
    li.addEventListener('click', ()=> openRackEditor(k));
    GR.appendChild(li);
  }
}
PSR?.addEventListener("input",()=>rPos(PSR.value));
RSR?.addEventListener("input",()=>rRack(RSR.value));

// ===== Historial + CSV =====
function enrich(x){
  if(!x) return x;
  let id=x.refId||x.id;
  let src=(PR.find(a=>a.id===id))||(J(K.RETH,[]).find(a=>a.id===id||a.refId===id))||(P.find(a=>a.id===id))||(O.find(a=>a.id===id))||(A.find(a=>a.id===id))||(C.find(a=>a.id===id));
  return src?{...src,...x}:x;
}
function shift(d){let m=d.getHours()*60+d.getMinutes(); return (m>=390&&m<870)?"Día":(m>=870&&m<1350)?"Tarde":"Noche"}
function filt(){
  let s=(J(K.PEND,[])||[]).filter(x=>x&&x.tipo==="salida").map(enrich),
      m=HR?.value||"all", sh=SR?.value||"all", n=new Date(), t0=new Date(n.getFullYear(),n.getMonth(),n.getDate()).getTime();
  if(m==="today") s=s.filter(x=>new Date(x.salida?.at||x.creadoEn||0).getTime()>=t0);
  else if(m==="7"||"30"){let d=parseInt(m,10); if(d){let cut=n.getTime()-d*864e5; s=s.filter(x=>new Date(x.salida?.at||x.creadoEn||0).getTime()>=cut)}}
  s.sort((a,b)=>new Date(b.salida?.at||b.creadoEn||0)-new Date(a.salida?.at||a.creadoEn||0));
  if(sh!=="all") s=s.filter(r=>({day:"Día",evening:"Tarde",night:"Noche"}[sh])===shift(new Date(r.salida?.at||r.creadoEn||0)));
  return s;
}
function rHist(){
  TH.innerHTML="";
  let rows=filt();
  if(!rows.length){TH.innerHTML=`<tr><td colspan="9" style="text-align:center;opacity:.7">Sin salidas registradas</td></tr>`;return}
  let g={};
  rows.forEach(r=>{let d=new Date(r.salida?.at||r.creadoEn||0), y=d.toISOString().slice(0,10), t=shift(d), k=`${y}|${t}`; (g[k]=g[k]||[]).push(r)});
  Object.keys(g).sort((a,b)=>b.localeCompare(a)).forEach(k=>{
    let [y,t]=k.split("|"), sep=document.createElement("tr"); sep.classList.add("tr-separator"); sep.innerHTML=`<td colspan="9">${y} — Turno: ${t}</td>`; TH.appendChild(sep);
    g[k].forEach(r=>{
      let tr=document.createElement("tr"); tr.classList.add("clickable");
      tr.innerHTML=`<td>${dt(r.salida?.at||r.creadoEn)}</td><td>${t}</td><td>${r.linea??"—"}</td><td>${r.operador??"—"}</td><td>${r.codigoSeco??"—"}</td><td>${r.cantidad??"—"}</td><td>${r.rack??"—"}</td><td>${r.posicion??"—"}</td><td>${r.salida?.byName||r.validadoPorNombre||"—"}</td>`;
      tr.onclick=()=>{const x=enrich(r); HIB.innerHTML=`<dl>
        <dt>Código seco</dt><dd>${x.codigoSeco??"—"}</dd><dt>Cantidad</dt><dd>${x.cantidad??"—"}</dd><dt>Línea</dt><dd>${x.linea??"—"}</dd>
        <dt>Posición</dt><dd>${x.posicion??"—"}</dd><dt>Rack</dt><dd>${x.rack??"—"}</dd><dt>Operador</dt><dd>${x.operador??"—"}</dd>
        <dt>Registrado por</dt><dd>${x.registradoPorNombre??"—"}</dd><dt>Creado</dt><dd>${dt(x.creadoEn)}</dd>
        <dt>Validado por</dt><dd>${x.validadoPorNombre??"—"}</dd><dt>Validado en</dt><dd>${dt(x.validadoEn)}</dd>
        <dt>Arranque — Controlista</dt><dd>${x.arranque?.byName??"—"}</dd><dt>Arranque — Fecha</dt><dd>${dt(x.arranque?.at)}</dd>
        <dt>Orden creada — Controlista</dt><dd>${x.orden?.byName??"—"}</dd><dt>Orden creada — Fecha</dt><dd>${dt(x.orden?.at)}</dd>
        <dt>Completado (carga)</dt><dd>${dt(x.completado?.at)}</dd>
        <dt>Entrada — Patinero</dt><dd>${x.entrada?.byName??"—"}</dd><dt>Entrada — Fecha</dt><dd>${dt(x.entrada?.at)}</dd>
        <dt>Entrada — Línea conf.</dt><dd>${x.entrada?.confirmLinea??"—"}</dd><dt>Entrada — Rack conf.</dt><dd>${x.entrada?.confirmRack??"—"}</dd>
        <dt>Salida — Patinero</dt><dd>${x.salida?.byName??"—"}</dd><dt>Salida — Fecha</dt><dd>${dt(x.salida?.at)}</dd>
      </dl>`; $("#modalHistInfo").showModal();};
      TH.appendChild(tr);
    });
  });
}
HR?.addEventListener("change",rHist);
SR?.addEventListener("change",rHist);
CSV?.addEventListener("click",()=>{
  let rows=filt(); if(!rows.length) return alert("No hay datos para exportar con los filtros actuales.");
  let H=["Fecha salida","Turno","Línea","Operador","Código seco","Cantidad","Rack","Posición","Validado/Salida por","Arranque","Orden creada","Completado"], out=[H.join(",")];
  rows.forEach(r=>{
    let d=new Date(r.salida?.at||r.creadoEn||0), t=shift(d),
        line=[dt(r.salida?.at||r.creadoEn||""),t,r.linea??"",r.operador??"",r.codigoSeco??"",r.cantidad??"",r.rack??"",r.posicion??"",
              (r.salida?.byName||r.validadoPorNombre||""), dt(r.arranque?.at||""),dt(r.orden?.at||""),dt(r.completado?.at||"")]
              .map(v=>`"${String(v).replaceAll('"','""')}"`).join(",");
    out.push(line);
  });
  let blob=new Blob([out.join("\n")],{type:"text/csv;charset=utf-8"}), url=URL.createObjectURL(blob),
      a=document.createElement("a"); a.href=url; a.download=`historial_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

// ===== STATUS =====
const ST_TABS=$("#statusTabs");
const T_SOON=$("#tblSoon tbody"), T_DONE=$("#tblDone tbody"), T_PRE=$("#tblPre tbody"),
      L_RACKS=$("#listRacksOk"), L_POS=$("#listPosOk");

function showStatus(view){
  $$("#status .status-tabs .ghost").forEach(b=>b.classList.toggle("active", b.dataset.stab===view));
  $$("#status .sview").forEach(v=>v.hidden = v.dataset.sview!==view);
}
ST_TABS?.addEventListener("click", e=>{
  const b=e.target.closest("button[data-stab]"); if(!b) return;
  showStatus(b.dataset.stab);
  renderStatus();
});
function renderSoon(){
  T_SOON.innerHTML="";
  const arr=J(K.CON,[]);
  const ONE=3600*1000, nowms=Date.now();
  const rows=arr.map(r=>{
    const from=new Date(r.carga?.from||r.arranque?.at||now()).getTime();
    const end=from + (r.carga?.ms ?? 24*3600*1000);
    const rem=end-nowms;
    return {...r, _from:from, _end:end, _rem:rem};
  }).filter(x=>x._rem>0 && x._rem<=ONE)
    .sort((a,b)=>a._rem-b._rem);
  if(!rows.length){T_SOON.innerHTML=`<tr><td colspan="6" style="text-align:center;opacity:.7">Sin registros próximos a terminar</td></tr>`;return}
  rows.forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${dt(r.arranque?.at)}</td><td>${hms(r._rem)}</td><td>${r.linea??"—"}</td><td>${r.codigoSeco??"—"}</td><td>${r.rack??"—"}</td><td>${r.posicion??"—"}</td>`;
    T_SOON.appendChild(tr);
  });
}
function renderDone(){
  T_DONE.innerHTML="";
  const arr=J(K.CON,[]);
  const rows=arr.map(r=>{
    const from=new Date(r.carga?.from||r.arranque?.at||now()).getTime();
    const end=from + (r.carga?.ms ?? 24*3600*1000);
    return {...r,_end:end};
  }).filter(x=>Date.now()>=x._end);
  if(!rows.length){T_DONE.innerHTML=`<tr><td colspan="6" style="text-align:center;opacity:.7">Sin posiciones terminadas</td></tr>`;return}
  rows.sort((a,b)=>a._end-b._end).forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${dt(r.arranque?.at)}</td><td>${hms(r.carga?.ms ?? 24*3600*1000)}</td><td>${r.linea??"—"}</td><td>${r.codigoSeco??"—"}</td><td>${r.rack??"—"}</td><td>${r.posicion??"—"}</td>`;
    T_DONE.appendChild(tr);
  });
}
function renderPre(){
  T_PRE.innerHTML="";
  const ret=J(K.RET,{1:[],2:[],3:[],4:[]});
  const all=[...(ret[1]||[]),...(ret[2]||[]),...(ret[3]||[]),...(ret[4]||[])];
  if(!all.length){T_PRE.innerHTML=`<tr><td colspan="6" style="text-align:center;opacity:.7">Sin registros en Presurtido</td></tr>`;return}
  all.sort((a,b)=>new Date(a.creadoEn||0)-new Date(b.creadoEn||0)).forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${dt(r.creadoEn)}</td><td>${r.linea??"—"}</td><td>${r.codigoSeco??"—"}</td><td>${r.cantidad??"—"}</td><td>${r.rack??"—"}</td><td>${r.posicion??"—"}</td>`;
    T_PRE.appendChild(tr);
  });
}
function renderRacksOk(){
  L_RACKS.innerHTML="";
  for(let i=1;i<=435;i++){
    const k="Rack"+pad(i), st=rackSt(k);
    if(st==="disponible"){
      const li=document.createElement("li");
      li.innerHTML=`<div class="tile-title">${k}</div><div class="tile-state state-ok">Disponible</div>`;
      L_RACKS.appendChild(li);
    }
  }
  if(!L_RACKS.children.length){
    L_RACKS.innerHTML=`<li style="grid-column:1/-1;text-align:center;opacity:.7">No hay racks disponibles</li>`;
  }
}
function renderPosOk(){
  L_POS.innerHTML="";
  for(let i=1;i<=450;i++){
    const k="P"+pad(i), st=posSt(k);
    if(st==="disponible"){
      const li=document.createElement("li");
      li.innerHTML=`<div class="tile-title">${k}</div><div class="tile-state state-ok">Disponible</div>`;
      L_POS.appendChild(li);
    }
  }
  if(!L_POS.children.length){
    L_POS.innerHTML=`<li style="grid-column:1/-1;text-align:center;opacity:.7">No hay posiciones disponibles</li>`;
  }
}
function renderStatus(){ renderSoon(); renderDone(); renderPre(); renderRacksOk(); renderPosOk(); }

// ===== HOME =====
const KPI_ENT=$("#kpiEntradas"), KPI_SAL=$("#kpiSalidas"), KPI_RACK=$("#kpiRacksOk"), KPI_POS=$("#kpiPosOk");
const TB_HOME=$("#tblHomeCodigos tbody");
function isToday(ts){ if(!ts) return false; const d=new Date(ts), n=new Date(); return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();}
function renderHome(){
  const allP = J(K.PEND,[]);
  const entradasHoy = (allP||[]).filter(r=>r && r.tipo!=="salida" && isToday(r.creadoEn));
  const totalEnt = entradasHoy.reduce((s,r)=>s+(parseFloat(r.cantidad)||0),0);
  const salidasHoy = (allP||[]).filter(r=>r && r.tipo==="salida" && isToday(r.salida?.at));
  const totalSal = salidasHoy.reduce((s,r)=>s+(parseFloat(r.cantidad)||0),0);
  let racksOk=0; for(let i=1;i<=435;i++){ const k="Rack"+pad(i); const st=RS?.[k]?.estado || (EU.racks?.[k]?"en_uso":"disponible"); if(st==="disponible") racksOk++; }
  let posOk=0; for(let i=1;i<=450;i++){ const k="P"+pad(i); const st=PS?.[k]?.estado || (EU.posiciones?.[k]?"en_uso":"disponible"); if(st==="disponible") posOk++; }
  KPI_ENT&& (KPI_ENT.textContent = totalEnt);
  KPI_SAL&& (KPI_SAL.textContent = totalSal);
  KPI_RACK&& (KPI_RACK.textContent = racksOk);
  KPI_POS&& (KPI_POS.textContent = posOk);

  if(TB_HOME){
    TB_HOME.innerHTML="";
    if(!entradasHoy.length){
      TB_HOME.innerHTML = `<tr><td colspan="3" style="text-align:center;opacity:.7">Sin registros de hoy</td></tr>`;
    } else {
      const group = {};
      entradasHoy.forEach(r=>{
        const k = r.codigoSeco || "—";
        (group[k]=group[k]||{cant:0,regs:0});
        group[k].cant += parseFloat(r.cantidad)||0;
        group[k].regs += 1;
      });
      Object.entries(group).sort((a,b)=>b[1].cant - a[1].cant).forEach(([code,info])=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${code}</td><td>${info.cant}</td><td>${info.regs}</td>`;
        TB_HOME.appendChild(tr);
      });
    }
  }
}
window.addEventListener("hashchange", ()=>{ if(location.hash==="#home") renderHome(); });
window.addEventListener("storage", e=>{
  if([K.PEND,K.USE,K.PSTAT,K.RSTAT].includes(e.key)) renderHome();
});

// ===== Modal de edición de Racks (observaciones + broadcast) =====
const MRK=$("#modalRackEdit"), FRK=$("#formRackEdit"),
      RK_TITLE=$("#rkEditTitle"), RK_EST=$("#rkEstadoSel"),
      BTN_SOPORTE=$("#btnSoporteFalt"), RK_OBS=$("#rkObsText"),
      RK_CLEAR=$("#rkBtnClear");
let currentRackKey=null;

function openRackEditor(key){
  currentRackKey=key;
  RK_TITLE.textContent=`Editar ${key}`;
  RS=J(K.RSTAT,{});
  const st=RS[key]||{};
  RK_EST.value = st.estado || (EU.racks?.[key] ? "en_uso" : "disponible");
  BTN_SOPORTE.classList.toggle("active", !!st.soporte_dren_faltante);
  $$('[data-pm]').forEach(b=>{
    const lvl=parseInt(b.getAttribute('data-pm'),10);
    const on = Array.isArray(st.porta_manguera_falt) && st.porta_manguera_falt.includes(lvl);
    b.classList.toggle('active', on);
  });
  $$('[data-tn]').forEach(b=>{
    const lvl=parseInt(b.getAttribute('data-tn'),10);
    const on = Array.isArray(st.tina_dan) && st.tina_dan.includes(lvl);
    b.classList.toggle('active', on);
  });
  RK_OBS.value = st.obs || "";
  MRK.showModal();
}

BTN_SOPORTE?.addEventListener("click", ()=> BTN_SOPORTE.classList.toggle("active"));
$$('[data-pm]').forEach(b=> b.addEventListener('click', ()=> b.classList.toggle('active')));
$$('[data-tn]').forEach(b=> b.addEventListener('click', ()=> b.classList.toggle('active')));

RK_CLEAR?.addEventListener("click", ()=>{
  RK_EST.value="disponible";
  BTN_SOPORTE.classList.remove("active");
  $$('[data-pm], [data-tn]').forEach(b=> b.classList.remove('active'));
  RK_OBS.value="";
});

FRK?.addEventListener("click", (e)=>{
  const btn=e.target; if(!(btn instanceof HTMLButtonElement)) return;
  if(btn.value==="save" && currentRackKey){
    const porta = $$('[data-pm].active').map(b=>parseInt(b.getAttribute('data-pm'),10)).sort((a,b)=>a-b);
    const tina  = $$('[data-tn].active').map(b=>parseInt(b.getAttribute('data-tn'),10)).sort((a,b)=>a-b);
    const obj={
      ...(RS[currentRackKey]||{}),
      estado: RK_EST.value,
      soporte_dren_faltante: BTN_SOPORTE.classList.contains('active'),
      porta_manguera_falt: porta,
      tina_dan: tina,
      obs: RK_OBS.value.trim()
    };
    RS[currentRackKey]=obj; S(K.RSTAT,RS);

    RACKS_STATUS_CH.postMessage({ type:'rack-update', key: currentRackKey, data: obj });

    MRK.close(); currentRackKey=null;
    rRack(RSR?.value);
  }
  if(btn.value==="cancel"){ MRK.close(); currentRackKey=null; }
});

// ===== Render principal =====
function render(){
  P=J(K.PEND,[]); A=J(K.ARR,[]); O=J(K.ORD,[]); C=J(K.CON,[]); PR=J(K.PROD,[]);
  PS=J(K.PSTAT,{}); RS=J(K.RSTAT,{}); EU=J(K.USE,{posiciones:{},racks:{}});
  rPend(); rArr(); rOrd(); rCon(); rProd(); rHist(); rPos(PSR?.value); rRack(RSR?.value);
  markActive();
  showOnly(location.hash || "#validar");
}
window.addEventListener("storage",e=>{
  if([K.USE,K.PSTAT,K.RSTAT,K.RET,K.RETH,K.PROD,K.PEND,K.ARR,K.ORD,K.CON].includes(e.key)) render()
});
render();
