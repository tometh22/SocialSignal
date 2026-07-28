import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader } from '@/components/ui/loader';
import { useLocation } from 'wouter';
import { Eye, EyeOff, AlertCircle, Mail, Lock, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import BrandMark from '@/components/layout/brand-mark';
import { getFirstAllowedRouteForUser } from '@/lib/first-allowed-route';

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation, loading } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      setLocation(getFirstAllowedRouteForUser(user as any));
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
      <div className="flex min-h-screen items-center justify-center bg-[#080c13]">
        <div className="text-center">
          <Loader size="lg" />
          <p className="mt-4 text-sm text-white/50">Preparando tu workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080c13] p-3 sm:p-6">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-rose-500/[0.09] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 right-0 h-[38rem] w-[38rem] rounded-full bg-indigo-500/[0.08] blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-[0_40px_120px_-45px_rgba(0,0,0,0.8)] lg:min-h-[700px] lg:grid-cols-[1.1fr_0.9fr]"
      >
        <section className="relative hidden overflow-hidden bg-[#0b0f17] p-12 lg:flex lg:flex-col">
          <div className="pointer-events-none absolute -right-28 top-16 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.10]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
          <BrandMark className="relative z-10" />

          <div className="relative z-10 my-auto max-w-lg">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/[0.62]">
              <Sparkles className="h-3.5 w-3.5 text-rose-400" />Operating intelligence
            </div>
            <h1 className="m-0 text-[3.25rem] font-bold leading-[1.02] tracking-[-0.06em] text-white">
              Decisiones claras.<br /><span className="text-white/[0.55]">Ejecución impecable.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/[0.62]">
              El sistema operativo de Epical para conectar estrategia, proyectos, rentabilidad y equipo.
            </p>

            <div className="mt-10 grid gap-3">
              {[
                "Un único contexto para toda la operación",
                "Señales accionables en tiempo real",
                "Trazabilidad de punta a punta",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-medium text-white/[0.7]">
                  <span className="grid h-6 w-6 place-items-center rounded-lg border border-emerald-400/[0.15] bg-emerald-400/[0.08] text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.42]">
            Built by Epical Digital
          </p>
        </section>

        <section className="flex items-center bg-white px-5 py-8 sm:px-12 lg:px-14">
          <Card className="mx-auto w-full max-w-md border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 pb-7 pt-0 text-left">
              <div className="mb-8 lg:hidden">
                <div className="inline-flex rounded-2xl bg-[#0b0f17] p-2">
                  <BrandMark />
                </div>
              </div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Acceso seguro</p>
              <CardTitle className="text-3xl font-bold tracking-[-0.045em] text-slate-950">Bienvenido de nuevo</CardTitle>
              <CardDescription className="mt-2 text-sm leading-6 text-slate-500">
                Ingresá tus credenciales para continuar a tu workspace.
            </CardDescription>
          </CardHeader>

            <CardContent className="space-y-5 px-0 pb-0">
            {submitError && (
                <Alert className="rounded-xl border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">{submitError}</AlertDescription>
              </Alert>
            )}

              <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Email de trabajo</Label>
                <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                      className="h-11 pl-10"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

                <div className="space-y-2.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-700">Contraseña</Label>
                <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Tu contraseña"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                      className="h-11 pl-10 pr-11"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                  className="h-11 w-full"
                disabled={isSubmitting || !formData.email || !formData.password}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader size="sm" />
                      <span>Iniciando sesión…</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                      <span>Ingresar a Mind</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>

              <p className="pt-1 text-center text-xs text-slate-400">
              ¿No tenés acceso? Contactá al administrador de la plataforma.
            </p>
          </CardContent>
        </Card>
          <p className="mt-8 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-slate-300">
            © {new Date().getFullYear()} Epical Digital · Acceso privado
          </p>
        </section>
      </motion.div>
    </div>
  );
}
