import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Personnel } from "@shared/schema";

export default function TestPersonnel() {
  const [error, setError] = useState<string | null>(null);
  
  // Consulta de datos de personal usando TanStack Query
  const { data: personnel, isLoading, isError } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
  });

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Test de Carga de Personal</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Estado de la Consulta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Cargando:</strong> {isLoading ? "Sí" : "No"}</p>
            <p><strong>Error:</strong> {isError ? "Sí" : "No"}</p>
            <p><strong>Cantidad de personal:</strong> {personnel?.length || 0}</p>
          </div>
        </CardContent>
      </Card>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Lista de Personal</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Cargando...</p>
          ) : isError ? (
            <p>Error al cargar los datos</p>
          ) : personnel && personnel.length > 0 ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">ID</th>
                  <th className="border p-2 text-left">Nombre</th>
                  <th className="border p-2 text-left">ID de Rol</th>
                  <th className="border p-2 text-left">Tarifa por Hora</th>
                </tr>
              </thead>
              <tbody>
                {personnel.map(person => (
                  <tr key={person.id}>
                    <td className="border p-2">{person.id}</td>
                    <td className="border p-2">{person.name}</td>
                    <td className="border p-2">{person.roleId}</td>
                    <td className="border p-2">${person.hourlyRate.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No hay personal disponible</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}