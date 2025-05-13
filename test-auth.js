import fetch from 'node-fetch';

// Función para probar el inicio de sesión
async function testLogin(email, password) {
  console.log(`\n--- Probando login con email: ${email} ---`);
  
  try {
    // Realizar petición de login
    const response = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    // Mostrar código de estado HTTP
    console.log(`Código de estado HTTP: ${response.status}`);
    
    // Obtener la respuesta como texto
    const responseText = await response.text();
    console.log(`Respuesta como texto: ${responseText}`);
    
    // Intentar analizar la respuesta como JSON
    try {
      const responseJson = JSON.parse(responseText);
      console.log('Respuesta como JSON:', responseJson);
      return { success: response.ok, data: responseJson };
    } catch (e) {
      console.log('Error al analizar la respuesta como JSON:', e.message);
      return { success: false, error: 'Error al analizar la respuesta como JSON' };
    }
  } catch (error) {
    console.error('Error en la petición:', error.message);
    return { success: false, error: error.message };
  }
}

// Función principal para ejecutar pruebas
async function runTests() {
  // Probar con las credenciales de Victoria
  await testLogin('victoria.puricelli@epical.digital', 'epical2025');
  
  // Probar con credenciales incorrectas
  await testLogin('victoria.puricelli@epical.digital', 'contraseña-incorrecta');
  
  // Probar con usuario que no existe
  await testLogin('usuario.noexiste@epical.digital', 'cualquier-cosa');
}

// Ejecutar las pruebas
runTests().catch(err => {
  console.error('Error al ejecutar las pruebas:', err);
});