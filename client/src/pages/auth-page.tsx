import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader } from '@/components/ui/loader';
import { useLocation } from 'wouter';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Mail, Lock, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation, registerMutation, loading } = useAuth();

  // Estados del formulario
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    confirmPassword: ''
  });

  // Estados de validación y UX
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Redirection si ya está autenticado
  useEffect(() => {
    console.log('🔍 AuthPage useEffect:', { user, redirecting: false });
    if (user) {
      console.log('✅ User authenticated, redirecting to dashboard');
      setLocation('/');
    }
  }, [user, setLocation]);

  // Validación en tiempo real
  useEffect(() => {
    validateForm();
    if (!isLogin) {
      calculatePasswordStrength();
    }
  }, [formData, isLogin]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validación de email
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Formato de email inválido';
    }

    // Validación de contraseña
    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    // Validaciones para registro
    if (!isLogin) {
      if (formData.firstName && formData.firstName.length < 2) {
        newErrors.firstName = 'El nombre debe tener al menos 2 caracteres';
      }

      if (formData.lastName && formData.lastName.length < 2) {
        newErrors.lastName = 'El apellido debe tener al menos 2 caracteres';
      }

      if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Las contraseñas no coinciden';
      }
    }

    setErrors(newErrors);
  };

  const calculatePasswordStrength = () => {
    const password = formData.password;
    let strength = 0;

    if (password.length >= 6) strength += 20;
    if (password.length >= 10) strength += 20;
    if (/[A-Z]/.test(password)) strength += 20;
    if (/[0-9]/.test(password)) strength += 20;
    if (/[^A-Za-z0-9]/.test(password)) strength += 20;

    setPasswordStrength(strength);
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 40) return 'bg-red-500';
    if (passwordStrength <= 60) return 'bg-yellow-500';
    if (passwordStrength <= 80) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 40) return 'Débil';
    if (passwordStrength <= 60) return 'Regular';
    if (passwordStrength <= 80) return 'Buena';
    return 'Excelente';
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación final
    validateForm();
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    try {
      if (isLogin) {
        const userData = await loginMutation.mutateAsync({
          email: formData.email,
          password: formData.password
        });
        // Asegurar que el usuario está establecido antes de redirigir
        if (userData) {
          console.log('🚀 Login successful, redirecting to dashboard...');
          setTimeout(() => setLocation('/'), 100); // Pequeño delay para asegurar que el estado se actualice
        }
      } else {
        await registerMutation.mutateAsync({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName
        });
        setShowSuccess(true);
        setTimeout(() => {
          setIsLogin(true);
          setShowSuccess(false);
        }, 2000);
      }
    } catch (error: any) {
      setErrors({ 
        submit: error.message || 'Error en la autenticación. Verifica tus credenciales.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      confirmPassword: ''
    });
    setErrors({});
    setPasswordStrength(0);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Loader size="lg" />
          <p className="mt-4 text-gray-600">Verificando autenticación...</p>
        </motion.div>
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
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">E</span>
              </div>
            </motion.div>

            <CardTitle className="text-2xl font-bold text-gray-900">
              {isLogin ? 'Bienvenido de vuelta' : 'Crear cuenta'}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {isLogin 
                ? 'Ingresa tus credenciales para acceder al panel' 
                : 'Completa los datos para registrarte en la plataforma'
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <AnimatePresence mode="wait">
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      ¡Cuenta creada exitosamente! Redirigiendo al login...
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {errors.submit && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {errors.submit}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Nombre</Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="Tu nombre"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className={errors.firstName ? 'border-red-300 focus:border-red-500' : ''}
                        required={!isLogin}
                      />
                      {errors.firstName && (
                        <p className="text-xs text-red-600">{errors.firstName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName">Apellido</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Tu apellido"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className={errors.lastName ? 'border-red-300 focus:border-red-500' : ''}
                        required={!isLogin}
                      />
                      {errors.lastName && (
                        <p className="text-xs text-red-600">{errors.lastName}</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
                    className={`pl-10 ${errors.email ? 'border-red-300 focus:border-red-500' : ''}`}
                    required
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email}</p>
                )}
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
                    className={`pl-10 pr-10 ${errors.password ? 'border-red-300 focus:border-red-500' : ''}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600">{errors.password}</p>
                )}

                {!isLogin && formData.password && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-1"
                  >
                    <div className="flex justify-between text-xs">
                      <span>Fortaleza de contraseña:</span>
                      <span className={`font-medium ${
                        passwordStrength <= 40 ? 'text-red-600' :
                        passwordStrength <= 60 ? 'text-yellow-600' :
                        passwordStrength <= 80 ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        {getPasswordStrengthText()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                        style={{ width: `${passwordStrength}%` }}
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Confirma tu contraseña"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className={`pl-10 ${errors.confirmPassword ? 'border-red-300 focus:border-red-500' : ''}`}
                        required={!isLogin}
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-xs text-red-600">{errors.confirmPassword}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                disabled={isSubmitting || Object.keys(errors).length > 0}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader size="sm" />
                    <span>Procesando...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>

            <div className="text-center pt-4">
              <button
                onClick={toggleMode}
                className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                {isLogin 
                  ? '¿No tienes cuenta? Regístrate aquí' 
                  : '¿Ya tienes cuenta? Inicia sesión'
                }
              </button>
            </div>
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