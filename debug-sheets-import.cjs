const { google } = require('googleapis');
const credentials = require('./service-account.json');

async function debugSheetData() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc';
  const range = 'Rendimiento Cliente!A:M';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values;
  const headers = rows[0];

  console.log('📋 Headers:', headers.join(' | '));
  console.log('');

  // Filtrar Warner 2025
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] || '';
    });

    const cliente = (obj.Cliente || '').toLowerCase();
    const año = parseInt(obj.Año || 0);
    const mes = parseInt(obj.Mes || 0);

    if (cliente.includes('warner') && año === 2025 && mes === 9) {
      console.log(`\n🎯 SEPTIEMBRE - Fila ${i}`);
      console.log(`   Cliente: ${obj.Cliente}`);
      console.log(`   Proyecto: ${obj.Proyecto}`);
      console.log(`   Mes: ${obj.Mes} (type: ${typeof obj.Mes})`);
      console.log(`   Año: ${obj.Año} (type: ${typeof obj.Año})`);
      console.log(`   Cotización RAW: "${obj.Cotización}" (type: ${typeof obj.Cotización})`);
      console.log(`   Facturación [USD] RAW: "${obj['Facturación [USD]']}" (type: ${typeof obj['Facturación [USD]']})`);
      console.log(`   Costos [USD] RAW: "${obj['Costos [USD]']}" (type: ${typeof obj['Costos [USD]']})`);
      console.log('');
    }
  }
}

debugSheetData().catch(console.error);
