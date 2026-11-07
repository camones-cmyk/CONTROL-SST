
const DB_NAME = 'control-sst-documentos'
const STORE_NAME = 'archivos'

function abrirDB() {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(DB_NAME, 1)

    solicitud.onupgradeneeded = () => {
      const db = solicitud.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    solicitud.onsuccess = () => resolve(solicitud.result)
    solicitud.onerror = () => reject(solicitud.error)
  })
}

export async function guardarArchivo(id, archivo) {
  const db = await abrirDB()

  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(STORE_NAME, 'readwrite')
    transaccion.objectStore(STORE_NAME).put(archivo, id)

    transaccion.oncomplete = () => {
      db.close()
      resolve()
    }

    transaccion.onerror = () => {
      db.close()
      reject(transaccion.error)
    }
  })
}

export async function obtenerArchivo(id) {
  const db = await abrirDB()

  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(STORE_NAME, 'readonly')
    const solicitud = transaccion.objectStore(STORE_NAME).get(id)

    solicitud.onsuccess = () => resolve(solicitud.result)
    solicitud.onerror = () => reject(solicitud.error)
    transaccion.oncomplete = () => db.close()
  })
}
