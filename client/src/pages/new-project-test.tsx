import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function NewProjectTest() {
  const [, setLocation] = useLocation();

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => setLocation("/active-projects")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold ml-4">Nuevo Proyecto - Test</h1>
      </div>

      <Card className="mx-auto max-w-4xl">
        <CardHeader>
          <CardTitle>Formulario de Test</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Esta es una página de prueba para verificar que la navegación funciona.</p>
          <Button onClick={() => setLocation("/active-projects")} className="mt-4">
            Volver a Proyectos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}