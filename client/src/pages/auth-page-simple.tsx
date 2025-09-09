import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader } from '@/components/ui/loader';
import { useLocation } from 'wouter';
import { AlertCircle } from 'lucide-react';

export default function AuthPageSimple() {
  // Todos los hooks al principio - orden fijo siempre
  const [, setLocation] = useLocation();
  const { user, loginMutation, loading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

  // Solo un useEffect para manejar redirección
  useEffect(() => {
    console.log('🔍 AuthPage useEffect:', { user: !!user, loading });
    if (user && !loading) {
      console.log('✅ User authenticated, redirecting to dashboard');
      setLocation('/');
    }
  }, [user, loading, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      await loginMutation.mutateAsync({
        email: formData.email,
        password: formData.password
      });
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
    }
  };

  // Estado de carga - renderizado simple
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader size="lg" />
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Iniciando...' : 'Iniciar Sesión'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <div className="text-xs text-gray-500">
              <p className="mb-2">Credenciales de prueba:</p>
              <button
                type="button"
                onClick={() => setFormData({ email: 'demo@epical.digital', password: 'demo123' })}
                className="text-blue-600 hover:text-blue-700 underline text-xs"
              >
                demo@epical.digital / demo123
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}