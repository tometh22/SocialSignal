// Este script se ejecuta directamente en el head para eliminar cualquier espacio gris
(function() {
  // Crear un estilo para aplicar inmediatamente
  var style = document.createElement('style');
  style.textContent = `
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #3B82F6 !important; /* Usa el color del header para evitar diferencias */
      height: 100% !important;
      width: 100% !important;
      overflow: hidden !important;
    }
    
    body {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
    }
    
    /* Otros resets agresivos */
    *, *::before, *::after {
      margin-top: 0 !important;
      padding-top: 0 !important;
    }
  `;
  
  // Añadir inmediatamente al head
  document.head.appendChild(style);
  
  // Fix para asegurarnos que se aplica incluso después de cargar la página
  window.addEventListener('DOMContentLoaded', function() {
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.background = '#3B82F6';
    document.documentElement.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.background = '#3B82F6';
    document.body.style.height = '100%';
    document.body.style.overflow = 'auto';
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.bottom = '0';
  });
})();