// --- CONFIGURACIÓN Y DATOS INICIALES ---
const KEY = 'sst-paramonga-prototipo-v1';
const REQUIREMENTS_KEY = 'sst-paramonga-requisitos-v1';
const DB_NAME = 'control-sst-documentos';
const STORE_NAME = 'archivos';

const initialRequirements = [
  { id: 'R1', name: 'SCTR', mandatory: true, active: true },
  { id: 'R2', name: 'Inducción SST', mandatory: true, active: true },
  { id: 'R3', name: 'Examen médico ocupacional', mandatory: true, active: true },
  { id: 'R4', name: 'Capacitación SST', mandatory: false, active: true },
  { id: 'R5', name: 'Entrega de EPP', mandatory: false, active: true },
  { id: 'R6', name: 'Otro documento', mandatory: false, active: true },
];

const seed = {
  companies: [
    { id: 'E1', name: 'Servicios Industriales del Norte SAC', ruc: '20123456789', contact: 'Contacto de prueba' }
  ],
  workers: [
    { id: 'T1', name: 'María Torres (ficticio)', dni: '00000001', companyId: 'E1', role: 'Técnica de mantenimiento' }
  ],
  docs: [
    { id: 'D1', workerId: 'T1', type: 'SCTR', expiry: '2027-01-30', status: 'Aprobado', note: '', fileName: 'SCTR_ejemplo.pdf' }
  ],
};

let sesion = null;
let data = JSON.parse(localStorage.getItem(KEY)) || seed;
let requirements = JSON.parse(localStorage.getItem(REQUIREMENTS_KEY)) || initialRequirements;
let currentTab = 'panel';

// --- UTILIDADES ---
const today = () => new Date().toISOString().slice(0, 10);
const newId = () => Date.now().toString() + Math.random().toString(36).substring(2);
const daysUntil = (date) => date ? Math.ceil((new Date(`${date}T12:00:00`) - new Date(`${today()}T12:00:00`)) / 86400000) : null;

const getStatus = (doc) => (doc.expiry && daysUntil(doc.expiry) < 0) ? 'Vencido' : doc.status;
const getCompanyName = (id) => data.companies.find(c => c.id === id)?.name || 'Sin empresa';
const getWorkerName = (id) => data.workers.find(w => w.id === id)?.name || 'Sin trabajador';

const checkAccess = (worker) => {
  const records = data.docs.filter(d => d.workerId === worker.id);
  const requiredReqs = requirements.filter(r => r.active && r.mandatory).map(r => r.name);
  if (requiredReqs.length === 0) return 'No autorizado';
  return requiredReqs.every(type => records.some(d => d.type === type && getStatus(d) === 'Aprobado')) ? 'Autorizado' : 'No autorizado';
};

// --- INDEXED DB (Para archivos) ---
function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function guardarArchivo(id, file) {
  const db = await abrirDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(file, id);
    tx.oncomplete = () => { db.close(); resolve(); };
  });
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('current-date').textContent = `Actualizado: ${today()}`;
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('usuario').value.trim().toLowerCase();
    sesion = { rol: user === 'admin' ? 'admin' : 'contratista' };
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'block';
    renderSidebar();
    renderTab('panel');
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('¿Restablecer todos los datos ficticios?')) {
      data = JSON.parse(JSON.stringify(seed));
      localStorage.setItem(KEY, JSON.stringify(data));
      renderTab(currentTab);
    }
  });
});

// --- RENDERIZADO ---
function renderSidebar() {
  const nav = document.getElementById('sidebar');
  const tabs = [
    ['panel', '📊', 'Panel general'], ['empresas', '🏭', 'Empresas'],
    ['trabajadores', '👷', 'Trabajadores'], ['documentos', '📋', 'Documentos SST'],
    ['autorizaciones', '🛡️', 'Autorizaciones'], ['requisitos', '⚙️', 'Requisitos'],
    ['configuracion', '⚙️', 'Configuración']
  ];
  
  nav.innerHTML = tabs
    .filter(([id]) => sesion.rol === 'admin' || (id !== 'configuracion' && id !== 'requisitos'))
    .map(([id, icon, label]) => `<button class="nav ${currentTab === id ? 'active' : ''}" onclick="switchTab('${id}')"><span>${icon}</span> ${label}</button>`)
    .join('') + `<div class="side-note">Agro Industrial Paramonga S.A.<br />Proyecto A.C · SENATI</div>`;
}

window.switchTab = (tab) => {
  currentTab = tab;
  renderSidebar();
  renderTab(tab);
};

function renderTab(tab) {
  const titles = { panel: 'Panel general', empresas: 'Empresas contratistas', trabajadores: 'Trabajadores', documentos: 'Documentos SST', autorizaciones: 'Autorización de ingreso', requisitos: 'Requisitos SST', configuracion: 'Configuración' };
  document.getElementById('page-title').textContent = titles[tab] || 'Panel';
  const container = document.getElementById('tab-content');
  container.innerHTML = '';

  if (tab === 'panel') {
    const approved = data.workers.filter(w => checkAccess(w) === 'Autorizado').length;
    const expired = data.docs.filter(d => getStatus(d) === 'Vencido').length;
    container.innerHTML = `
      <div class="stats">
        <div class="stat"><span>▤</span><strong>${data.companies.length}</strong><small>Empresas</small></div>
        <div class="stat"><span>♙</span><strong>${data.workers.length}</strong><small>Trabajadores</small></div>
        <div class="stat"><span>✓</span><strong>${approved}</strong><small>Autorizados</small></div>
        <div class="stat"><span>!</span><strong>${expired}</strong><small>Vencidos</small></div>
      </div>
      <div class="card">
        <h2>Accesos rápidos</h2>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:15px;">
          <button onclick="switchTab('empresas')" style="padding:10px; border-radius:8px; border:0; background:var(--primary-green); color:white;">+ Empresa</button>
          <button onclick="switchTab('trabajadores')" style="padding:10px; border-radius:8px; border:0; background:var(--primary-green); color:white;">+ Trabajador</button>
        </div>
      </div>
    `;
  }

  if (tab === 'documentos') {
    container.innerHTML = `
      <div class="card">
        <h2>Revisión documental</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Trabajador</th><th>Tipo / Archivo</th><th>Vence</th><th>Estado</th></tr></thead>
            <tbody>
              ${data.docs.map(d => `
                <tr>
                  <td>${getWorkerName(d.workerId)}</td>
                  <td><strong>${d.type}</strong><br><small>${d.fileName}</small></td>
                  <td>${d.expiry}</td>
                  <td><span class="pill ${getStatus(d) === 'Aprobado' ? 'success' : 'warning'}">${getStatus(d)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  
  // Los demás tabs (empresas, trabajadores, etc.) puedes agregarlos siguiendo esta misma lógica de inyección de HTML.
}
