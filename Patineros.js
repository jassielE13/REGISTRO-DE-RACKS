// === Seguridad de origen para cámara ===
const SECURE_ORIGIN =
  location.protocol === 'https:' ||
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1';

function assertCameraAvailable() {
  if (!SECURE_ORIGIN) {
    alert("La cámara requiere HTTPS o localhost. Abre la app en HTTPS (o usa localhost) para escanear.");
    return false;
  }
  if (!window.Html5Qrcode) {
    alert("No se cargó el lector QR (html5-qrcode). Verifica el <script> del CDN y que no haya bloqueadores.");
    return false;
  }
  return true;
}

// ====== Lector QR real (html5-qrcode) ======
let qrModal = null, qrRegion = null, qrReader = null, qrTargetInput = null;

function ensureQrDomRefs() {
  if (!qrModal)  qrModal  = document.getElementById("modalQR");
  if (!qrRegion) qrRegion = document.getElementById("qrRegion");
}

async function pickBestCamera(cameras) {
  if (!cameras || !cameras.length) throw new Error("No hay cámaras disponibles o permisos denegados");
  const back = cameras.find(c => /back|rear|environment|trasera/i.test(c.label));
  return (back || cameras[0]).id;
}

// mode: 'text' | 'rack' | 'pos'
async function openQrScanner(targetInput, mode='text') {
  ensureQrDomRefs();
  if (!assertCameraAvailable()) return;

  qrTargetInput = targetInput;
  qrModal.showModal();

  if (!qrReader) qrReader = new Html5Qrcode("qrRegion", false);

  try {
    const cams = await Html5Qrcode.getCameras();
    if (!cams || !cams.length) {
      alert("No se detectaron cámaras o no diste permiso.");
      await stopQrScanner(); return;
    }
    const camId = await pickBestCamera(cams);
    const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.777 };

    const onSuccess = (decodedText) => {
      let v = (decodedText || "").trim();
      if (mode === 'rack') v = autoformatRack(v);
      if (mode === 'pos')  v = autoformatPos(v);

      if (qrTargetInput) {
        qrTargetInput.value = v;
        qrTargetInput.dispatchEvent(new Event("input"));
        qrTargetInput.dispatchEvent(new Event("blur"));
      }
      stopQrScanner();
    };

    const onError = (_err) => { /* lecturas fallidas: ignorar */ };

    await qrReader.start({ deviceId: { exact: camId } }, config, onSuccess, onError);
  } catch (err) {
    console.error(err);
    alert("No se pudo iniciar la cámara: " + (err?.message || err));
    try { await stopQrScanner(); } catch {}
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
