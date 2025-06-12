import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

export default function TestAlwaysOn() {
  const [, setLocation] = useLocation();

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al Dashboard
        </Button>
        <h1 className="text-3xl font-bold">Test Always-On Page</h1>
      </div>
      <div className="bg-white border rounded-lg p-6">
        <p>Esta es una página de prueba para verificar que la ruta funciona correctamente.</p>
        <p>Si ves este mensaje, la ruta /recurring-templates está funcionando.</p>
      </div>
    </div>
  );
}