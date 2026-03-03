import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader } from '@/components/ui/loader';
import { useLocation } from 'wouter';
import { Eye, EyeOff, AlertCircle, Mail, Lock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation, loading } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      setLocation('/');
    }
  }, [user, loading, setLocation]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSubmitError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      await loginMutation.mutateAsync({
        email: formData.email,
        password: formData.password
      });
    } catch (error: any) {
      setSubmitError(error.message || 'Error en la autenticación. Verificá tus credenciales.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader size="lg" />
          <p className="mt-4 text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mx-auto mb-4"
            >
              <div className="w-20 h-20 bg-black rounded-lg flex items-center justify-center shadow-lg p-3">
                <img
                  src="/epical-logo.jpeg"
                  alt="Epical Digital Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            </motion.div>

            <CardTitle className="text-2xl font-bold text-gray-900">Bienvenido</CardTitle>
            <CardDescription className="text-gray-600">
              Ingresá tus credenciales para acceder al panel
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {submitError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">{submitError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Tu contraseña"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="pl-10 pr-10"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                disabled={isSubmitting || !formData.email || !formData.password}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader size="sm" />
                    <span>Iniciando sesión...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>Iniciar Sesión</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-gray-500 pt-2">
              ¿No tenés acceso? Contactá al administrador de la plataforma.
            </p>
          </CardContent>
        </Card>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6 text-sm text-gray-600"
        >
          <p>Plataforma de Gestión Epical Digital</p>
          <p className="text-xs mt-1">© 2025 - Todos los derechos reservados</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
