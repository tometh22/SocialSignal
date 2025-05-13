// Script simple para iniciar sesión de Victoria Puricelli
// Este archivo es temporal y debe eliminarse después de solucionar el problema

document.addEventListener('DOMContentLoaded', () => {
  // Solo activar en la página de login
  if (window.location.pathname.includes('auth')) {
    const loginButton = document.createElement('button');
    loginButton.textContent = "Acceso Directo Victoria";
    loginButton.style.position = "fixed";
    loginButton.style.bottom = "20px";
    loginButton.style.right = "20px";
    loginButton.style.zIndex = "9999";
    loginButton.style.padding = "10px";
    loginButton.style.background = "#f97316";
    loginButton.style.color = "white";
    loginButton.style.border = "none";
    loginButton.style.borderRadius = "4px";
    loginButton.style.cursor = "pointer";

    loginButton.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'victoria.puricelli@epical.digital',
            password: 'epical2025'
          }),
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Login exitoso', data);
          // Redirigir a la página principal
          window.location.href = '/';
        } else {
          const error = await response.text();
          console.error('Error al iniciar sesión:', error);
          alert('Error al iniciar sesión: ' + error);
        }
      } catch (error) {
        console.error('Error en la solicitud:', error);
        alert('Error en la solicitud: ' + error.message);
      }
    });

    document.body.appendChild(loginButton);
  }
});