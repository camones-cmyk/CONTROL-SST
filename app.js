const SUPABASE_URL = 'https://xyfpczgklaaszuvaqvoa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cZB78KSsrmef0DfHREkTlA_kiaTPB9h';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
  'Mantenimiento mecánico', 'Trabajo en altura', 'Trabajo en caliente', 
  'Trabajo eléctrico', 'Espacios confinados', 'Limpieza industrial', 'Izaje de cargas'
];

async function renderTab(tab) {
  const titles = { panel: 'Panel general', empresas: 'Empresas contratistas', trabajadores: 'Trabajadores', documentos: 'Documentos SST', autorizaciones: 'Autorización de ingreso', requisitos: 'Requisitos SST', configuracion: 'Configuración' };
  document.getElementById('page-title').textContent = titles[tab] || 'Panel';
  const container = document.getElementById('tab-content');
  container.innerHTML = '<p>Cargando datos...</p>';

  if (tab === 'empresas') {
    // Cargamos las empresas
    const { data: empresas, error } = await supabase.from('empresas').select('*');
    
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
      
      const { error } = await supabase.from('empresas').insert([nuevaEmpresa]);
      if (error) {
        alert('Error al guardar: ' + error.message);
      } else {
        alert('Empresa guardada con éxito');
        renderTab('empresas'); // Recargar la tabla
      }
    });
  } 
  else if (tab === 'trabajadores') {
    // Aquí mostramos los requisitos según la actividad de la empresa
    const { data: empresas } = await supabase.from('empresas').select('*');
    
    if(!empresas || empresas.length === 0) {
      container.innerHTML = `<div class="card"><p>Primero debes registrar una empresa para poder ver sus requisitos.</p></div>`;
      return;
    }

    // Tomamos la primera empresa para mostrar el ejemplo
    const emp = empresas[0];
    const { data: reqs } = await supabase.from('matriz_requisitos').select('requisito').eq('actividad', emp.actividad);
    
    const listaRequisitos = reqs && reqs.length > 0 
      ? reqs.map(r => `<li>${r.requisito}</li>`).join('') 
      : '<li>No hay requisitos definidos para esta actividad.</li>';

    container.innerHTML = `
      <div class="card">
        <h2>Requisitos para: ${emp.nombre}</h2>
        <p>Basado en su actividad: <strong>${emp.actividad || 'Sin actividad'}</strong></p>
        <div style="background:#f2f8f4; padding:15px; border-radius:8px; margin-top:15px;">
          <h3>Documentos que debe presentar el trabajador:</h3>
          <ul style="margin-top:10px; margin-left:20px; line-height:1.8;">
            ${listaRequisitos}
          </ul>
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
