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
      iniciarApp('empresas');
    } else {
      sesion = { rol: 'contratista', ruc: user };
      iniciarApp('trabajadores');
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
  'Todas las actividades', 'Mantenimiento mecánico', 'Trabajo en altura', 'Trabajo en caliente', 
  'Trabajo eléctrico', 'Espacios confinados', 'Limpieza industrial', 'Izaje de cargas'
];

async function renderTab(tab) {
  const titles = { panel: 'Panel general', empresas: 'Empresas contratistas', trabajadores: 'Trabajadores', documentos: 'Documentos SST', autorizaciones: 'Autorización de ingreso', requisitos: 'Requisitos SST', configuracion: 'Configuración' };
  document.getElementById('page-title').textContent = titles[tab] || 'Panel';
  const container = document.getElementById('tab-content');
  container.innerHTML = '<p>Cargando datos...</p>';

  // ==========================================
  // VISTA: EMPRESAS (Solo Admin)
  // ==========================================
  if (tab === 'empresas') {
    const { data: empresas, error } = await db.from('empresas').select('*');
    if (error) return container.innerHTML = `<p>Error: ${error.message}</p>`;

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
      const { error } = await db.from('empresas').insert([{
        nombre: document.getElementById('empresa-nombre').value,
        ruc: document.getElementById('empresa-ruc').value,
        contacto: document.getElementById('empresa-contacto').value,
        actividad: document.getElementById('empresa-actividad').value
      }]);
      if (error) alert('Error: ' + error.message);
      else { alert('Empresa guardada'); renderTab('empresas'); }
    });
  } 
  
  // ==========================================
  // VISTA: TRABAJADORES (Admin y Contratista)
  // ==========================================
  else if (tab === 'trabajadores') {
    let empresas = [];
    if (sesion.rol === 'admin') {
      const { data } = await db.from('empresas').select('*');
      empresas = data;
    } else {
      const { data } = await db.from('empresas').select('*').eq('ruc', sesion.ruc);
      empresas = data;
    }
    
    if(!empresas || empresas.length === 0) return container.innerHTML = `<p>No se encontró tu empresa. Contacta al administrador.</p>`;

    const opcionesEmpresas = empresas.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    const empActiva = empresas[0];

    container.innerHTML = `
      <div class="card">
        <h2>Gestión de Trabajadores</h2>
        ${sesion.rol === 'admin' ? `<label>Seleccionar Empresa: <select id="select-empresa" style="margin-bottom:15px; padding:8px;">${opcionesEmpresas}</select></label>` : `<p>Empresa: <strong>${empActiva.nombre}</strong></p>`}
        
        <div style="margin-top:20px; padding:15px; background:#f9f9f9; border-radius:8px; border: 1px solid #ddd;">
          <h3>Registrar nuevo trabajador</h3>
          <form class="form" id="form-trabajador" style="margin-top:10px;">
            <label>Nombre completo<input type="text" id="trab-nombre" required></label>
            <label>DNI<input type="text" id="trab-dni" required></label>
            <label>Puesto<input type="text" id="trab-puesto" required></label>
            <button type="submit">Guardar Trabajador</button>
          </form>
        </div>
      </div>

      <div class="card" style="margin-top:20px;">
        <h2>Lista de Trabajadores</h2>
        <div id="lista-trabajadores"><p>Cargando...</p></div>
      </div>
    `;

    async function cargarTrabajadores(empresaId) {
      const { data: trabajadores, error } = await db.from('trabajadores').select('*').eq('empresa_id', empresaId);
      const div = document.getElementById('lista-trabajadores');
      
      if (error) return div.innerHTML = `<p>Error: ${error.message}</p>`;
      
      if (trabajadores.length === 0) {
        div.innerHTML = `<p>No hay trabajadores registrados aún.</p>`;
      } else {
        div.innerHTML = `
          <table>
            <thead><tr><th>Nombre</th><th>DNI</th><th>Puesto</th></tr></thead>
            <tbody>
              ${trabajadores.map(t => `<tr><td>${t.nombre}</td><td>${t.dni}</td><td>${t.puesto}</td></tr>`).join('')}
            </tbody>
          </table>
        `;
      }
    }

    cargarTrabajadores(empActiva.id);

    document.getElementById('form-trabajador').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      let empresaId = empActiva.id;
      if (sesion.rol === 'admin') {
        const select = document.getElementById('select-empresa');
        if (select) empresaId = select.value;
      }
      
      const { error } = await db.from('trabajadores').insert([{
        empresa_id: empresaId,
        nombre: document.getElementById('trab-nombre').value,
        dni: document.getElementById('trab-dni').value,
        puesto: document.getElementById('trab-puesto').value
      }]);

      if (error) {
        alert('Error al guardar: ' + error.message);
      } else {
        alert('¡Trabajador registrado con éxito!');
        document.getElementById('form-trabajador').reset();
        cargarTrabajadores(empresaId); 
      }
    });

    if (sesion.rol === 'admin') {
      document.getElementById('select-empresa').addEventListener('change', (e) => {
        cargarTrabajadores(e.target.value);
      });
    }
  }
  
  // ==========================================
  // VISTA: REQUISITOS (Solo Admin)
  // ==========================================
  else if (tab === 'requisitos') {
    const { data: reqs } = await db.from('matriz_requisitos').select('*');
    let thead = `<tr><th>Requisitos de SST</th>${ACTIVIDADES.filter(a => a !== 'Todas las actividades').map(a => `<th>${a}</th>`).join('')}</tr>`;
    let tbody = [...new Set(reqs.map(r => r.requisito))].map(reqName => {
      let row = `<tr><td>${reqName}</td>`;
      ACTIVIDADES.filter(a => a !== 'Todas las actividades').forEach(act => {
        const aplica = reqs.some(r => r.requisito === reqName && r.actividad === act);
        row += `<td style="text-align:center;">${aplica ? '<span class="pill success">X</span>' : '-'}</td>`;
      });
      return row + `</tr>`;
    }).join('');

    container.innerHTML = `<div class="card"><h2>Matriz de Requisitos</h2><div class="table-wrap"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div></div>`;
  }
  
  else if (tab === 'panel') {
     container.innerHTML = `<div class="card"><h2>Bienvenido al Panel de Control</h2><p>Selecciona una opción del menú izquierdo para gestionar la información.</p></div>`;
  } else {
    container.innerHTML = `<div class="card"><h2>Sección en construcción</h2><p>Esta vista estará disponible próximamente.</p></div>`;
  }
}
