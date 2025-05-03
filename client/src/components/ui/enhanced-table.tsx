import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from '@/lib/utils';

// Tipo de columna
export interface ColumnDef<T> {
  header: string;
  accessorKey: keyof T | ((row: T) => React.ReactNode);
  className?: string;
  renderCell?: (row: T) => React.ReactNode;
}

export interface EnhancedTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
  rowClassName?: string | ((row: T, index: number) => string);
  rowHoverEffect?: boolean;
  style?: React.CSSProperties;
  glassmorphism?: boolean; // Habilita el efecto glassmorphism
  animateEntrance?: boolean; // Anima la entrada de la tabla
  animateRows?: boolean; // Anima las filas individualmente
  rounded?: boolean; // Bordes redondeados
  onRowClick?: (row: T) => void;
}

export function EnhancedTable<T>({
  columns,
  data,
  isLoading = false,
  emptyState,
  className,
  rowClassName,
  rowHoverEffect = true,
  style,
  glassmorphism = false,
  animateEntrance = false,
  animateRows = false,
  rounded = false,
  onRowClick
}: EnhancedTableProps<T>) {
  
  const getRowClassName = (row: T, index: number) => {
    const baseClasses = cn(
      'transition-colors',
      rowHoverEffect ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50' : '',
      onRowClick ? 'cursor-pointer' : '',
      typeof rowClassName === 'function' ? rowClassName(row, index) : rowClassName
    );
    
    // Si se configuró para animar las filas, añadimos el efecto de slide-in con delay basado en el índice
    if (animateRows) {
      return `${baseClasses} slide-in`;
    }
    
    return baseClasses;
  };
  
  const containerClasses = cn(
    'overflow-x-auto',
    glassmorphism ? 'glass-panel p-4' : '',
    rounded ? 'rounded-lg' : '',
    animateEntrance ? 'scale-in' : '',
    className
  );
  
  const renderAccessor = (row: T, column: ColumnDef<T>) => {
    // Si hay un renderizador de celdas personalizado, úsalo
    if (column.renderCell) {
      return column.renderCell(row);
    }
    
    // Si el accessorKey es una función, ejecútala
    if (typeof column.accessorKey === 'function') {
      return column.accessorKey(row);
    }
    
    // De lo contrario, accede directamente a la propiedad
    const value = row[column.accessorKey as keyof T];
    
    // Maneja tipos básicos
    if (value === null || value === undefined) {
      return '—';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }
    
    return value as React.ReactNode;
  };
  
  if (isLoading) {
    return (
      <div className={containerClasses} style={style}>
        <div className="flex justify-center items-center h-48">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary border-r-0 border-b-1 border-l-0 mx-auto mb-2"></div>
            <p className="text-neutral-500">Cargando datos...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!data.length && emptyState) {
    return (
      <div className={containerClasses} style={style}>
        {emptyState}
      </div>
    );
  }
  
  return (
    <div className={containerClasses} style={style}>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-neutral-200">
            {columns.map((column, index) => (
              <TableHead
                key={index}
                className={cn("text-label text-neutral-500", column.className)}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow
              key={rowIndex}
              className={getRowClassName(row, rowIndex)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={animateRows ? { animationDelay: `${rowIndex * 0.05}s` } : undefined}
            >
              {columns.map((column, colIndex) => (
                <TableCell
                  key={colIndex}
                  className={column.className}
                >
                  {renderAccessor(row, column)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}