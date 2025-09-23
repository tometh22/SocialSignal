/**
 * 📋 ESPECIFICACIÓN FORMATO "LÍNEAS GENERALES"
 * Formato universal con manejo de ARS/USD y cotización
 */

/**
 * FORMATO: "Líneas Generales" 
 * TIPO: Universal (ventas/costos/horas)
 * 
 * Columnas con formato flexible y reglas de preferencia
 */
export const LINEAS_GENERALES_SPEC = {
  /**
   * Campo interno: cliente
   * Cabecera esperada: "Cliente"
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
   */
  anio: {
    cabecera: 'Año',
    sinonimos: ['Year', 'Año (numérico)'],
    required: true,
    tipo: 'number'
  },

  /**
   * Campo interno: horas
   * REGLA: Preferir "Cantidad de horas asana"; si no, "Cantidad de Horas"
   * Cabeceras por prioridad: ["Cantidad de horas asana", "Cantidad de Horas"]
   */
  horas: {
    cabecera: 'Cantidad de horas asana',
    sinonimos: ['Cantidad de Horas', 'Horas', 'Hours'],
    required: false,
    tipo: 'number',
    prioridad: ['Cantidad de horas asana', 'Cantidad de Horas'] // Orden de preferencia
  },

  /**
   * Campo interno: montoARS
   * Cabecera esperada: "Monto Original ARS"
   */
  montoARS: {
    cabecera: 'Monto Original ARS',
    sinonimos: ['Monto ARS', 'ARS'],
    required: false,
    tipo: 'number'
  },

  /**
   * Campo interno: montoUSD
   * REGLA: Preferir "Monto Total USD"; si no, "Monto Original USD"
   * Cabeceras por prioridad: ["Monto Total USD", "Monto Original USD"]
   */
  montoUSD: {
    cabecera: 'Monto Total USD',
    sinonimos: ['Monto Original USD', 'USD', 'Total USD'],
    required: false,
    tipo: 'number',
    prioridad: ['Monto Total USD', 'Monto Original USD'] // Orden de preferencia
  },

  /**
   * Campo interno: cotizacion
   * Cabecera esperada: "Cotización"
   */
  cotizacion: {
    cabecera: 'Cotización',
    sinonimos: ['Exchange Rate', 'Tipo de Cambio', 'FX'],
    required: false,
    tipo: 'number'
  }
};

/**
 * 📋 Mapea cabeceras de una sheet al formato líneas generales
 */
export function mapearCabecerasLineasGenerales(headers: string[]): Record<string, number | null> {
  const mapping: Record<string, number | null> = {};
  
  // Para cada campo en la spec
  for (const [campo, spec] of Object.entries(LINEAS_GENERALES_SPEC)) {
    let encontrado = false;
    
    // Si hay prioridad definida, buscar en orden
    if ('prioridad' in spec && spec.prioridad) {
      for (const cabeceraPriorizada of spec.prioridad) {
        const index = headers.findIndex(h => 
          h.toLowerCase().trim() === cabeceraPriorizada.toLowerCase().trim()
        );
        if (index !== -1) {
          mapping[campo] = index;
          encontrado = true;
          console.log(`🔧 PRIORIDAD: Campo "${campo}" mapeado a cabecera "${cabeceraPriorizada}" (columna ${index})`);
          break;
        }
      }
    }
    
    // Si no se encontró por prioridad, buscar cabecera principal
    if (!encontrado) {
      const index = headers.findIndex(h => 
        h.toLowerCase().trim() === spec.cabecera.toLowerCase().trim()
      );
      if (index !== -1) {
        mapping[campo] = index;
        encontrado = true;
      }
    }
    
    // Si no se encontró, buscar en sinónimos
    if (!encontrado) {
      for (const sinonimo of spec.sinonimos) {
        const index = headers.findIndex(h => 
          h.toLowerCase().trim() === sinonimo.toLowerCase().trim()
        );
        if (index !== -1) {
          mapping[campo] = index;
          encontrado = true;
          break;
        }
      }
    }
    
    if (!encontrado) {
      mapping[campo] = null;
      if (spec.required) {
        console.warn(`⚠️ Campo requerido "${campo}" no encontrado en headers`);
      }
    }
  }
  
  return mapping;
}

/**
 * 🔧 Extrae datos de una fila usando el mapeo de cabeceras
 */
export function extraerDatosFilaLineasGenerales(
  fila: any[], 
  mapping: Record<string, number | null>
): Record<string, any> {
  const datos: Record<string, any> = {};
  
  for (const [campo, columna] of Object.entries(mapping)) {
    if (columna !== null && fila[columna] !== undefined) {
      datos[campo] = fila[columna];
    } else {
      datos[campo] = null;
    }
  }
  
  return datos;
}

/**
 * ✅ Valida que los datos extraídos cumplan las reglas básicas
 */
export function validarDatosLineasGenerales(datos: Record<string, any>): {
  valido: boolean;
  errores: string[];
} {
  const errores: string[] = [];
  
  // Verificar campos requeridos
  for (const [campo, spec] of Object.entries(LINEAS_GENERALES_SPEC)) {
    if (spec.required && (!datos[campo] || datos[campo] === '')) {
      errores.push(`Campo requerido faltante: ${campo}`);
    }
  }
  
  // Validar que tengamos al menos un monto (ARS o USD)
  if (!datos.montoARS && !datos.montoUSD) {
    errores.push('Debe tener al menos montoARS o montoUSD');
  }
  
  // Si tenemos ARS pero no USD, debe existir cotización
  if (datos.montoARS && !datos.montoUSD && !datos.cotizacion) {
    errores.push('Si hay montoARS sin montoUSD, se requiere cotización');
  }
  
  return {
    valido: errores.length === 0,
    errores
  };
}

/**
 * 💰 Calcula el monto final en USD usando las reglas de preferencia
 * REGLA: Preferir montoUSD; si no, ARS / Cotización
 */
export function calcularMontoFinalUSD(datos: Record<string, any>): {
  montoFinalUSD: number | null;
  metodo: 'usd_directo' | 'ars_convertido' | 'no_disponible';
  detalles: string;
} {
  // Regla: Preferir USD directo
  if (datos.montoUSD && typeof datos.montoUSD === 'number' && datos.montoUSD > 0) {
    return {
      montoFinalUSD: datos.montoUSD,
      metodo: 'usd_directo',
      detalles: `USD directo: $${datos.montoUSD}`
    };
  }
  
  // Si no hay USD directo, intentar ARS / Cotización
  if (datos.montoARS && datos.cotizacion && 
      typeof datos.montoARS === 'number' && typeof datos.cotizacion === 'number' &&
      datos.montoARS > 0 && datos.cotizacion > 0) {
    const convertido = datos.montoARS / datos.cotizacion;
    return {
      montoFinalUSD: convertido,
      metodo: 'ars_convertido',
      detalles: `ARS ${datos.montoARS} / ${datos.cotizacion} = $${convertido.toFixed(2)}`
    };
  }
  
  return {
    montoFinalUSD: null,
    metodo: 'no_disponible',
    detalles: 'No hay suficientes datos para calcular USD'
  };
}