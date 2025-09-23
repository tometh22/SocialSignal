/**
 * 🧪 TESTS UNITARIOS - ETL LÍNEAS GENERALES
 * Verifica reglas de preferencia ARS/USD, mapeo de campos, y anti-×100 detection
 */

import { describe, test, expect } from '@jest/globals';
import { 
  LINEAS_GENERALES_SPEC, 
  mapearCabecerasLineasGenerales, 
  extraerDatosFilaLineasGenerales, 
  validarDatosLineasGenerales,
  calcularMontoFinalUSD
} from './lineas-generales-spec';

describe('Líneas Generales ETL - Mapeo de Cabeceras', () => {
  
  test('debe mapear cabeceras principales correctamente', () => {
    const headers = ['Cliente', 'Proyecto', 'Mes', 'Año', 'Monto Total USD', 'Cotización'];
    const mapping = mapearCabecerasLineasGenerales(headers);
    
    expect(mapping.cliente).toBe(0);
    expect(mapping.proyecto).toBe(1);
    expect(mapping.mes).toBe(2);
    expect(mapping.anio).toBe(3);
    expect(mapping.montoUSD).toBe(4);
    expect(mapping.cotizacion).toBe(5);
  });

  test('debe respetar prioridades en campos con múltiples opciones', () => {
    // Test campo montoUSD: preferir "Monto Total USD" sobre "Monto Original USD"
    const headers1 = ['Cliente', 'Proyecto', 'Monto Total USD', 'Monto Original USD'];
    const mapping1 = mapearCabecerasLineasGenerales(headers1);
    expect(mapping1.montoUSD).toBe(2); // Prefiere "Monto Total USD"
    
    // Test campo horas: preferir "Cantidad de horas asana" sobre "Cantidad de Horas"
    const headers2 = ['Cliente', 'Proyecto', 'Cantidad de Horas', 'Cantidad de horas asana'];
    const mapping2 = mapearCabecerasLineasGenerales(headers2);
    expect(mapping2.horas).toBe(3); // Prefiere "Cantidad de horas asana"
  });

  test('debe usar sinónimos cuando no encuentra cabecera principal', () => {
    const headers = ['Client', 'Project', 'Month', 'Year', 'USD'];
    const mapping = mapearCabecerasLineasGenerales(headers);
    
    expect(mapping.cliente).toBe(0); // "Client" es sinónimo de "Cliente"
    expect(mapping.proyecto).toBe(1); // "Project" es sinónimo de "Proyecto"  
    expect(mapping.mes).toBe(2); // "Month" es sinónimo de "Mes"
    expect(mapping.montoUSD).toBe(4); // "USD" es sinónimo
  });

  test('debe retornar null para campos no encontrados', () => {
    const headers = ['Cliente', 'Proyecto'];
    const mapping = mapearCabecerasLineasGenerales(headers);
    
    expect(mapping.cliente).toBe(0);
    expect(mapping.proyecto).toBe(1);
    expect(mapping.mes).toBe(null);
    expect(mapping.anio).toBe(null);
    expect(mapping.montoUSD).toBe(null);
  });
});

describe('Líneas Generales ETL - Extracción de Datos', () => {
  
  test('debe extraer datos usando mapeo de columnas', () => {
    const fila = ['Warner', 'Fee Marketing', 'agosto', 2025, 1500, 1200];
    const mapping = { cliente: 0, proyecto: 1, mes: 2, anio: 3, montoUSD: 4, cotizacion: 5 };
    
    const datos = extraerDatosFilaLineasGenerales(fila, mapping);
    
    expect(datos.cliente).toBe('Warner');
    expect(datos.proyecto).toBe('Fee Marketing');
    expect(datos.mes).toBe('agosto');
    expect(datos.anio).toBe(2025);
    expect(datos.montoUSD).toBe(1500);
    expect(datos.cotizacion).toBe(1200);
  });

  test('debe retornar null para columnas no mapeadas', () => {
    const fila = ['Warner', 'Fee Marketing'];
    const mapping = { cliente: 0, proyecto: 1, mes: null, anio: null };
    
    const datos = extraerDatosFilaLineasGenerales(fila, mapping);
    
    expect(datos.cliente).toBe('Warner');
    expect(datos.proyecto).toBe('Fee Marketing');
    expect(datos.mes).toBe(null);
    expect(datos.anio).toBe(null);
  });
});

describe('Líneas Generales ETL - Validación de Datos', () => {
  
  test('debe validar datos correctos', () => {
    const datos = {
      cliente: 'Warner',
      proyecto: 'Fee Marketing',
      mes: 'agosto',
      anio: 2025,
      montoUSD: 1500
    };
    
    const resultado = validarDatosLineasGenerales(datos);
    expect(resultado.valido).toBe(true);
    expect(resultado.errores).toHaveLength(0);
  });

  test('debe detectar campos requeridos faltantes', () => {
    const datos = {
      cliente: '', // Faltante
      proyecto: 'Fee Marketing',
      mes: 'agosto',
      anio: 2025,
      montoUSD: 1500
    };
    
    const resultado = validarDatosLineasGenerales(datos);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores).toContain('Campo requerido faltante: cliente');
  });

  test('debe requerir al menos un monto (ARS o USD)', () => {
    const datos = {
      cliente: 'Warner',
      proyecto: 'Fee Marketing', 
      mes: 'agosto',
      anio: 2025
      // Sin montoUSD ni montoARS
    };
    
    const resultado = validarDatosLineasGenerales(datos);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores).toContain('Debe tener al menos montoARS o montoUSD');
  });

  test('debe requerir cotización si hay ARS pero no USD', () => {
    const datos = {
      cliente: 'Warner',
      proyecto: 'Fee Marketing',
      mes: 'agosto', 
      anio: 2025,
      montoARS: 150000
      // Sin montoUSD ni cotizacion
    };
    
    const resultado = validarDatosLineasGenerales(datos);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores).toContain('Si hay montoARS sin montoUSD, se requiere cotización');
  });
});

describe('Líneas Generales ETL - Cálculo de Monto Final USD', () => {
  
  test('debe preferir USD directo cuando está disponible', () => {
    const datos = {
      montoUSD: 1500,
      montoARS: 150000,
      cotizacion: 120
    };
    
    const resultado = calcularMontoFinalUSD(datos);
    
    expect(resultado.montoFinalUSD).toBe(1500);
    expect(resultado.metodo).toBe('usd_directo');
    expect(resultado.detalles).toBe('USD directo: $1500');
  });

  test('debe convertir ARS a USD cuando no hay USD directo', () => {
    const datos = {
      montoARS: 120000,
      cotizacion: 1200 
      // Sin montoUSD
    };
    
    const resultado = calcularMontoFinalUSD(datos);
    
    expect(resultado.montoFinalUSD).toBe(100); // 120000 / 1200
    expect(resultado.metodo).toBe('ars_convertido');
    expect(resultado.detalles).toBe('ARS 120000 / 1200 = $100.00');
  });

  test('debe retornar null cuando no hay suficientes datos', () => {
    const datos = {
      montoARS: 120000
      // Sin cotizacion ni montoUSD
    };
    
    const resultado = calcularMontoFinalUSD(datos);
    
    expect(resultado.montoFinalUSD).toBe(null);
    expect(resultado.metodo).toBe('no_disponible');
    expect(resultado.detalles).toBe('No hay suficientes datos para calcular USD');
  });

  test('debe ignorar valores inválidos (cero o negativo)', () => {
    const datos = {
      montoUSD: 0,
      montoARS: -1000,
      cotizacion: 1200
    };
    
    const resultado = calcularMontoFinalUSD(datos);
    
    expect(resultado.montoFinalUSD).toBe(null);
    expect(resultado.metodo).toBe('no_disponible');
  });

  test('debe manejar cotización cero correctamente', () => {
    const datos = {
      montoARS: 120000,
      cotizacion: 0
    };
    
    const resultado = calcularMontoFinalUSD(datos);
    
    expect(resultado.montoFinalUSD).toBe(null);
    expect(resultado.metodo).toBe('no_disponible');
  });
});

describe('Líneas Generales ETL - Casos de Uso Reales', () => {
  
  test('caso Warner Fee Marketing con anti-×100', () => {
    const headers = ['Cliente', 'Proyecto', 'Mes', 'Año', 'Monto Total USD'];
    const fila = ['Warner', 'Fee Marketing', 'agosto', 2025, 2923000]; // x100 error
    
    const mapping = mapearCabecerasLineasGenerales(headers);
    const datos = extraerDatosFilaLineasGenerales(fila, mapping);
    const validacion = validarDatosLineasGenerales(datos);
    const monto = calcularMontoFinalUSD(datos);
    
    expect(validacion.valido).toBe(true);
    expect(monto.montoFinalUSD).toBe(2923000); // El ETL corregirá esto con anti-×100
    expect(monto.metodo).toBe('usd_directo');
  });

  test('caso con ARS y cotización', () => {
    const headers = ['Cliente', 'Proyecto', 'Mes', 'Año', 'Monto Original ARS', 'Cotización'];
    const fila = ['Kimberly Clark', 'Fee Huggies', 'agosto', 2025, 10140000, 1200];
    
    const mapping = mapearCabecerasLineasGenerales(headers);
    const datos = extraerDatosFilaLineasGenerales(fila, mapping);
    const monto = calcularMontoFinalUSD(datos);
    
    expect(monto.montoFinalUSD).toBe(8450); // 10140000 / 1200
    expect(monto.metodo).toBe('ars_convertido');
  });

  test('caso con horas trabajadas (indica costo)', () => {
    const headers = ['Cliente', 'Proyecto', 'Mes', 'Año', 'Monto Total USD', 'Cantidad de horas asana'];
    const fila = ['Test Client', 'Test Project', 'agosto', 2025, 1000, 40];
    
    const mapping = mapearCabecerasLineasGenerales(headers);
    const datos = extraerDatosFilaLineasGenerales(fila, mapping);
    
    expect(datos.horas).toBe(40); // Indica que es un registro de costo
    expect(datos.montoUSD).toBe(1000);
  });

  test('caso con preferencia de campos múltiples', () => {
    const headers = [
      'Cliente', 'Proyecto', 'Mes', 'Año', 
      'Cantidad de Horas', 'Cantidad de horas asana',
      'Monto Original USD', 'Monto Total USD'
    ];
    const fila = ['Client', 'Project', 'agosto', 2025, 50, 40, 800, 1000];
    
    const mapping = mapearCabecerasLineasGenerales(headers);
    const datos = extraerDatosFilaLineasGenerales(fila, mapping);
    
    // Debe preferir "Cantidad de horas asana" (índice 5) sobre "Cantidad de Horas" (índice 4)
    expect(mapping.horas).toBe(5);
    expect(datos.horas).toBe(40);
    
    // Debe preferir "Monto Total USD" (índice 7) sobre "Monto Original USD" (índice 6)
    expect(mapping.montoUSD).toBe(7);
    expect(datos.montoUSD).toBe(1000);
  });
});