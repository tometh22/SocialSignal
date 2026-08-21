// Después de cada deploy, Vite genera archivos con hash nuevo y borra los
// anteriores. Si el usuario tenía una pestaña abierta desde antes del deploy,
// el bundle principal en memoria todavía apunta a los chunks viejos: al
// navegar a una pantalla cargada con React.lazy(), el import() dinámico pide
// una URL que ya no existe en el servidor y el error boundary la atrapa.
// Reintentar sin recargar la página vuelve a pedir la misma URL rota, así
// que la única solución real es una recarga completa (trae el index.html y
// los hashes de chunk vigentes). Esto detecta ese error puntual y hace como
// máximo una recarga automática por pestaña para no entrar en loop si el
// problema fuera otro.

const CHUNK_ERROR_PATTERN = /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk [\w-]+ failed|dynamically imported module/i;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return CHUNK_ERROR_PATTERN.test(message);
}

/**
 * Si el error es de carga de chunk, recarga la página una sola vez por
 * sesión de pestaña. Devuelve true si va a recargar (el llamador puede
 * evitar renderizar la UI de error, ya que la navegación está en curso).
 */
export function reloadOnceForChunkError(error: unknown, storageKey = 'chunk-reload-attempted'): boolean {
  if (!isChunkLoadError(error)) return false;
  try {
    if (sessionStorage.getItem(storageKey)) return false;
    sessionStorage.setItem(storageKey, '1');
  } catch {
    // sessionStorage no disponible (modo privado, etc.): igual intentamos recargar una vez.
  }
  window.location.reload();
  return true;
}
