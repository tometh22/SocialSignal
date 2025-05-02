/**
 * Este script extiende el fondo azul del header de manera que cubra toda la parte superior
 * de la pantalla, específicamente diseñado para eliminar la franja gris que aparece en
 * entornos Replit.
 */

(function() {
  // Función para agregar un div azul en la parte superior de la ventana
  const addTopFix = () => {
    // Si ya existe el elemento, no lo recreamos
    if (document.getElementById('top-header-fix')) {
      return;
    }
    
    // 1. Crear elemento overlay para cubrir la parte superior
    const topFix = document.createElement('div');
    topFix.id = 'top-header-fix';
    
    // 2. Aplicar estilos para cubrir toda la parte superior
    Object.assign(topFix.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      height: '28px', // Altura que cubre la franja gris
      background: '#3B82F6', // Color del header
      zIndex: '999999', // Valor muy alto para asegurar que esté encima de todo
      boxShadow: '0 0 4px rgba(0,0,0,0.1)',
      pointerEvents: 'none' // No interferir con clicks
    });
    
    // 3. Agregar al body
    document.body.appendChild(topFix);
  };
  
  // 4. Ejecutar inmediatamente y también cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addTopFix);
  } else {
    addTopFix();
  }
  
  // 5. Adicional: Extender el background azul a toda la parte superior del html
  const extendBackgroundColor = () => {
    document.documentElement.style.background = '#3B82F6';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
  };
  
  // 6. Ejecutar la extensión de color inmediatamente
  extendBackgroundColor();
  
  // 7. Verificar después de que se carguen todos los recursos
  window.addEventListener('load', function() {
    addTopFix();
    extendBackgroundColor();
  });
})();