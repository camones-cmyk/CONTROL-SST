const SUPABASE_URL = 'https://xyfpczgklaaszuvaqvoa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cZB78KSsrmef0DfHREkTlA_kiaTPB9h';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let sesion = null;
let currentTab = 'panel';

document.addEventListener('DOMContentLoaded', () => {
  const fecha = new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('current-date').textContent = `Actualizado: ${fecha}`;
  
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
    location.reload(); 
  });
});

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
    .join('') + `<div class="side-note">Agro Industrial Paramonga S.A.</div>`;
}

window.switchTab = (tab) => {
  currentTab = tab;
  renderSidebar();
  renderTab(tab);
};

const ACTIVIDADES = [
  'Todas las actividades', 
  'Mantenimiento mecánico', 'Trabajo en altura', 'Trabajo en caliente', 
  'Trabajo eléctrico', 'Espacios confinados', 'Limpieza industrial', 'Izaje de cargas'
];

// Lista exacta de tus 8 requisitos (para armar la matriz perfecta)
const TODOS_LOS_REQUISITOS = [
  "DNI del trabajador",
  "Seguro Complementario de Trabajo de Riesgo (SCTR)",
  "IPERC",
  "Registro de entrega de equipos de protección personal (EPP)",
  "Certificado del prevencionista",
  "Certificados de capacitación para trabajos de alto riesgo",
  "Inducción de Seguridad y Salud en el Trabajo (SST)",
  "Examen médico ocupacional (EMO)"
];

async function renderTab(tab) {
  const titles = { panel: 'Panel general', empresas: 'Empresas contratistas', trabajadores: 'Trabajadores', documentos: 'Documentos SST', autorizaciones: 'Autorización de ingreso', requisitos: 'Requisitos SST', configuracion: 'Configuración' };
  document.getElementById('page-title').textContent = titles[tab] || 'Panel';
  const container = document.getElementById('tab-content');
  container.innerHTML = '<p>Cargando datos...</p>';

  if (tab === 'empresas') {
    const { data: empresas, error } = await db.from('empresas').select('*');
    
    if (error) {
      container.innerHTML = `<p>Error al cargar: ${error.message}</p>`;
      return;
    }

    const opcionesActividades = ACTIVIDADES.map(act => `<option value="${act}">${act}</option>`).join('');

    container.innerHTML = `
      <div class="card">
        <h2>Registrar empresa contratista</h2>
        <form class="form" id="form-empresa">
          <label>Razón social<input type="text" id="empresa-nombre" required></label>
          <label>RUC (11 dígitos)<input type="text" id="empresa-ruc" required></label>
          <label>Contacto<input type="text" id="empresa-contacto" required></label>
          <label>Actividad principal
            <select id="empresa-actividad" required>
              <option value="">Seleccione actividad...</option>
              ${opcionesActividades}
            </select>
          </label>
          <button type="submit">Guardar Empresa</button>
        </form>
      </div>
      <div class="card">
        <h2>Empresas registradas</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Razón social</th><th>RUC</th><th>Contacto</th><th>Actividad</th></tr></thead>
            <tbody>
              ${empresas.length === 0 ? '<tr><td colspan="4">No hay empresas registradas.</td></tr>' : 
                empresas.map(e => `<tr><td>${e.nombre}</td><td>${e.ruc}</td><td>${e.contacto}</td><td><span class="pill success">${e.actividad || 'No asignada'}</span></td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('form-empresa').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nuevaEmpresa = {
        nombre: document.getElementById('empresa-nombre').value,
        ruc: document.getElementById('empresa-ruc').value,
        contacto: document.getElementById('empresa-contacto').value,
        actividad: document.getElementById('empresa-actividad').value
      };
      
      const { error } = await db.from('empresas').insert([nuevaEmpresa]);
      if (error) {
        alert('Error al guardar: ' + error.message);
      } else {
        alert('Empresa guardada con éxito');
        renderTab('empresas');
      }
    });
  } 
  else if (tab === 'trabajadores') {
    const { data: empresas } = await db.from('empresas').select('*');
    
    if(!empresas || empresas.length === 0) {
      container.innerHTML = `<div class="card"><p>Primero debes registrar una empresa para poder ver sus requisitos.</p></div>`;
      return;
    }

    // Permitimos elegir qué empresa ver mediante un pequeño selector
    const opcionesEmpresas = empresas.map(e => `<option value="${e.id}">${e.nombre} (${e.actividad})</option>`).join('');
    
    container.innerHTML = `
      <div class="card">
        <h2>Seleccionar Empresa para ver requisitos</h2>
        <select id="select-empresa" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; margin-bottom:15px;">
          ${opcionesEmpresas}
        </select>
        <div id="lista-reqs-container"></div>
      </div>
    `;

    async function cargarRequisitosDeEmpresa(empresaId) {
      const emp = empresas.find(e => e.id == empresaId);
      const div = document.getElementById('lista-reqs-container');
      div.innerHTML = '<p>Cargando requisitos...</p>';

      let listaRequisitos = '';

      if (emp.actividad === 'Todas las actividades') {
        listaRequisitos = TODOS_LOS_REQUISITOS.map(req => `<li>${req}</li>`).join('');
      } else {
        const { data: reqs } = await db.from('matriz_requisitos').select('requisito').eq('actividad', emp.actividad);
        listaRequisitos = reqs && reqs.length > 0 
          ? reqs.map(r => `<li>${r.requisito}</li>`).join('') 
          : '<li>No hay requisitos definidos para esta actividad.</li>';
      }

      div.innerHTML = `
        <p>Basado en su actividad: <strong>${emp.actividad}</strong></p>
        <div style="background:#f2f8f4; padding:15px; border-radius:8px; margin-top:15px;">
          <h3>Documentos que debe presentar el trabajador:</h3>
          <ul style="margin-top:10px; margin-left:20px; line-height:1.8;">
            ${listaRequisitos}
          </ul>
        </div>
      `;
    }

    // Cargar la primera empresa por defecto
    cargarRequisitosDeEmpresa(empresas[0].id);

    // Escuchar cambios en el selector
    document.getElementById('select-empresa').addEventListener('change', (e) => {
      cargarRequisitosDeEmpresa(e.target.value);
    });
  }
  else if (tab === 'requisitos') {
    const { data: reqs, error } = await db.from('matriz_requisitos').select('*');
    
    if (error) {
      container.innerHTML = `<p>Error al cargar la matriz: ${error.message}</p>`;
      return;
    }

    const columnasMatriz = ACTIVIDADES.filter(a => a !== 'Todas las actividades');

    let thead = `<tr><th>Requisitos de SST</th>${columnasMatriz.map(a => `<th>${a}</th>`).join('')}</tr>`;
    
    // Usamos la lista fija de 8 requisitos para que siempre pinte las filas
    let tbody = TODOS_LOS_REQUISITOS.map(reqName => {
      let row = `<tr><td>${reqName}</td>`;
      columnasMatriz.forEach(act => {
        const aplica = reqs.some(r => r.requisito === reqName && r.actividad === act);
        row += `<td style="text-align:center;">${aplica ? '<span class="pill success">X</span>' : '<span style="color:#ccc;">-</span>'}</td>`;
      });
      row += `</tr>`;
      return row;
    }).join('');

    container.innerHTML = `
      <div class="card">
        <h2>Matriz de Requisitos por Actividad</h2>
        <p>Esta matriz muestra los documentos exigidos según el tipo de trabajo del contratista.</p>
        <div class="table-wrap" style="margin-top:20px;">
          <table>
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      </div>
    `;
  }
  else if (tab === 'panel') {
     container.innerHTML = `<div class="card"><h2>Bienvenido al Panel de Control</h2><p>Selecciona una opción del menú izquierdo para gestionar la información.</p></div>`;
  } else {
    container.innerHTML = `<div class="card"><h2>Sección en construcción</h2><p>Esta vista estará disponible próximamente.</p></div>`;
  }
}
