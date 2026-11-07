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

// --- 5. INICIALIZACIÓN Y SESIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('current-date').textContent = `Actualizado: ${today()}`;
  
  const sesionGuardada = localStorage.getItem('sst_sesion');
  
  if (sesionGuardada) {
    sesion = JSON.parse(sesionGuardada);
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'block';
    document.getElementById('tab-content').innerHTML = '<p>Cargando datos desde la nube...</p>';
    await cargarDatosNube();
    renderSidebar();
    renderTab('panel');
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userInput = document.getElementById('usuario').value.trim();
    
    document.getElementById('tab-content').innerHTML = '<p>Cargando datos desde la nube...</p>';
    await cargarDatosNube();

    if (userInput.toLowerCase() === 'admin') {
      sesion = { rol: 'admin', empresaId: null };
    } else {
      const empresaEncontrada = data.companies.find(c => c.ruc === userInput);
      if (empresaEncontrada) {
        sesion = { rol: 'contratista', empresaId: empresaEncontrada.id };
      } else {
        alert('Usuario no válido. Ingresa "admin" o el RUC de una empresa registrada.');
        document.getElementById('login-view').style.display = 'flex';
        document.getElementById('app-view').style.display = 'none';
        return;
      }
    }

    localStorage.setItem('sst_sesion', JSON.stringify(sesion));

    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'block';
    renderSidebar();
    renderTab('panel');
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if(confirm('¿Cerrar sesión actual?')) {
      localStorage.removeItem('sst_sesion');
      location.reload();
    }
  });
});

// --- 6. RENDERIZADO ---
function renderSidebar() {
  const nav = document.getElementById('sidebar');
  const tabs = [
    ['panel', '📊', 'Panel general'], ['empresas', '🏭', 'Empresas'],
    ['trabajadores', '👷', 'Trabajadores'], ['documentos', '📋', 'Documentos SST'],
    ['autorizaciones', '🛡️', 'Autorizaciones']
  ];
  
  // Si es contratista, ocultamos la pestaña "Empresas"
  nav.innerHTML = tabs
    .filter(([id]) => sesion.rol === 'admin' || id !== 'empresas')
    .map(([id, icon, label]) => `<button class="nav ${currentTab === id ? 'active' : ''}" onclick="switchTab('${id}')"><span>${icon}</span> ${label}</button>`)
    .join('') + `<div class="side-note">Agro Industrial Paramonga S.A.<br />Proyecto A.C · SENATI</div>`;
}

window.switchTab = (tab) => {
  currentTab = tab;
  renderSidebar();
  renderTab(tab);
};

function renderTab(tab) {
  const titles = { panel: 'Panel general', empresas: 'Empresas contratistas', trabajadores: 'Mis Trabajadores', documentos: 'Documentos SST', autorizaciones: 'Autorización de ingreso' };
  document.getElementById('page-title').textContent = titles[tab] || 'Panel';
  const container = document.getElementById('tab-content');
  container.innerHTML = '';

  // --- PANEL GENERAL (Diferente vista para Admin y Contratista) ---
  if (tab === 'panel') {
    
    // 1. VISTA DE ADMINISTRADOR
    if (sesion.rol === 'admin') {
      container.innerHTML = `
        <div style="margin-bottom: 20px;">
          <h3 style="color: var(--primary-green); font-size: 18px;">Panel de Control Global (Administrador)</h3>
          <p style="color: #666; font-size: 14px;">Resumen de cumplimiento de todas las empresas contratistas.</p>
        </div>

        <div class="card">
          <h2>🏭 Resumen por Empresa</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Total Trabajadores</th>
                  <th>Autorizados</th>
                  <th>Docs Vencidos</th>
                </tr>
              </thead>
              <tbody>
                ${data.companies.map(c => {
                  const trabajadoresEmpresa = data.workers.filter(w => w.companyId === c.id);
                  const docsEmpresa = data.docs.filter(d => trabajadoresEmpresa.some(t => t.id === d.workerId));
                  const autorizados = trabajadoresEmpresa.filter(w => checkAccess(w) === 'Autorizado').length;
                  const vencidos = docsEmpresa.filter(d => getStatus(d) === 'Vencido').length;

                  return `
                    <tr>
                      <td><strong>${c.name}</strong><br><small>RUC: ${c.ruc}</small></td>
                      <td>${trabajadoresEmpresa.length}</td>
                      <td><span class="pill success">${autorizados} Autorizados</span></td>
                      <td><span class="pill ${vencidos > 0 ? 'danger' : 'success'}">${vencidos} Vencidos</span></td>
                    </tr>
                  `;
                }).join('')}
                ${data.companies.length === 0 ? '<tr><td colspan="4">No hay empresas registradas.</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } 
    
    // 2. VISTA DE CONTRATISTA
    else {
      const misTrabajadores = data.workers.filter(w => w.companyId === sesion.empresaId);
      const misDocumentos = data.docs.filter(d => misTrabajadores.some(t => t.id === d.workerId));
      
      const autorizados = misTrabajadores.filter(w => checkAccess(w) === 'Autorizado');
      const noAutorizados = misTrabajadores.filter(w => checkAccess(w) === 'No autorizado');
      const vencidos = misDocumentos.filter(d => getStatus(d) === 'Vencido');
      
      const nombreEmpresa = getCompanyName(sesion.empresaId);
      
      container.innerHTML = `
        <div style="margin-bottom: 20px;">
          <h3 style="color: var(--primary-green); font-size: 18px;">Panel de control: ${nombreEmpresa}</h3>
        </div>

        <div class="stats" style="margin-bottom: 30px;">
          <div class="stat" style="cursor:pointer;" onclick="switchTab('trabajadores')">
            <span style="font-size: 30px;">👷</span>
            <strong>${misTrabajadores.length}</strong>
            <small>Mis Trabajadores</small>
          </div>
          <div class="stat" style="cursor:pointer;" onclick="switchTab('autorizaciones')">
            <span style="font-size: 30px; color: #008b45;">🛡️</span>
            <strong style="color: #008b45;">${autorizados.length}</strong>
            <small>Aptos para ingreso</small>
          </div>
          <div class="stat" style="cursor:pointer;" onclick="switchTab('documentos')">
            <span style="font-size: 30px; color: #e60033;">⚠️</span>
            <strong style="color: #e60033;">${vencidos.length}</strong>
            <small>Docs vencidos</small>
          </div>
        </div>

        <div class="card">
          <h2>👷 Detalle de mi Personal</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>DNI</th><th>Cargo</th><th>Estado de Ingreso</th></tr></thead>
              <tbody>
                ${misTrabajadores.length === 0 ? '<tr><td colspan="4">No hay trabajadores registrados.</td></tr>' : ''}
                ${misTrabajadores.map(w => {
                  const isAuth = checkAccess(w) === 'Autorizado';
                  return `<tr>
                    <td>${w.name}</td>
                    <td>${w.dni}</td>
                    <td>${w.role}</td>
                    <td><span class="pill ${isAuth ? 'success' : 'danger'}">${isAuth ? 'Autorizado' : 'No autorizado'}</span></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h2>⚠️ Mis Documentos Vencidos</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Trabajador</th><th>Tipo de Documento</th><th>Fecha de Vencimiento</th></tr></thead>
              <tbody>
                ${vencidos.length === 0 ? '<tr><td colspan="3">¡Buenas noticias! No tienes documentos vencidos.</td></tr>' : ''}
                ${vencidos.map(d => `
                  <tr>
                    <td>${getWorkerName(d.workerId)}</td>
                    <td><strong>${d.type}</strong></td>
                    <td><span style="color: #e60033; font-weight: bold;">${d.expiry}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h2>🚫 Personal No Autorizado</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Trabajador</th><th>Documentos Faltantes</th></tr></thead>
              <tbody>
                ${noAutorizados.length === 0 ? '<tr><td colspan="2">Todo tu personal está autorizado.</td></tr>' : ''}
                ${noAutorizados.map(w => {
                  const records = misDocumentos.filter(d => d.workerId === w.id);
                  const faltantes = REQUISITOS_OBLIGATORIOS.filter(req => 
                    !records.some(d => d.type === req && getStatus(d) === 'Aprobado')
                  );
                  return `<tr>
                    <td>${w.name}</td>
                    <td>
                      ${faltantes.length > 0 ? faltantes.map(f => `<span class="pill warning" style="margin-right: 5px;">Falta: ${f}</span>`).join('') : 'Documentos en revisión'}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  // --- EMPRESAS (Solo admin) ---
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

  // --- TRABAJADORES (Filtrado según rol) ---
  if (tab === 'trabajadores') {
    const misTrabajadores = sesion.rol === 'admin' ? data.workers : data.workers.filter(w => w.companyId === sesion.empresaId);
    const misEmpresas = sesion.rol === 'admin' ? data.companies : data.companies.filter(c => c.id === sesion.empresaId);

    container.innerHTML = `
      <div class="card">
        <h2>Registrar trabajador</h2>
        <form class="form" id="form-trabajador">
          <label>Nombre completo<input type="text" id="trab-name" required /></label>
          <label>DNI (8 dígitos)<input type="text" id="trab-dni" required maxlength="8" /></label>
          <label>Empresa
            <select id="trab-empresa" required>
              <option value="">Selecciona una empresa</option>
              ${misEmpresas.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
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
              ${misTrabajadores.length === 0 ? '<tr><td colspan="4">No hay trabajadores registrados.</td></tr>' : ''}
              ${misTrabajadores.map(w => `<tr><td>${w.name}</td><td>${w.dni}</td><td>${getCompanyName(w.companyId)}</td><td>${w.role}</td></tr>`).join('')}
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

  // --- DOCUMENTOS (Filtrado según rol) ---
  if (tab === 'documentos') {
    const misTrabajadores = sesion.rol === 'admin' ? data.workers : data.workers.filter(w => w.companyId === sesion.empresaId);
    const misDocumentos = sesion.rol === 'admin' ? data.docs : data.docs.filter(d => misTrabajadores.some(t => t.id === d.workerId));

    container.innerHTML = `
      <div class="card">
        <h2>Registrar documento SST</h2>
        <form class="form" id="form-documento">
          <label>Trabajador
            <select id="doc-trabajador" required>
              <option value="">Selecciona trabajador</option>
              ${misTrabajadores.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
            </select>
          </label>
          <label>Tipo de documento
            <select id="doc-tipo" required>
              ${REQUISITOS_OBLIGATORIOS.map(r => `<option value="${r}">${r}</option>`).join('')}
              <option value="Capacitación SST">Capacitación SST</option>
              <option value="Entrega de EPP">Entrega de EPP</option>
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
              ${misDocumentos.length === 0 ? '<tr><td colspan="4">No hay documentos registrados.</td></tr>' : ''}
              ${misDocumentos.map(d => `
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
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage.from('documentos-sst').upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseClient.storage.from('documentos-sst').getPublicUrl(fileName);

        const { error: dbError } = await supabaseClient.from('documentos').insert([{
          trabajador_id: document.getElementById('doc-trabajador').value,
          tipo: document.getElementById('doc-tipo').value,
          vencimiento: document.getElementById('doc-vencimiento').value,
          estado: 'Pendiente', 
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

  // --- AUTORIZACIONES (Filtrado según rol) ---
  if (tab === 'autorizaciones') {
    const misTrabajadores = sesion.rol === 'admin' ? data.workers : data.workers.filter(w => w.companyId === sesion.empresaId);

    container.innerHTML = `
      <div class="card">
        <h2>Verificación de ingreso</h2>
        <p>Para mostrar «Autorizado», el trabajador debe tener todos los requisitos obligatorios aprobados y vigentes.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Trabajador</th><th>Empresa</th><th>Requisitos</th><th>Estado</th></tr></thead>
            <tbody>
              ${misTrabajadores.length === 0 ? '<tr><td colspan="4">No hay trabajadores registrados.</td></tr>' : ''}
              ${misTrabajadores.map(w => {
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