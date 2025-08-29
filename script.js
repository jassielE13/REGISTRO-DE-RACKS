// Mapa simple: número de empleado -> { name, role }
// role: "patinero" | "controlista"
const DIRECTORY = {
  // Ejemplos — ajusta a tus usuarios reales:
  "63182": { name: "Jassiel", role: "patinero" },
  "1000001": { name: "Ana Pérez", role: "patinero" },
  "2000001": { name: "Luis Gómez", role: "controlista" },
  "2000002": { name: "María Ruiz", role: "controlista" }
};

// Rutas de destino (ajusta si tu estructura difiere en GitHub Pages)
const ROUTES = {
  patinero: "../Patineros/Patineros.html",
  controlista: "../Controlistas/Controlistas.html"
};

const form = document.getElementById("loginForm");
const employeeIdInput = document.getElementById("employeeId");
const errorMsg = document.getElementById("errorMsg");

// Normaliza entrada numérica (sin espacios, sin separadores)
function sanitizeId(v){
  return (v || "").toString().trim().replace(/\s+/g, "");
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  errorMsg.hidden = true;
  const id = sanitizeId(employeeIdInput.value);

  if (!id){
    showError("Escribe tu número de empleado.");
    return;
  }

  const user = DIRECTORY[id];
  if (!user){
    showError("Número de empleado no reconocido. Verifica o solicita tu alta.");
    return;
  }

  // Persistimos la sesión para el resto de la app
  const CURRENT_USER = { id, name: user.name, role: user.role };
  localStorage.setItem("CURRENT_USER", JSON.stringify(CURRENT_USER));
  // Token demo para que el guard de tu PWA (si aplica) te deje pasar
  localStorage.setItem("auth_token", "demo");

  // Redirección por rol
  const target = ROUTES[user.role];
  if (!target){
    showError("Tu rol no tiene ruta de acceso configurada.");
    return;
  }

  // En GitHub Pages es mejor usar location.assign (historial correcto)
  location.assign(target);
});

function showError(msg){
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
  employeeIdInput.focus();
}


