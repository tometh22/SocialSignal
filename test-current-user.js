import fetch from 'node-fetch';

// Función para probar la obtención del usuario actual (sin autenticación)
async function testCurrentUser() {
  console.log('\n--- Probando obtención de usuario actual (sin estar autenticado) ---');
  
  try {
    const response = await fetch('http://localhost:5000/api/current-user', {
      credentials: 'include'
    });
    
    console.log(`Código de estado HTTP: ${response.status}`);
    
    const responseText = await response.text();
    console.log(`Respuesta como texto: ${responseText}`);
    
    try {
      const responseJson = JSON.parse(responseText);
      console.log('Respuesta como JSON:', responseJson);
    } catch (e) {
      console.log('Error al analizar la respuesta como JSON:', e.message);
    }
  } catch (error) {
    console.error('Error en la petición:', error.message);
  }
}

// Función para iniciar sesión y luego probar la obtención del usuario actual
async function loginAndTestCurrentUser() {
  console.log('\n--- Probando inicio de sesión y luego obtención de usuario actual ---');
  
  try {
    // Iniciar sesión primero
    const loginResponse = await fetch('http://localhost:5000/api/login', {
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
    
    if (!loginResponse.ok) {
      console.log('Error al iniciar sesión, no se puede continuar la prueba');
      return;
    }
    
    // Si el login es exitoso, probar el endpoint de usuario actual
    const response = await fetch('http://localhost:5000/api/current-user', {
      credentials: 'include'
    });
    
    console.log(`Código de estado HTTP: ${response.status}`);
    
    const responseText = await response.text();
    console.log(`Respuesta como texto: ${responseText}`);
    
    try {
      const responseJson = JSON.parse(responseText);
      console.log('Respuesta como JSON:', responseJson);
    } catch (e) {
      console.log('Error al analizar la respuesta como JSON:', e.message);
    }
  } catch (error) {
    console.error('Error en la petición:', error.message);
  }
}

// Ejecutar pruebas
async function runTests() {
  await testCurrentUser();
  
  // Nota: Esta prueba no funcionará como esperamos porque las cookies de sesión
  // no se propagan automáticamente en node-fetch como lo harían en un navegador
  // Solo mostramos cómo se debería hacer la secuencia
  await loginAndTestCurrentUser();
}

runTests().catch(err => {
  console.error('Error al ejecutar las pruebas:', err);
});