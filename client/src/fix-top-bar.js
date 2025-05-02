// Script para ocultar la franja gris con una barra azul superpuesta
// IIFE (Immediately Invoked Function Expression) para encapsular la lógica
(function() {
  // Función para agregar la barra de cobertura
  function addCoverBar() {
    // Crear un elemento div que cubrirá la franja gris
    const coverBar = document.createElement('div');
    
    // Estilos para que cubra la franja gris exactamente
    Object.assign(coverBar.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      height: '30px', // Un poco más alto por seguridad
      backgroundColor: '#3B82F6', // Color azul que coincide con el header
      backgroundImage: 'linear-gradient(90deg, #3B82F6, #2563EB)', // Degradado para que coincida
      zIndex: '999999', // Valor muy alto para asegurar que esté por encima de todo
      borderBottom: 'none',
      transition: 'opacity 0.2s ease',
      opacity: '1'
    });
    
    // Añadir un ID para poder referenciarlo
    coverBar.id = 'top-bar-fix';
    
    // Agregar al body
    if (document.body) {
      document.body.insertBefore(coverBar, document.body.firstChild);
    } else {
      // Si el body aún no existe, esperar un poco y reintentar
      setTimeout(addCoverBar, 10);
    }
  }
  
  // Intentar agregar la barra inmediatamente
  addCoverBar();
  
  // También ejecutar cuando el DOM esté listo para asegurar que funcione
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addCoverBar);
  }
  
  // Y una vez más cuando todos los recursos estén cargados
  window.addEventListener('load', function() {
    // Verificar si la barra ya existe
    if (!document.getElementById('top-bar-fix')) {
      addCoverBar();
    }
    
    // También ajustar el body para empujar todo hacia abajo
    if (document.body) {
      document.body.style.marginTop = '30px';
    }
  });
})();