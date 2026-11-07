// --- 1. CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://xyfpczgklaaszuvaqvoa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cZB78KSsrmef0DfHREkTlA_kiaTPB9h';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. VARIABLES GLOBALES ---
let sesion = null;
let data = { companies: [], workers: [], docs: [] };
let currentTab = 'panel';

// --- 3. UTILIDADES ---
const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (date) => date ? Math.ceil((new Date(`${date}T12:00:00`) - new Date(`${today()}T12:00:00`)) / 86400000) : null;
const getStatus = (doc) => (doc.expiry && daysUntil(doc.expiry) < 0) ? 'Vencido' : doc.status;
const getCompanyName = (id) => data.companies.find(c => c.id === id)?.name || 'Sin empresa';
const getWorkerName = (id) => data.workers.find(w => w.id === id)?.name || 'Sin trabajador';

// Requisitos base para autorizar (puedes cambiarlos aquí)
const REQUISITOS_OBLIGATORIOS = ['SCTR', 'Inducción SST', 'Examen médico ocupacional'];

const checkAccess = (worker) => {
  const records = data.docs.filter(d => d.workerId === worker.id);
  return REQUISITOS_OBLIGATORIOS.every(type => 
    records.some(d => d.type === type && getStatus(d) === 'Aprobado')
  ) ? 'Autorizado' : 'No autorizado';
};

// --- 4. CARGAR DATOS DESDE SUPABASE ---
async function cargarDatosNube() {
  try {
    const { data: empresas, error: e1 } = await supabaseClient.from('empresas').select('*').order('nombre');
    if (e1) throw e1;
    
    const { data: trabajadores, error: e2 } = await supabaseClient.from('trabajadores').select('*').order('nombre');
    if (e2) throw e2;
    
    const { data: documentos, error: e3 } = await supabaseClient.from('documentos').select('*');
    if (e3) throw e3;

    data.companies = empresas.map(e => ({ id: e.id, name: e.nombre, ruc: e.ruc, contact: e.contacto }));
    data.workers = trabajadores.map(t => ({ id: t.id, name: t.nombre, dni: t.dni, companyId: t.empresa_id, role: t.cargo }));
    data.docs = documentos.map(d => ({ id: d.id, workerId: d.trabajador_id, type: d.tipo, expiry: d.vencimiento, status: d.estado, fileName: d.archivo_nombre, fileUrl: d.archivo_url }));
    
  } catch (error) {
    console.error("Error cargando datos:", error);
    alert("Error al conectar con la base de datos. Revisa la consola (F12).");
  }
}

// --- 5. INICIALIZACIÓN Y LOGIN ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('current-date').textContent = `Actualizado: ${today()}`;
  
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('usuario').value.trim().toLowerCase();
    sesion = { rol: user === 'admin' ? 'admin' : 'contratista' };
    
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'block';
    
    // Mostrar mensaje de carga
    document.getElementById('tab-content').innerHTML = '<p>Cargando datos desde la nube...</p>';
    
    await cargarDatosNube();
    renderSidebar();
    renderTab('panel');
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    alert('Para borrar datos, hazlo directamente desde el panel de Supabase.');
  });
});

// --- 6. RENDERIZADO ---
function renderSidebar() {
  const nav = document.getElementById('sidebar');
  const tabs = [
    ['panel', '📊', 'Panel general'], ['empresas', '🏭', 'Empresas'],
    ['trabajadores', '👷', 'Trabajadores'], ['documentos', '📋', 'Documentos SST'],
    ['autorizaciones', '🛡️', 'Autorizaciones'], ['configuracion', '⚙️', 'Configuración']
  ];
  
  nav.innerHTML = tabs
    .filter(([id]) => sesion.rol === 'admin' || id !== 'configuracion')
    .map(([id, icon, label]) => `<button class="nav ${currentTab === id ? 'active' : ''}" onclick="switchTab('${id}')"><span>${icon}</span> ${label}</button>`)
    .join('') + `<div class="side-note">Agro Industrial Paramonga S.A.<br />Proyecto A.C · SENATI</div>`;
}

window.switchTab = (tab) => {
  currentTab = tab;
  renderSidebar();
  renderTab(tab);
};

function renderTab(tab) {
  const titles = { panel: 'Panel general', empresas: 'Empresas contratistas', trabajadores: 'Trabajadores', documentos: 'Documentos SST', autorizaciones: 'Autorización de ingreso', configuracion: 'Configuración' };
  document.getElementById('page-title').textContent = titles[tab] || 'Panel';
  const container = document.getElementById('tab-content');
  container.innerHTML = '';

  // --- PANEL GENERAL ---
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
    `;
  }

  // --- EMPRESAS ---
  if (tab === 'empresas') {
    container.innerHTML = `
      <div class="card">
        <h2>Registrar empresa</h2>
        <form class="form" id="form-empresa">
          <label>Razón social<input type="text" id="emp-name" required placeholder="Ej: Servicios SAC" /></label>
          <label>RUC (11 dígitos)<input type="text" id="emp-ruc" required maxlength="11" placeholder="20123456789" /></label>
          <label>Contacto<input type="text" id="emp-contact" required placeholder="Nombre de contacto" /></label>
          <button type="submit">Guardar en Nube</button>
        </form>
      </div>
      <div class="card">
        <h2>Empresas registradas</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Razón social</th><th>RUC</th><th>Contacto</th></tr></thead>
            <tbody>
              ${data.companies.length === 0 ? '<tr><td colspan="3">No hay empresas registradas.</td></tr>' : ''}
              ${data.companies.map(c => `<tr><td>${c.name}</td><td>${c.ruc}</td><td>${c.contact}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    document.getElementById('form-empresa').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.textContent = 'Guardando...'; btn.disabled = true;

      const { error } = await supabaseClient.from('empresas').insert([{
        nombre: document.getElementById('emp-name').value,
        ruc: document.getElementById('emp-ruc').value,
        contacto: document.getElementById('emp-contact').value
      }]);

      if (error) {
        alert("Error: " + error.message);
        btn.textContent = 'Guardar en Nube'; btn.disabled = false;
      } else {
        await cargarDatosNube();
        renderTab('empresas');
      }
    });
  }

  // --- TRABAJADORES ---
  if (tab === 'trabajadores') {
    container.innerHTML = `
      <div class="card">
        <h2>Registrar trabajador</h2>
        <form class="form" id="form-trabajador">
          <label>Nombre completo<input type="text" id="trab-name" required /></label>
          <label>DNI (8 dígitos)<input type="text" id="trab-dni" required maxlength="8" /></label>
          <label>Empresa
            <select id="trab-empresa" required>
              <option value="">Selecciona una empresa</option>
              ${data.companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </label>
          <label>Cargo<input type="text" id="trab-role" required /></label>
          <button type="submit">Guardar en Nube</button>
        </form>
      </div>
      <div class="card">
        <h2>Trabajadores registrados</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>DNI</th><th>Empresa</th><th>Cargo</th></tr></thead>
            <tbody>
              ${data.workers.length === 0 ? '<tr><td colspan="4">No hay trabajadores registrados.</td></tr>' : ''}
              ${data.workers.map(w => `<tr><td>${w.name}</td><td>${w.dni}</td><td>${getCompanyName(w.companyId)}</td><td>${w.role}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('form-trabajador').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.textContent = 'Guardando...'; btn.disabled = true;

      const { error } = await supabaseClient.from('trabajadores').insert([{
        nombre: document.getElementById('trab-name').value,
        dni: document.getElementById('trab-dni').value,
        empresa_id: document.getElementById('trab-empresa').value,
        cargo: document.getElementById('trab-role').value
      }]);

      if (error) {
        alert("Error: " + error.message);
        btn.textContent = 'Guardar en Nube'; btn.disabled = false;
      } else {
        await cargarDatosNube();
        renderTab('trabajadores');
      }
    });
  }

  // --- DOCUMENTOS ---
  if (tab === 'documentos') {
    container.innerHTML = `
      <div class="card">
        <h2>Registrar documento SST</h2>
        <form class="form" id="form-documento">
          <label>Trabajador
            <select id="doc-trabajador" required>
              <option value="">Selecciona trabajador</option>
              ${data.workers.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
            </select>
          </label>
          <label>Tipo de documento
            <select id="doc-tipo" required>
              <option value="SCTR">SCTR</option>
              <option value="Inducción SST">Inducción SST</option>
              <option value="Examen médico ocupacional">Examen médico ocupacional</option>
              <option value="Capacitación SST">Capacitación SST</option>
            </select>
          </label>
          <label>Fecha de vencimiento<input type="date" id="doc-vencimiento" required /></label>
          <label>Archivo (PDF/Imagen)<input type="file" id="doc-archivo" required /></label>
          <button type="submit">Subir a Nube</button>
        </form>
      </div>
      <div class="card">
        <h2>Revisión documental</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Trabajador</th><th>Tipo / Archivo</th><th>Vence</th><th>Estado</th></tr></thead>
            <tbody>
              ${data.docs.length === 0 ? '<tr><td colspan="4">No hay documentos registrados.</td></tr>' : ''}
              ${data.docs.map(d => `
                <tr>
                  <td>${getWorkerName(d.workerId)}</td>
                  <td><strong>${d.type}</strong><br><small>${d.fileName || 'Sin archivo'}</small></td>
                  <td>${d.expiry}</td>
                  <td><span class="pill ${getStatus(d) === 'Aprobado' ? 'success' : 'warning'}">${getStatus(d)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('form-documento').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      const fileInput = document.getElementById('doc-archivo');
      const file = fileInput.files[0];
      
      if (!file) return alert('Selecciona un archivo');
      
      btn.textContent = 'Subiendo archivo...'; btn.disabled = true;

      try {
        // 1. Subir archivo a Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage
          .from('documentos-sst')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // 2. Obtener URL pública del archivo
        const { data: urlData } = supabaseClient.storage
          .from('documentos-sst')
          .getPublicUrl(fileName);

        // 3. Guardar registro en la tabla 'documentos'
        const { error: dbError } = await supabaseClient.from('documentos').insert([{
          trabajador_id: document.getElementById('doc-trabajador').value,
          tipo: document.getElementById('doc-tipo').value,
          vencimiento: document.getElementById('doc-vencimiento').value,
          estado: 'Pendiente', // Por defecto
          archivo_nombre: file.name,
          archivo_url: urlData.publicUrl
        }]);

        if (dbError) throw dbError;

        await cargarDatosNube();
        renderTab('documentos');
        alert('Documento subido correctamente a la nube.');

      } catch (error) {
        console.error(error);
        alert('Error al subir: ' + error.message);
        btn.textContent = 'Subir a Nube'; btn.disabled = false;
      }
    });
  }

  // --- AUTORIZACIONES ---
  if (tab === 'autorizaciones') {
    container.innerHTML = `
      <div class="card">
        <h2>Verificación de ingreso</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Trabajador</th><th>Empresa</th><th>Requisitos</th><th>Estado</th></tr></thead>
            <tbody>
              ${data.workers.map(w => {
                const records = data.docs.filter(d => d.workerId === w.id);
                const reqsHtml = REQUISITOS_OBLIGATORIOS.map(type => {
                  const hasIt = records.some(d => d.type === type && getStatus(d) === 'Aprobado');
                  return `<div style="font-size:12px; margin:2px 0;">${hasIt ? '✓' : '○'} ${type}</div>`;
                }).join('');
                
                const isAuth = checkAccess(w) === 'Autorizado';
                return `
                  <tr>
                    <td>${w.name}</td>
                    <td>${getCompanyName(w.companyId)}</td>
                    <td>${reqsHtml}</td>
                    <td><span class="pill ${isAuth ? 'success' : 'danger'}">${isAuth ? 'Autorizado' : 'No autorizado'}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}
