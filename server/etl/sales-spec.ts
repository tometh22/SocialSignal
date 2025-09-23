/**
 * 📋 ESPECIFICACIÓN EXACTA DE INGESTIÓN - HOJA "VENTAS TOMI"
 * Esta especificación debe ser usada para cualquier implementación o auditoría del ETL
 */

/**
 * HOJA: "Ventas Tomi" 
 * TIPO: Ventas (ingresos)
 * 
 * Columnas requeridas (cabecera exacta o sinónimos)
 */
export const VENTAS_TOMI_SPEC = {
  /**
   * Campo interno: cliente
   * Cabecera esperada: "Cliente"
   * Sinónimos aceptados: ["Client"]
   */
  cliente: {
    cabecera: 'Cliente',
    sinonimos: ['Client'],
    required: true,
    tipo: 'string'
  },

  /**
   * Campo interno: proyecto
   * Cabecera esperada: "Proyecto" 
   * Sinónimos aceptados: ["Project"]
   */
  proyecto: {
    cabecera: 'Proyecto',
    sinonimos: ['Project'],
    required: true,
    tipo: 'string'
  },

  /**
   * Campo interno: mes
   * Cabecera esperada: "Mes"
   * Sinónimos aceptados: ["Month"]
   */
  mes: {
    cabecera: 'Mes',
    sinonimos: ['Month'],
    required: true,
    tipo: 'string_or_number'
  },

  /**
   * Campo interno: anio
   * Cabecera esperada: "Año"
   * Sinónimos aceptados: ["Year", "Año (numérico)"]
   */
  anio: {
    cabecera: 'Año',
    sinonimos: ['Year', 'Año (numérico)'],
    required: true,
    tipo: 'number'
  },

  /**
   * Campo interno: tipoVenta
   * Cabecera esperada: "Tipo_Venta"
   * Sinónimos aceptados: ["Tipo Venta", "Tipo"]
   */
  tipoVenta: {
    cabecera: 'Tipo_Venta',
    sinonimos: ['Tipo Venta', 'Tipo'],
    required: true,
    tipo: 'string'
  },

  /**
   * Campo interno: montoARS
   * Cabecera esperada: "Monto_ARS"
   * Sinónimos aceptados: ["ARS", "Monto ARS"]
   */
  montoARS: {
    cabecera: 'Monto_ARS',
    sinonimos: ['ARS', 'Monto ARS'],
    required: false,
    tipo: 'currency'
  },

  /**
   * Campo interno: montoUSD
   * Cabecera esperada: "Monto_USD"
   * Sinónimos aceptados: ["USD", "Monto USD"]
   */
  montoUSD: {
    cabecera: 'Monto_USD',
    sinonimos: ['USD', 'Monto USD'],
    required: true,
    tipo: 'currency'
  },

  /**
   * Campo interno: confirmado
   * Cabecera esperada: "Confirmado"
   * Sinónimos aceptados: ["Status", "Aprobado"]
   */
  confirmado: {
    cabecera: 'Confirmado',
    sinonimos: ['Status', 'Aprobado'],
    required: false,
    tipo: 'string'
  }
} as const;

/**
 * 🔍 Mapear cabeceras del Excel a campos internos
 * Usa la especificación exacta para encontrar cada campo
 */
export function mapearCabecerasVentasTomi(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  // Normalizar headers para comparación
  const normalizedHeaders = headers.map(h => h?.trim().toLowerCase() || '');
  
  for (const [campoInterno, spec] of Object.entries(VENTAS_TOMI_SPEC)) {
    // Buscar cabecera principal
    const cabeceraPrincipal = spec.cabecera.toLowerCase();
    let encontrado = false;
    
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      
      // Coincidencia exacta con cabecera principal
      if (header === cabeceraPrincipal) {
        mapping[campoInterno] = headers[i]; // Usar header original
        encontrado = true;
        break;
      }
      
      // Buscar en sinónimos
      for (const sinonimo of spec.sinonimos) {
        if (header === sinonimo.toLowerCase()) {
          mapping[campoInterno] = headers[i]; // Usar header original
          encontrado = true;
          break;
        }
      }
      
      if (encontrado) break;
    }
    
    // Validar campos requeridos
    if (!encontrado && spec.required) {
      throw new Error(`Campo requerido '${campoInterno}' no encontrado. Cabecera esperada: '${spec.cabecera}' o sinónimos: [${spec.sinonimos.join(', ')}]`);
    }
  }
  
  return mapping;
}

/**
 * 🔧 Extraer datos de una fila según la especificación
 */
export function extraerDatosFila(row: any, mapping: Record<string, string>) {
  const datos: any = {};
  
  for (const [campoInterno, headerOriginal] of Object.entries(mapping)) {
    const spec = VENTAS_TOMI_SPEC[campoInterno as keyof typeof VENTAS_TOMI_SPEC];
    const valorRaw = row[headerOriginal];
    
    // Procesar según tipo de campo
    switch (spec.tipo) {
      case 'string':
        datos[campoInterno] = valorRaw?.toString().trim() || '';
        break;
        
      case 'number':
        datos[campoInterno] = parseInt(valorRaw) || null;
        break;
        
      case 'string_or_number':
        // Para mes: puede ser string (ene, feb) o número (1, 2)
        datos[campoInterno] = valorRaw;
        break;
        
      case 'currency':
        // Para montos: parsear como número
        const numValue = parseFloat(valorRaw?.toString().replace(/[^0-9.-]/g, '') || '0');
        datos[campoInterno] = isNaN(numValue) ? 0 : numValue;
        break;
        
      default:
        datos[campoInterno] = valorRaw;
    }
  }
  
  return datos;
}

/**
 * 📊 Validar datos extraídos según especificación FLEXIBLE
 * Solo valida campos críticos para permitir procesamiento de datos reales
 */
export function validarDatosVentasTomi(datos: any): { 
  isValid: boolean; 
  errors: string[]; 
} {
  const errors: string[] = [];
  
  // Validar SOLO campos críticos (cliente, proyecto, año)
  if (!datos.cliente || datos.cliente.trim() === '') {
    errors.push(`Campo crítico 'cliente' está vacío`);
  }
  
  if (!datos.proyecto || datos.proyecto.trim() === '') {
    errors.push(`Campo crítico 'proyecto' está vacío`);
  }
  
  if (!datos.anio || datos.anio < 2020 || datos.anio > 2030) {
    errors.push(`Año inválido: ${datos.anio}. Debe estar entre 2020-2030`);
  }
  
  // Validar que al menos tenga un monto
  if ((!datos.montoUSD || datos.montoUSD <= 0) && (!datos.montoARS || datos.montoARS <= 0)) {
    errors.push(`No hay monto válido (USD=${datos.montoUSD}, ARS=${datos.montoARS})`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}