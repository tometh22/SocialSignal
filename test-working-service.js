import { googleSheetsWorkingService } from './server/services/googleSheetsWorking.js';

async function testWorkingService() {
  console.log('🧪 Testing Google Sheets Working Service...');
  
  try {
    // Test connection
    console.log('\n1. Testing connection...');
    const connected = await googleSheetsWorkingService.testConnection();
    console.log('Connection result:', connected);
    
    if (connected) {
      // Get spreadsheet info
      console.log('\n2. Getting spreadsheet info...');
      const info = await googleSheetsWorkingService.getSpreadsheetInfo();
      console.log('Spreadsheet info:', JSON.stringify(info, null, 2));
      
      // Get costs data
      console.log('\n3. Getting costs data...');
      const costos = await googleSheetsWorkingService.getCostosDirectosIndirectos();
      console.log('Costs data:', JSON.stringify(costos, null, 2));
    }
    
    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWorkingService();