import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export function TomiDebugger() {
  const { data: personnel, isLoading } = useQuery({
    queryKey: ["/api/personnel"],
  });

  useEffect(() => {
    if (personnel) {
      console.log('🔍 DEBUGGER - TODOS LOS DATOS:', personnel);
      const tomi = personnel.find((p: any) => p.name?.includes('Tomi'));
      if (tomi) {
        console.log('🔍 DEBUGGER - TOMI ENCONTRADO:', tomi);
        console.log('🔍 DEBUGGER - CLAVES TOMI:', Object.keys(tomi));
        console.log('🔍 DEBUGGER - VALORES ESPECÍFICOS:', {
          jan2025MonthlySalaryARS: tomi.jan2025MonthlySalaryARS,
          feb2025MonthlySalaryARS: tomi.feb2025MonthlySalaryARS,
          mar2025MonthlySalaryARS: tomi.mar2025MonthlySalaryARS,
          apr2025MonthlySalaryARS: tomi.apr2025MonthlySalaryARS,
        });
      } else {
        console.log('🔍 DEBUGGER - NO SE ENCONTRÓ TOMI');
      }
    }
  }, [personnel]);

  if (isLoading) return <div>Cargando datos de debug...</div>;

  const tomi = personnel?.find((p: any) => p.name?.includes('Tomi'));

  return (
    <div style={{ 
      border: '2px solid red', 
      padding: '20px', 
      margin: '20px',
      backgroundColor: '#fff3cd'
    }}>
      <h3>🔍 DEBUGGER DE TOMI CRIADO</h3>
      {tomi ? (
        <div>
          <p><strong>Nombre:</strong> {tomi.name}</p>
          <p><strong>Enero 2025:</strong> {tomi.jan2025MonthlySalaryARS || 'null/undefined'}</p>
          <p><strong>Febrero 2025:</strong> {tomi.feb2025MonthlySalaryARS || 'null/undefined'}</p>
          <p><strong>Marzo 2025:</strong> {tomi.mar2025MonthlySalaryARS || 'null/undefined'}</p>
          <p><strong>Abril 2025:</strong> {tomi.apr2025MonthlySalaryARS || 'null/undefined'}</p>
          <details>
            <summary>Ver todas las claves del objeto</summary>
            <pre>{JSON.stringify(Object.keys(tomi), null, 2)}</pre>
          </details>
          <details>
            <summary>Ver objeto completo</summary>
            <pre>{JSON.stringify(tomi, null, 2)}</pre>
          </details>
        </div>
      ) : (
        <p>❌ No se encontró a Tomi Criado en los datos</p>
      )}
    </div>
  );
}