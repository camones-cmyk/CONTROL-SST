import { useEffect, useMemo, useState } from 'react'
import './App.css'

import { guardarArchivo, obtenerArchivo } from './documentosDB'

const KEY = 'sst-paramonga-prototipo-v1'
const today = () => new Date().toISOString().slice(0, 10)
const daysUntil = (date) => date ? Math.ceil((new Date(`${date}T12:00:00`) - new Date(`${today()}T12:00:00`)) / 86400000) : null
const seed = {
  companies: [
    { id: 'E1', name: 'Servicios Industriales del Norte SAC', ruc: '20123456789', contact: 'Contacto de prueba' },
    { id: 'E2', name: 'Mantenimiento Integral del Valle SAC', ruc: '20987654321', contact: 'Contacto de prueba' },
  ],
  workers: [
    { id: 'T1', name: 'María Torres (ficticio)', dni: '00000001', companyId: 'E1', role: 'Técnica de mantenimiento' },
    { id: 'T2', name: 'Luis Rojas (ficticio)', dni: '00000002', companyId: 'E2', role: 'Electricista' },
  ],
  docs: [
    { id: 'D1', workerId: 'T1', type: 'SCTR', expiry: '2027-01-30', status: 'Aprobado', note: '', fileName: 'SCTR_ejemplo.pdf' },
    { id: 'D2', workerId: 'T1', type: 'Inducción SST', expiry: '2027-03-15', status: 'Pendiente', note: '', fileName: 'induccion_ejemplo.pdf' },
    { id: 'D3', workerId: 'T2', type: 'Examen médico ocupacional', expiry: '2026-10-01', status: 'Aprobado', note: '', fileName: 'documento_ficticio.pdf' },
  ],
}
const newId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
const REQUIREMENTS_KEY = 'sst-paramonga-requisitos-v1'
const initialRequirements = [
  { id: 'R1', name: 'SCTR', mandatory: true, active: true },
  { id: 'R2', name: 'Inducción SST', mandatory: true, active: true },
  { id: 'R3', name: 'Examen médico ocupacional', mandatory: true, active: true },
  { id: 'R4', name: 'Capacitación SST', mandatory: false, active: true },
  { id: 'R5', name: 'Entrega de EPP', mandatory: false, active: true },
  { id: 'R6', name: 'Otro documento', mandatory: false, active: true },
]
function App({ sesion }) {
  const esAdmin = sesion?.rol === 'admin'
  const [nombrePlataforma, setNombrePlataforma] = useState(
  () => localStorage.getItem('nombre-plataforma-sst') || 'CONTROL SST'
)
  const [data, setData] = useState(() => { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : seed } catch { return seed } })
  const [requirements, setRequirements] = useState(() => {
    try {
      const raw = localStorage.getItem(REQUIREMENTS_KEY)
      const saved = raw ? JSON.parse(raw) : null
      return Array.isArray(saved) ? saved : initialRequirements
    } catch { return initialRequirements }
  })
  const [requirementForm, setRequirementForm] = useState({ name: '', mandatory: true, active: true })
  const [editingRequirement, setEditingRequirement] = useState(null)
  const [tab, setTab] = useState('panel')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [company, setCompany] = useState({ name: '', ruc: '', contact: '' })
  const [worker, setWorker] = useState({ name: '', dni: '', companyId: '', role: '' })
  const [doc, setDoc] = useState({ workerId: '', type: 'SCTR', expiry: '', fileName: '' })
  const [file, setFile] = useState(null)
  const [note, setNote] = useState({})
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(data)) }, [data])
  useEffect(() => { localStorage.setItem(REQUIREMENTS_KEY, JSON.stringify(requirements)) }, [requirements])
  const types = requirements.filter(r => r.active).map(r => r.name)
  const required = requirements.filter(r => r.active && r.mandatory).map(r => r.name)
  const addRequirement = e => {
    e.preventDefault()
    const name = requirementForm.name.trim()
    if (!name) return alert('Escribe el nombre del requisito.')
    if (requirements.some(r => r.name.toLowerCase() === name.toLowerCase() && r.id !== editingRequirement)) return alert('Ese requisito ya existe.')
    if (editingRequirement) {
      const previous = requirements.find(r => r.id === editingRequirement)
      if (previous?.name !== name && data.docs.some(d => d.type === previous?.name)) {
        if (!window.confirm('Hay documentos registrados con el nombre anterior. Se actualizará su tipo para mantener la relación. ¿Continuar?')) return
        setData(prev => ({ ...prev, docs: prev.docs.map(d => d.type === previous.name ? { ...d, type: name } : d) }))
      }
      setRequirements(prev => prev.map(r => r.id === editingRequirement ? { ...r, ...requirementForm, name } : r))
    } else setRequirements(prev => [...prev, { ...requirementForm, name, id: newId() }])
    setRequirementForm({ name: '', mandatory: true, active: true })
    setEditingRequirement(null)
    alert(editingRequirement ? 'Requisito actualizado.' : 'Requisito agregado.')
  }
  const editRequirement = r => { setEditingRequirement(r.id); setRequirementForm({ name: r.name, mandatory: r.mandatory, active: r.active }) }
  const deleteRequirement = r => {
    if (!window.confirm(`¿Eliminar «${r.name}» del catálogo? Los documentos ya registrados se conservarán como historial.`)) return
    setRequirements(prev => prev.filter(x => x.id !== r.id))
    if (editingRequirement === r.id) { setEditingRequirement(null); setRequirementForm({ name: '', mandatory: true, active: true }) }
    alert('Requisito eliminado del catálogo. Los documentos anteriores se conservan.')
  }
  const update = (field, value) => setData(prev => ({ ...prev, [field]: value }))
  const companyName = id => data.companies.find(x => x.id === id)?.name || 'Sin empresa'
  const workerName = id => data.workers.find(x => x.id === id)?.name || 'Sin trabajador'
  const effectiveStatus = d => d.expiry && daysUntil(d.expiry) < 0 ? 'Vencido' : d.status
  const access = w => {
    const records = data.docs.filter(d => d.workerId === w.id)
    return required.length > 0 && required.every(t => records.some(d => d.type === t && effectiveStatus(d) === 'Aprobado')) ? 'Autorizado' : 'No autorizado'
  }
  const stats = useMemo(() => ({ companies: data.companies.length, workers: data.workers.length, approved: data.workers.filter(w => access(w) === 'Autorizado').length, expired: data.docs.filter(d => effectiveStatus(d) === 'Vencido').length, pending: data.docs.filter(d => d.status === 'Pendiente' && effectiveStatus(d) !== 'Vencido').length }), [data])
  const filtered = items => items.filter(x => JSON.stringify(x).toLowerCase().includes(search.toLowerCase()))
  const alert = text => { setMessage(text); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const addCompany = e => { e.preventDefault(); if (data.companies.some(c => c.ruc === company.ruc)) return alert('Ese RUC ya está registrado.'); update('companies', [...data.companies, { ...company, id: newId() }]); setCompany({ name: '', ruc: '', contact: '' }); alert('Empresa registrada correctamente.') }
  const addWorker = e => { e.preventDefault(); if (data.workers.some(w => w.dni === worker.dni)) return alert('Ese DNI ya está registrado.'); update('workers', [...data.workers, { ...worker, id: newId() }]); setWorker({ name: '', dni: '', companyId: '', role: '' }); alert('Trabajador registrado correctamente.') }
  const addDoc = async (e) => {  e.preventDefault(); if (!types.includes(doc.type)) return alert('Selecciona un requisito activo.'); if (!file) return alert('Selecciona un archivo para registrar su nombre.'); if (file.size > 10 * 1024 * 1024) return alert('Selecciona un archivo menor de 10 MB.'); const archivoId = newId();await guardarArchivo(archivoId, file);update('docs', [...data.docs, { ...doc, fileName: file.name, id: archivoId, status: 'Pendiente', note: '' }]); setDoc({ workerId: '', type: types[0] || '', expiry: '', fileName: '' }); setFile(null); e.target.reset(); alert('Documento registrado para revisión. El archivo se guardó localmente para su revisión.') }
  
const abrirDocumento = async (id) => {
  try {
    const archivo = await obtenerArchivo(id)

    if (!archivo) {
      window.alert('No se encontró el archivo. Puede ser un registro de demostración anterior.')
      return
    }

    const url = URL.createObjectURL(archivo)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (error) {
    console.error(error)
    window.alert('No se pudo abrir el documento.')
  }
}

  const review = (id, status) => { update('docs', data.docs.map(d => d.id === id ? { ...d, status, note: note[id] ?? d.note } : d)); alert(`Documento marcado como ${status.toLowerCase()}.`) }
  const go = name => { setTab(name); setSearch(''); setMessage('') }
  return <div className="sst-app">
    <header className="topbar"><div className="brand">
<img
  src="/logo-paramonga.jpg"
  alt="Logo de Agro Industrial Paramonga"
  className="brand-logo"
/>
<div><strong>{nombrePlataforma}</strong><small>Gestión documental de contratistas</small></div></div><span className="prototype">PROTOTIPO · DATOS FICTICIOS</span></header>
    <div className="layout"><nav className="sidebar" aria-label="Secciones">
      {[['panel', '📊', 'Panel general'], ['empresas', '🏭', 'Empresas'], ['trabajadores', '👷', 'Trabajadores'], ['documentos', '📋', 'Documentos SST'], ['autorizaciones', '🛡️', 'Autorizaciones'],
, ['configuracion', '⚙️', 'Configuración']
].filter(([id]) => esAdmin || id !== 'configuracion').map(([id, icon, label]) => <button key={id} className={tab === id ? 'nav active' : 'nav'} onClick={() => go(id)}><span>{icon}</span>{label}</button>)}
      <div className="side-note">Agro Industrial Paramonga S.A.<br />Proyecto A.C · SENATI</div>
    </nav><main className="content">
      {message && <div className="notice" role="status">{message}<button onClick={() => setMessage('')}>×</button></div>}
      <div className="heading"><div><span className="eyebrow">SEGURIDAD Y SALUD EN EL TRABAJO</span><h1>{{panel: 'Panel general', empresas: 'Empresas contratistas', trabajadores: 'Trabajadores contratistas', documentos: 'Control documental SST', autorizaciones: 'Autorización de ingreso', requisitos: 'Gestión de requisitos SST'}[tab]}</h1><p>Plataforma demostrativa de verificación y control de requisitos SST.</p></div><span className="date">Actualizado: {today()}</span></div>
      {tab === 'panel' && <><div className="stats">{[['Empresas', stats.companies, '▤'], ['Trabajadores', stats.workers, '♙'], ['Autorizados', stats.approved, '✓'], ['Vencidos', stats.expired, '!'], ['Pendientes', stats.pending, '◷']].map(([name, value, icon]) => <div className="stat" key={name}><span>{icon}</span><strong>{value}</strong><small>{name}</small></div>)}</div><div className="card"><h2>Accesos rápidos</h2><p>Registra contratistas, verifica documentos y consulta quiénes cumplen los requisitos.</p><div className="actions"><button onClick={() => go('empresas')}>+ Registrar empresa</button><button onClick={() => go('trabajadores')}>+ Registrar trabajador</button><button onClick={() => go('documentos')}>+ Registrar documento</button><button className="outline" onClick={() => go('autorizaciones')}>Ver autorizaciones</button></div></div><div className="card"><h2>Alertas de documentos</h2><div className="table-wrap"><table><thead><tr><th>Trabajador</th><th>Documento</th><th>Vencimiento</th><th>Estado</th></tr></thead><tbody>{data.docs.filter(d => effectiveStatus(d) === 'Vencido' || (daysUntil(d.expiry) !== null && daysUntil(d.expiry) <= 30)).map(d => <tr key={d.id}><td>{workerName(d.workerId)}</td><td>{d.type}</td><td>{d.expiry || '—'}</td><td><span className={'pill ' + (effectiveStatus(d) === 'Vencido' ? 'danger' : 'warning')}>{effectiveStatus(d) === 'Vencido' ? 'Vencido' : 'Próximo a vencer'}</span></td></tr>)}{!data.docs.some(d => effectiveStatus(d) === 'Vencido' || (daysUntil(d.expiry) !== null && daysUntil(d.expiry) <= 30)) && <tr><td colSpan="4">Sin alertas por vencimiento.</td></tr>}</tbody></table></div></div></>}
      {tab === 'empresas' && <><div className="card"><h2>Registrar empresa</h2><form className="form" onSubmit={addCompany}><label>Razón social<input required value={company.name} onChange={e => setCompany({ ...company, name: e.target.value })} placeholder="Nombre de la empresa" /></label><label>RUC (11 dígitos)<input required pattern="[0-9]{11}" maxLength="11" value={company.ruc} onChange={e => setCompany({ ...company, ruc: e.target.value })} placeholder="20123456789" /></label><label>Contacto<input required value={company.contact} onChange={e => setCompany({ ...company, contact: e.target.value })} placeholder="Nombre de contacto" /></label><button type="submit">Guardar empresa</button></form></div><div className="card"><h2>Empresas registradas</h2><div className="table-wrap"><table><thead><tr><th>Razón social</th><th>RUC</th><th>Contacto</th></tr></thead><tbody>{data.companies.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.ruc}</td><td>{c.contact}</td></tr>)}</tbody></table></div></div></>}
      {tab === 'trabajadores' && <><div className="card"><h2>Registrar trabajador</h2><form className="form" onSubmit={addWorker}><label>Nombre completo<input required value={worker.name} onChange={e => setWorker({ ...worker, name: e.target.value })} /></label><label>DNI (8 dígitos)<input required pattern="[0-9]{8}" maxLength="8" value={worker.dni} onChange={e => setWorker({ ...worker, dni: e.target.value })} /></label><label>Empresa<select required value={worker.companyId} onChange={e => setWorker({ ...worker, companyId: e.target.value })}><option value="">Selecciona una empresa</option>{data.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Cargo<input required value={worker.role} onChange={e => setWorker({ ...worker, role: e.target.value })} /></label><button type="submit">Guardar trabajador</button></form></div><div className="card"><h2>Trabajadores registrados</h2><div className="table-wrap"><table><thead><tr><th>Nombre</th><th>DNI</th><th>Empresa</th><th>Cargo</th></tr></thead><tbody>{data.workers.map(w => <tr key={w.id}><td>{w.name}</td><td>{w.dni}</td><td>{companyName(w.companyId)}</td><td>{w.role}</td></tr>)}</tbody></table></div></div></>}
      {tab === 'documentos' && <><div className="card"><h2>Registrar documento SST</h2><p>Se registra el nombre del archivo para la demostración. No se almacena su contenido.</p><form className="form" onSubmit={addDoc}><label>Trabajador<select required value={doc.workerId} onChange={e => setDoc({ ...doc, workerId: e.target.value })}><option value="">Selecciona un trabajador</option>{data.workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>Tipo de documento<select required value={types.includes(doc.type) ? doc.type : (types[0] || '')} onChange={e => setDoc({ ...doc, type: e.target.value })}>{types.map(t => <option key={t}>{t}</option>)}</select></label><label>Fecha de vencimiento<input required type="date" value={doc.expiry} onChange={e => setDoc({ ...doc, expiry: e.target.value })} /></label><label>Archivo de prueba<input required type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] || null)} /></label><button type="submit">Registrar documento</button></form></div><div className="card"><div className="card-head"><h2>Revisión documental</h2><input className="search" placeholder="Buscar documento o trabajador..." value={search} onChange={e => setSearch(e.target.value)} /></div><div className="table-wrap"><table><thead><tr><th>Trabajador</th><th>Tipo / archivo</th><th>Vence</th><th>Estado</th><th>Revisión</th></tr></thead><tbody>{data.docs.filter(d => `${workerName(d.workerId)} ${d.type} ${d.fileName}`.toLowerCase().includes(search.toLowerCase())).map(d => <tr key={d.id}><td>{workerName(d.workerId)}</td><td><strong>{d.type}</strong><br /><small>{d.fileName}</small></td><td>{d.expiry}</td><td><span className={'pill ' + (effectiveStatus(d) === 'Aprobado' ? 'success' : effectiveStatus(d) === 'Vencido' || effectiveStatus(d) === 'Observado' ? 'danger' : 'warning')}>{effectiveStatus(d)}</span></td><td><input className="note" aria-label="Observación" placeholder="Observación opcional" value={note[d.id] ?? d.note} onChange={e => setNote({ ...note, [d.id]: e.target.value })} /><div className="review-actions"><button onClick={() => review(d.id, 'Aprobado')}>Aprobar</button><button className="outline" onClick={() => review(d.id, 'Observado')}>Observar</button></div></td></tr>)}{data.docs.length === 0 && <tr><td colSpan="5">Aún no hay documentos.</td></tr>}</tbody></table></div></div></>}
      {tab === 'autorizaciones' && <div className="card"><h2>Verificación de ingreso</h2><p>Para mostrar «Autorizado», cada trabajador debe tener todos los requisitos obligatorios activos aprobados y vigentes. {required.length === 0 && 'No hay requisitos obligatorios activos; no se autorizará a nadie hasta configurar al menos uno.'}</p><div className="table-wrap"><table><thead><tr><th>Trabajador</th><th>Empresa</th><th>Requisitos</th><th>Estado de ingreso</th></tr></thead><tbody>{data.workers.map(w => <tr key={w.id}><td>{w.name}</td><td>{companyName(w.companyId)}</td><td>{required.map(t => <div className="requirement" key={t}>{data.docs.some(d => d.workerId === w.id && d.type === t && effectiveStatus(d) === 'Aprobado') ? '✓' : '○'} {t}</div>)}</td><td><span className={'pill ' + (access(w) === 'Autorizado' ? 'success' : 'danger')}>{access(w)}</span></td></tr>)}</tbody></table></div></div>}
      {tab === 'requisitos' && <>
        <div className="card"><h2>{editingRequirement ? 'Editar requisito SST' : 'Agregar requisito SST'}</h2>
          <p>Catálogo editable para todos los trabajadores de este prototipo. Los cambios afectan la verificación simulada de autorizaciones.</p>
          <form className="form" onSubmit={addRequirement}>
            <label>Nombre del requisito<input required maxLength="100" value={requirementForm.name} onChange={e => setRequirementForm({ ...requirementForm, name: e.target.value })} placeholder="Ejemplo: Capacitación SST" /></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={requirementForm.mandatory} onChange={e => setRequirementForm({ ...requirementForm, mandatory: e.target.checked })} /> Obligatorio para autorización</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={requirementForm.active} onChange={e => setRequirementForm({ ...requirementForm, active: e.target.checked })} /> Requisito activo</label>
            <button type="submit">{editingRequirement ? 'Guardar cambios' : '+ Agregar requisito'}</button>
            {editingRequirement && <button type="button" className="outline" onClick={() => { setEditingRequirement(null); setRequirementForm({ name: '', mandatory: true, active: true }) }}>Cancelar edición</button>}
          </form>
        </div>
        <div className="card"><h2>Requisitos configurados</h2><div className="table-wrap"><table><thead><tr><th>Requisito</th><th>Obligatorio</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
          {requirements.map(r => <tr key={r.id}><td>{r.name}</td><td>{r.mandatory ? 'Sí' : 'No'}</td><td><span className={'pill ' + (r.active ? 'success' : 'warning')}>{r.active ? 'Activo' : 'Inactivo'}</span></td><td><div className="review-actions"><button type="button" onClick={() => editRequirement(r)}>Editar</button><button type="button" className="outline" onClick={() => deleteRequirement(r)}>Eliminar</button></div></td></tr>)}
          {requirements.length === 0 && <tr><td colSpan="4">Aún no hay requisitos configurados.</td></tr>}
        </tbody></table></div></div>
        <div className="card"><h2>Importante: acceso administrativo</h2><p>Esta pantalla es solo una demostración local y todavía NO está protegida por usuario y contraseña. No compartas este prototipo como si tuviera permisos reales. La privacidad de administradora y las cuentas de contratistas requerirán autenticación y una base de datos con controles de acceso.</p></div>
      </>}
{tab === 'configuracion' && (
  <div className="card configuracion-card">
    <h2>⚙️ Configuración de mi página</h2>
    {esAdmin && (
    <button
  type="button"
  className="outline"
  onClick={() => go('requisitos')}
>
  ⚙️ Gestionar requisitos SST
</button>
)}
    <p>Personaliza los datos de tu plataforma SST.</p>

    <label>Nombre de la plataforma</label>
    <input
      placeholder="Ejemplo: CONTROL SST"
      value={nombrePlataforma}
onChange={(e) => setNombrePlataforma(e.target.value)}
    />

    <label>Nombre de la empresa</label>
    <input
      placeholder="Nombre de la empresa"
      defaultValue="Agro Industrial Paramonga S.A."
    />

    <button
  type="button"
  onClick={() => {
    localStorage.setItem('nombre-plataforma-sst', nombrePlataforma)
    alert('Nombre de la plataforma guardado correctamente')
  }}
>
  Guardar cambios
</button>
  </div>
)}

      <footer>Prototipo académico. No usar para autorizar ingresos reales ni cargar documentos médicos o personales auténticos. Los datos se guardan solo en este navegador. <button className="reset" onClick={() => { if (window.confirm('¿Restablecer todos los datos ficticios de este prototipo?')) { setData(seed); alert('Datos ficticios restaurados.') } }}>Restaurar datos de prueba</button></footer>
    </main></div>
  </div>
}
export default App
