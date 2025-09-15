/**
 * Tests unitarios para parseDec universal
 * Validando ES/US, miles, moneda, paréntesis negativos
 */

import { parseDec, normMonth } from '../num.js';

describe('parseDec - Función universal de parsing numérico', () => {
  
  // Casos básicos
  test('números directos', () => {
    expect(parseDec(1234.56)).toBe(1234.56);
    expect(parseDec(0)).toBe(0);
    expect(parseDec(null)).toBe(0);
    expect(parseDec(undefined)).toBe(0);
  });

  // Formato US ($1,234.56)
  test('formato US con comas como miles y punto decimal', () => {
    expect(parseDec('$1,234.56')).toBe(1234.56);
    expect(parseDec('1,234.56')).toBe(1234.56);
    expect(parseDec('10,000')).toBe(10000);
    expect(parseDec('1,000,000.50')).toBe(1000000.50);
  });

  // Formato ES (1.234,56)
  test('formato ES con puntos como miles y coma decimal', () => {
    expect(parseDec('1.234,56')).toBe(1234.56);
    expect(parseDec('10.000')).toBe(10000);
    expect(parseDec('1.000.000,50')).toBe(1000000.50);
  });

  // Espacios como separadores de miles
  test('espacios como separadores de miles', () => {
    expect(parseDec('1 234,56')).toBe(1234.56);
    expect(parseDec('1 234.56')).toBe(1234.56);
    expect(parseDec('10 000')).toBe(10000);
  });

  // Paréntesis negativos
  test('paréntesis como números negativos', () => {
    expect(parseDec('(1.234,56)')).toBe(-1234.56);
    expect(parseDec('($1,234.56)')).toBe(-1234.56);
    expect(parseDec('(10,000)')).toBe(-10000);
  });

  // Símbolos de moneda
  test('símbolos de moneda removidos', () => {
    expect(parseDec('$1,234.56')).toBe(1234.56);
    expect(parseDec('€1.234,56')).toBe(1234.56);
    expect(parseDec('£1,234.56')).toBe(1234.56);
    expect(parseDec('1,234.56%')).toBe(1234.56);
  });

  // Casos edge con un solo separador
  test('casos edge con un solo separador', () => {
    // Decimal (1-2 dígitos después)
    expect(parseDec('123.45')).toBe(123.45);
    expect(parseDec('123,45')).toBe(123.45);
    expect(parseDec('123.5')).toBe(123.5);
    
    // Miles (3+ dígitos después o patrón obvio)
    expect(parseDec('123.456')).toBe(123456);
    expect(parseDec('123,456')).toBe(123456);
  });

  // Casos límite
  test('casos límite y edge cases', () => {
    expect(parseDec('')).toBe(0);
    expect(parseDec('abc')).toBe(0);
    expect(parseDec('0')).toBe(0);
    expect(parseDec('0.00')).toBe(0);
    expect(parseDec('   1,234.56   ')).toBe(1234.56);
  });
});

describe('normMonth - Normalización de meses', () => {
  
  test('números directos', () => {
    expect(normMonth(1)).toBe(1);
    expect(normMonth(12)).toBe(12);
    expect(normMonth(7)).toBe(7);
  });

  test('strings en español', () => {
    expect(normMonth('ene')).toBe(1);
    expect(normMonth('jul')).toBe(7);
    expect(normMonth('dic')).toBe(12);
    expect(normMonth('ENE')).toBe(1); // case insensitive
  });

  test('strings largos', () => {
    expect(normMonth('enero')).toBe(1);
    expect(normMonth('julio')).toBe(7);
    expect(normMonth('diciembre')).toBe(12);
  });

  test('números como string', () => {
    expect(normMonth('7')).toBe(7);
    expect(normMonth('12')).toBe(12);
  });

  test('casos inválidos', () => {
    expect(normMonth('invalid')).toBe(0);
    expect(normMonth('')).toBe(0);
  });
});