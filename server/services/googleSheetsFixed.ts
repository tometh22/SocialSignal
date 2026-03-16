import fs from 'fs';
import path from 'path';

interface CostoDirectoIndirecto {
  persona: string;
  mes: string;
  año: number;
  costoDirecto: number;
  costoIndirecto: number;
  costoTotal: number;
  valorHora: number;
  categoria: string;
  proyecto?: string;
}

class GoogleSheetsFixedService {
  private sheets: any | null;

  constructor() {
    try {
      // Verify basic credentials availability
      const hasKey = !!process.env.GOOGLE_PRIVATE_KEY;
      const hasEmail = !!process.env.GOOGLE_CLIENT_EMAIL;
      if (!hasKey || !hasEmail) {
        console.warn('⚠️ Google Sheets credentials missing (GOOGLE_PRIVATE_KEY or GOOGLE_CLIENT_EMAIL). Sheets functionality will be unavailable.');
        this.sheets = null;
      } else {
        this.sheets = true; // Credentials present; actual client created on demand
      }
    } catch (error) {
      console.warn('⚠️ Google Sheets initialization failed. Sheets functionality will be unavailable:', (error as Error).message);
      this.sheets = null;
    }
  }

  /**
   * Verificar las credenciales necesarias
   */
  verifyCredentials(): { success: boolean; message: string; details: any } {
    const required = ['GOOGLE_PROJECT_ID', 'GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY_ID', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_CLIENT_ID'];
    const missing = required.filter(key => !process.env[key]);
    
    const details = {
      hasProjectId: !!process.env.GOOGLE_PROJECT_ID,
      hasClientEmail: !!process.env.GOOGLE_CLIENT_EMAIL,
      hasPrivateKeyId: !!process.env.GOOGLE_PRIVATE_KEY_ID,
      hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      privateKeyLength: process.env.GOOGLE_PRIVATE_KEY?.length || 0,
      projectId: process.env.GOOGLE_PROJECT_ID,
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      privateKeyFormat: this.checkPrivateKeyFormat()
    };

    if (missing.length > 0) {
      return {
        success: false,
        message: `Missing environment variables: ${missing.join(', ')}`,
        details
      };
    }

    return {
      success: true,
      message: 'All required credentials are present',
      details
    };
  }

  /**
   * Verificar el formato de la clave privada
   */
  private checkPrivateKeyFormat(): any {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!privateKey) {
      return { valid: false, reason: 'Missing private key' };
    }

    return {
      valid: privateKey.includes('-----BEGIN PRIVATE KEY-----') && privateKey.includes('-----END PRIVATE KEY-----'),
      hasBeginHeader: privateKey.includes('-----BEGIN PRIVATE KEY-----'),
      hasEndHeader: privateKey.includes('-----END PRIVATE KEY-----'),
      length: privateKey.length,
      startsWithBegin: privateKey.trim().startsWith('-----BEGIN'),
      endsWithEnd: privateKey.trim().endsWith('-----END PRIVATE KEY-----')
    };
  }

  /**
   * Usar el archivo JSON de credentials directamente
   */
  async testWithJSONFile(): Promise<{ success: boolean; message: string; error?: string }> {
    if (!this.sheets) {
      return { success: false, message: 'Google Sheets credentials not available', error: 'Missing credentials' };
    }
    try {
      // Buscar el archivo JSON de credentials
      const jsonFiles = [
        'attached_assets/focal-utility-318020-e2defb839c83_1754064776295.json',
        'focal-utility-318020-e2defb839c83.json'
      ];

      let credentialsPath = '';
      for (const filePath of jsonFiles) {
        if (fs.existsSync(filePath)) {
          credentialsPath = filePath;
          break;
        }
      }

      if (!credentialsPath) {
        return {
          success: false,
          message: 'No se encontró el archivo de credenciales JSON',
          error: 'JSON credentials file not found'
        };
      }

      console.log(`📁 Using credentials file: ${credentialsPath}`);
      
      // Leer y parsear el archivo JSON
      const credentialsJson = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      
      // Verificar que tenga los campos necesarios
      const requiredFields = ['project_id', 'client_email', 'private_key', 'private_key_id'];
      const missingFields = requiredFields.filter(field => !credentialsJson[field]);
      
      if (missingFields.length > 0) {
        return {
          success: false,
          message: `Missing fields in JSON: ${missingFields.join(', ')}`,
          error: 'Invalid JSON structure'
        };
      }

      return {
        success: true,
        message: 'JSON credentials file is valid and accessible',
        error: undefined
      };

    } catch (error) {
      return {
        success: false,
        message: 'Error reading JSON credentials file',
        error: (error as Error).message
      };
    }
  }

  /**
   * Obtener datos simulados para testing mientras resolvemos la conexión
   */
  getMockCostosData(): CostoDirectoIndirecto[] {
    console.log('⚠️ Usando datos simulados del Excel MAESTRO mientras se resuelve la conexión con Google Sheets');
    
    return [
      {
        persona: 'Juan Pérez',
        mes: 'Enero',
        año: 2025,
        costoDirecto: 3500000,
        costoIndirecto: 1500000,
        costoTotal: 5000000,
        valorHora: 25000,
        categoria: 'Desarrollador Senior',
        proyecto: 'Proyecto Alpha'
      },
      {
        persona: 'María García',
        mes: 'Enero',
        año: 2025,
        costoDirecto: 4000000,
        costoIndirecto: 1800000,
        costoTotal: 5800000,
        valorHora: 30000,
        categoria: 'Project Manager',
        proyecto: 'Proyecto Beta'
      },
      {
        persona: 'Carlos López',
        mes: 'Enero',
        año: 2025,
        costoDirecto: 3000000,
        costoIndirecto: 1200000,
        costoTotal: 4200000,
        valorHora: 22000,
        categoria: 'Desarrollador Junior',
        proyecto: 'Proyecto Gamma'
      }
    ];
  }

  /**
   * Simular el mapeo de datos reales una vez que la conexión funcione
   */
  async getCostosDirectosIndirectos(): Promise<CostoDirectoIndirecto[]> {
    console.log('🔄 Intentando obtener datos del Excel MAESTRO...');

    if (!this.sheets) {
      console.warn('⚠️ Google Sheets client not available, returning mock data');
    }

    // Por ahora usar datos simulados hasta resolver la conexión
    return this.getMockCostosData();
  }
}

export const googleSheetsFixedService = new GoogleSheetsFixedService();
export type { CostoDirectoIndirecto };