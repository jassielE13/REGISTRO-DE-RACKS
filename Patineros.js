// === Seguridad de origen para cámara ===
const SECURE_ORIGIN = location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname);
function assertCameraAvailable() {
  if (!SECURE_ORIGIN) { alert("La cámara requiere HTTPS o localhost."); return false; }
  if (!window.Html5Qrcode) { alert("No se cargó html5-qrcode. Revisa el <script> del CDN."); return false; }
  return true;
}

// ====== Lector QR (html5-qrcode) con múltiples estrategias ======
let qrModal = null, qrRegion = null, qrReader = null, qrTargetInput = null, qrFileInp = null;

function ensureQrDomRefs() {
  if (!qrModal)  qrModal  = document.getElementById("modalQR");
  if (!qrRegion) qrRegion = document.getElementById("qrRegion");
  // añade input file “fallback” si no existe
  if (!qrFileInp) {
    qrFileInp = document.createElement("input");
    qrFileInp.type = "file";
    qrFileInp.accept = "image/*";
    qrFileInp.capture = "environment";
    qrFileInp.style.display = "none";
    qrRegion?.parentElement?.appendChild(qrFileInp);
    qrFileInp.addEventListener("change", async (ev)=>{
      const f = ev.target.files?.[0];
      if(!f) return;
      try{
        if(!qrReader) qrReader = new Html5Qrcode("qrRegion", { verbose:true });
        const result = await qrReader.scanFile(f, true);
        applyQrValue(result);
        stopQrScanner();
      }catch(e){
        console.error(e);
        alert("No se pudo leer el código de la imagen.");
      }finally{
        qrFileInp.value = "";
      }
    });
  }
}

function applyQrValue(decodedText, mode){ // mode opcional si quieres formatear aquí
  let v = (decodedText || "").trim();
  if (mode === 'rack') v = autoformatRack(v);
  if (mode === 'pos')  v = autoformatPos(v);
  if (qrTargetInput) {
    qrTargetInput.value = v;
    qrTargetInput.dispatchEvent(new Event("input"));
    qrTargetInput.dispatchEvent(new Event("blur"));
  }
}

// mode: 'text' | 'rack' | 'pos'
async function openQrScanner(targetInput, mode='text') {
  ensureQrDomRefs();
  if (!assertCameraAvailable()) return;

  qrTargetInput = targetInput;

  // Reinicia lector si estaba en uso
  try { if (qrReader && qrReader._isScanning) { await qrReader.stop(); await qrReader.clear(); } } catch {}
  qrReader = new Html5Qrcode("qrRegion", { verbose:true });

  // abre modal
  qrModal.showModal();

  const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.777 };
  const onSuccess = (txt)=>{ applyQrValue(txt, mode); stopQrScanner(); };
  const onError   = (_e)=>{ /* ignorar lecturas fallidas */ };

  try{
    // Estrategia 1: listar cámaras y usar la trasera
    let started = false;
    try{
      const cams = await Html5Qrcode.getCameras();
      if(cams?.length){
        const back = cams.find(c => /back|rear|environment|trasera/i.test(c.label));
        const camId = (back || cams[0]).id;
        await qrReader.start({ deviceId:{ exact: camId } }, config, onSuccess, onError);
        started = true;
      }
    }catch(e1){ console.warn("getCameras() falló", e1); }

    // Estrategia 2: facingMode environment
    if(!started){
      try{
        await qrReader.start({ facingMode: "environment" }, config, onSuccess, onError);
        started = true;
      }catch(e2){ console.warn("facingMode environment falló", e2); }
    }

    // Estrategia 3: facingMode user (frontal)
    if(!started){
      await qrReader.start({ facingMode: "user" }, config, onSuccess, onError);
    }
  }catch(err){
    console.error(err);
    alert("No se pudo iniciar la cámara: " + (err?.message || err) + "\nUsa el botón 'Subir foto' como alternativa.");
  }

  // Agrega (si no existe) un botón visible para subir foto como fallback
  addUploadFallbackButton();
}

function addUploadFallbackButton(){
  // agrega un botón “Subir foto” dentro del modal si no existe
  let bar = qrRegion?.parentElement?.querySelector(".qr-fallback-bar");
  if(!bar){
    bar = document.createElement("div");
    bar.className = "qr-fallback-bar";
    bar.style.marginTop = ".5rem";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Subir foto del código";
    btn.style.marginLeft = "0";
    btn.style.padding = "8px 12px";
    btn.style.border = "1px solid var(--border,#ccc)";
    btn.style.borderRadius = "10px";
    btn.onclick = ()=> qrFileInp?.click();
    bar.appendChild(btn);
    qrRegion?.parentElement?.appendChild(bar);
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
document.getElementById("btnQrCancel")?.addEventListener("click", () => { stopQrScanner(); });
