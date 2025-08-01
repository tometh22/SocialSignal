// Script de prueba para obtener pestañas del Excel MAESTRO
import fetch from 'node-fetch';

async function testPestanas() {
  try {
    console.log('🔄 Probando endpoint de pestañas...');
    
    const response = await fetch('http://localhost:5000/api/google-sheets/pestanas', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Headers:`, response.headers.raw());
    
    const text = await response.text();
    console.log(`📝 Response (first 500 chars):`);
    console.log(text.substring(0, 500));
    
    try {
      const data = JSON.parse(text);
      console.log('\n✅ JSON Response:');
      console.log(JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.log('\n❌ Response is not JSON');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar test
testPestanas();