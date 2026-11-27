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
    const user = document.getElementById('usuario').value.trim();
    
    if (user.toLowerCase() === 'admin') {
      sesion = { rol: 'admin', ruc: null };
      iniciarApp('empresas'); // El admin inicia directo en Empresas
    } else {
      sesion = { rol: 'contratista', ruc: user };
      iniciarApp('trabajadores'); // La contrata inicia directo en Trabajadores
    }
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    location.reload(); 
  });
});

function iniciarApp(tabInicial) {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('app-view').style.display = 'block';
  renderSidebar();
  renderTab(tabInicial);
}

function renderSidebar() {
  const nav = document.getElementById('sidebar');
  const tabs = [
    ['panel', '📊', 'Panel general'], ['empresas', '🏭', 'Empresas'],
    ['trabajadores', '👷', 'Trabajadores'], ['documentos', '📋', 'Documentos SST'],
    ['autorizaciones', '🛡️', 'Autorizaciones'], ['requisitos', '⚙️', 'Requisitos'],
    ['configuracion', '⚙️', 'Configuración']
  ];

  // Filtramos las opciones: Las contratas no ven Empresas, Requisitos ni Configuración
  nav.innerHTML = tabs
    .filter(([id]) => {
      if (sesion.rol === 'admin') return true;
      return id !== 'empresas' && id !== 'requisitos' && id !== 'configuracion'; 
    })
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

  // ==========================================
  // VISTA: EMPRESAS (Solo para el admin)
  // ==========================================
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
          <label>RUC (11 dígitos - será el usuario)<input type="text" id="empresa-ruc" required></label>
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
        alert('Empresa guardada con éxito. Ya puede entrar con su RUC.');
        renderTab('empresas');
      }
    });
  } 
  // ==========================================
  // VISTA: TRABAJADORES (Aquí la contrata registra a su gente)
  // ==========================================
  else if (tab === 'trabajadores') {
    let empresas = [];

    // Si es admin, ve todas para elegir. Si es contrata, solo ve la suya.
    if (sesion.rol === 'admin') {
      const { data } = await db.from('empresas').select('*');
      empresas = data;
    } else {
      const { data } = await db.from('empresas').select('*').eq('ruc', sesion.ruc);
      empresas = data;
    }
    
    if(!empresas || empresas.length === 0) {
      container.innerHTML = `<div class="card"><p>No se encontró tu empresa asociada a este RUC. Contacta al administrador.</p></div>`;
      return;
    }

    const opcionesEmpresas = empresas.map(e => `<option value="${e.id}">${e.nombre} (${e.actividad})</option>`).join('');
    
    container.innerHTML = `
      <div class="card">
        <h2>Gestión de Trabajadores y Requisitos</h2>
        
        ${sesion.rol === 'admin' ? `
          <label style="display:block; margin-bottom:15px;">Seleccionar Empresa (Vista Admin)
            <select id="select-empresa" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc;">
              ${opcionesEmpresas}
            </select>
          </label>
        ` : `
          <p style="margin-bottom:20px;">Bienvenido. Estás gestionando los documentos de: <strong>${empresas[0].nombre}</strong></p>
        `}
        
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
        <div style="background:#f2f8f4; padding:15px; border-radius:8px; margin-bottom:20px;">
          <h3>Documentos exigidos para tu actividad:</h3>
          <ul style="margin-top:10px; margin-left:20px; line-height:1.8;">
            ${listaRequisitos}
          </ul>
        </div>
        
        <div style="border-top: 1px solid #ddd; padding-top: 20px;">
          <h3>Registrar nuevo trabajador</h3>
          <p style="font-size:13px; color:#666; margin-bottom:10px;">(Aquí irá el formulario para ingresar al trabajador y subir sus PDFs)</p>
          <button style="padding:10px 15px; background:var(--primary-green); color:white; border:none; border-radius:5px; cursor:pointer;">+ Agregar Trabajador</button>
        </div>
      `;
    }

    cargarRequisitosDeEmpresa(empresas[0].id);

    if (sesion.rol === 'admin') {
      document.getElementById('select-empresa').addEventListener('change', (e) => {
        cargarRequisitosDeEmpresa(e.target.value);
      });
    }
  }
  // ==========================================
  // VISTA: REQUISITOS (Matriz - Solo Admin)
  // ==========================================
  else if (tab === 'requisitos') {
    const { data: reqs, error } = await db.from('matriz_requisitos').select('*');
    
    if (error) {
      container.innerHTML = `<p>Error al cargar la matriz: ${error.message}</p>`;
      return;
    }

    const columnasMatriz = ACTIVIDADES.filter(a => a !== 'Todas las actividades');
    let thead = `<tr><th>Requisitos de SST</th>${columnasMatriz.map(a => `<th>${a}</th>`).join('')}</tr>`;
    
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
