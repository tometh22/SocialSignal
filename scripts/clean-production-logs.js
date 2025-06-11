#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Configuración
const CONFIG = {
  directories: ['client/src', 'server'],
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  preservePatterns: [
    /console\.error\(/,  // Mantener errores críticos
    /console\.warn\(/,   // Mantener warnings importantes
  ],
  removePatterns: [
    /console\.log\(/,
    /console\.debug\(/,
    /console\.info\(/,
    /console\.trace\(/,
  ]
};

// Estadísticas
let stats = {
  filesProcessed: 0,
  linesRemoved: 0,
  filesModified: 0
};

function shouldProcessFile(filePath) {
  return CONFIG.extensions.some(ext => filePath.endsWith(ext));
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const originalLineCount = lines.length;
    
    let modified = false;
    const newLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let shouldRemove = false;
      
      // Verificar si la línea contiene patterns a remover
      for (const pattern of CONFIG.removePatterns) {
        if (pattern.test(line)) {
          // Verificar si no está en patterns a preservar
          const shouldPreserve = CONFIG.preservePatterns.some(preservePattern => 
            preservePattern.test(line)
          );
          
          if (!shouldPreserve) {
            shouldRemove = true;
            modified = true;
            stats.linesRemoved++;
            console.log(`Removiendo de ${filePath}:${i + 1}: ${line.trim()}`);
            break;
          }
        }
      }
      
      if (!shouldRemove) {
        newLines.push(line);
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
      stats.filesModified++;
      console.log(`✅ Archivo modificado: ${filePath}`);
    }
    
    stats.filesProcessed++;
    
  } catch (error) {
    console.error(`❌ Error procesando ${filePath}:`, error.message);
  }
}

function processDirectory(directory) {
  try {
    const items = fs.readdirSync(directory);
    
    for (const item of items) {
      const fullPath = path.join(directory, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Saltar directorios comunes que no necesitan procesamiento
        if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
          processDirectory(fullPath);
        }
      } else if (stat.isFile() && shouldProcessFile(fullPath)) {
        processFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`❌ Error leyendo directorio ${directory}:`, error.message);
  }
}

function main() {
  console.log('🧹 Iniciando limpieza de logs de producción...\n');
  
  for (const directory of CONFIG.directories) {
    if (fs.existsSync(directory)) {
      console.log(`📁 Procesando directorio: ${directory}`);
      processDirectory(directory);
    } else {
      console.log(`⚠️  Directorio no encontrado: ${directory}`);
    }
  }
  
  console.log('\n📊 Estadísticas de limpieza:');
  console.log(`   Archivos procesados: ${stats.filesProcessed}`);
  console.log(`   Archivos modificados: ${stats.filesModified}`);
  console.log(`   Líneas removidas: ${stats.linesRemoved}`);
  
  if (stats.linesRemoved > 0) {
    console.log('\n✅ Limpieza completada exitosamente');
  } else {
    console.log('\n🎉 No se encontraron logs de depuración para remover');
  }
}

// Ejecutar script
main();