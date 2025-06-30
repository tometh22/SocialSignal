import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, EyeOff, BarChart, ClockIcon, MessageSquare, FileText, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
// Importamos componentes y hooks necesarios
import { Logo } from "@/components/ui/logo";

// Esquemas de validación
const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

const registerSchema = z.object({
  firstName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  lastName: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const { user, loginMutation, registerMutation, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [redirecting, setRedirecting] = useState<boolean>(false);
  const { toast } = useToast();

  // Estados para forgot password
  const [forgotPasswordStep, setForgotPasswordStep] = useState<"email" | "token">("email");
  const [resetToken, setResetToken] = useState<string>("");

  // Redireccionar si el usuario ya está autenticado
  useEffect(() => {
    console.log('🔍 AuthPage useEffect:', { user: !!user, redirecting });
    if (user) {
      console.log('✅ User detected in AuthPage, starting redirect...');
      setRedirecting(true);
      // Redirección con un pequeño delay para asegurar que la sesión esté establecida
      setTimeout(() => {
        console.log('🚀 Navigating to /dashboard');
        navigate("/dashboard");
      }, 100);
    }
  }, [user, navigate]);

  // Estados para mostrar/ocultar contraseñas
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);

  // Configuración del formulario de inicio de sesión
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Configuración del formulario de registro
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Configuración del formulario de forgot password
  const forgotPasswordForm = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  // Configuración del formulario de reset password
  const resetPasswordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Mutación para solicitar reseteo de contraseña
  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordFormValues) => {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al solicitar recuperación");
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Solicitud enviada",
        description: "Si el correo existe en nuestro sistema, recibirás un enlace de recuperación.",
      });
      // Para testing, usar el token devuelto
      if (data.token) {
        setResetToken(data.token);
        resetPasswordForm.setValue("token", data.token);
        setForgotPasswordStep("token");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al solicitar recuperación de contraseña",
        variant: "destructive",
      });
    },
  });

  // Mutación para resetear contraseña
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordFormValues) => {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al resetear contraseña");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido actualizada correctamente. Ahora puedes iniciar sesión.",
      });
      setActiveTab("login");
      setForgotPasswordStep("email");
      resetPasswordForm.reset();
      forgotPasswordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al resetear la contraseña",
        variant: "destructive",
      });
    },
  });

  // Manejar envío del formulario de inicio de sesión
  function onLoginSubmit(data: LoginFormValues) {
    // Limpiar errores previos
    loginForm.setError("root", { message: "" });
    
    // Mostrar estado de carga
    setRedirecting(true);
    
    // Usar la mutación del hook de auth
    loginMutation.mutate(data, {
      onSuccess: async (user) => {
        console.log('✅ Login success, updating user state:', user);
        
        // Actualizar el cache inmediatamente
        queryClient.setQueryData(["/api/current-user"], user);
        
        // Usar window.location para redirección más confiable
        console.log('🚀 Redirecting to dashboard after successful login');
        window.location.href = "/dashboard";
      },
      onError: (error) => {
        console.error("Error de login:", error);
        setRedirecting(false);
        loginForm.setError("root", { 
          message: error instanceof Error ? error.message : "Error al iniciar sesión" 
        });
      }
    });
  }

  // Manejar envío del formulario de registro
  function onRegisterSubmit(data: RegisterFormValues) {
    const { confirmPassword, ...userData } = data;
    registerMutation.mutate(userData, {
      onSuccess: (user) => {
        // Actualizar el estado y redirigir
        queryClient.setQueryData(["/api/current-user"], user);
        setRedirecting(true);
        setTimeout(() => {
          navigate("/dashboard");
        }, 100);
      }
    });
  }

  // Manejar envío del formulario de forgot password
  function onForgotPasswordSubmit(data: ForgotPasswordFormValues) {
    forgotPasswordMutation.mutate(data);
  }

  // Manejar envío del formulario de reset password
  function onResetPasswordSubmit(data: ResetPasswordFormValues) {
    resetPasswordMutation.mutate(data);
  }

  return (
    <div className="flex min-h-screen">
      {/* Overlay de redirección */}
      {redirecting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center space-y-4 p-6 bg-card rounded-lg shadow-lg">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-xl font-medium">Redirigiendo...</div>
            <div className="text-muted-foreground">Accediendo al Dashboard</div>
          </div>
        </div>
      )}
      
      {/* Columna izquierda - Formulario */}
      <div className="flex items-center justify-center w-full lg:w-1/2 p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-4">
              <Logo size="lg" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Mind - Epical</h1>
            <p className="text-gray-600">
              Plataforma interna para la gestión de proyectos y cotizaciones
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="register">Registrarse</TabsTrigger>
              <TabsTrigger value="forgot-password">Olvidé mi contraseña</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Iniciar Sesión</CardTitle>
                  <CardDescription>
                    Accede con tu cuenta de Epical
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Correo electrónico</FormLabel>
                            <FormControl>
                              <Input placeholder="tunombre@epicaldigital.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contraseña</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input 
                                  type={showLoginPassword ? "text" : "password"} 
                                  placeholder="••••••••" 
                                  {...field} 
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                              >
                                {showLoginPassword ? (
                                  <EyeOff className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <Eye className="h-4 w-4 text-gray-500" />
                                )}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {/* Mostrar errores generales solo cuando hay un mensaje real y NO se está redirigiendo */}
                      {loginForm.formState.errors.root?.message && !redirecting && (
                        <div className="p-3 my-2 text-sm text-white bg-destructive rounded-md">
                          {loginForm.formState.errors.root.message}
                        </div>
                      )}
                      
                      <Button 
                        type="submit" 
                        className="w-full bg-gray-900 hover:bg-gray-800" 
                        disabled={loginMutation.isPending || redirecting}
                      >
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Iniciando sesión...
                          </>
                        ) : (
                          "Iniciar Sesión"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
                <CardFooter className="flex justify-center">
                  <Button variant="link" onClick={() => setActiveTab("register")}>
                    ¿No tienes una cuenta? Regístrate
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Crear Cuenta</CardTitle>
                  <CardDescription>
                    Registra tu cuenta de equipo Epical
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nombre</FormLabel>
                              <FormControl>
                                <Input placeholder="Tu nombre" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Apellido</FormLabel>
                              <FormControl>
                                <Input placeholder="Tu apellido" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Correo electrónico</FormLabel>
                            <FormControl>
                              <Input placeholder="tunombre@epicaldigital.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contraseña</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input 
                                  type={showRegisterPassword ? "text" : "password"} 
                                  placeholder="••••••••" 
                                  {...field} 
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                              >
                                {showRegisterPassword ? (
                                  <EyeOff className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <Eye className="h-4 w-4 text-gray-500" />
                                )}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar contraseña</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input 
                                  type={showRegisterConfirmPassword ? "text" : "password"} 
                                  placeholder="••••••••" 
                                  {...field} 
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                              >
                                {showRegisterConfirmPassword ? (
                                  <EyeOff className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <Eye className="h-4 w-4 text-gray-500" />
                                )}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full bg-gray-900 hover:bg-gray-800" 
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creando cuenta...
                          </>
                        ) : (
                          "Registrarse"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
                <CardFooter className="flex justify-center">
                  <Button variant="link" onClick={() => setActiveTab("login")}>
                    ¿Ya tienes una cuenta? Inicia sesión
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="forgot-password">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {forgotPasswordStep === "email" ? "Recuperar Contraseña" : "Token Generado"}
                  </CardTitle>
                  <CardDescription>
                    {forgotPasswordStep === "email" 
                      ? "Ingresa tu correo electrónico para generar un token de recuperación"
                      : "Copia el token generado y úsalo para establecer tu nueva contraseña"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {forgotPasswordStep === "email" ? (
                    <Form {...forgotPasswordForm}>
                      <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)} className="space-y-4">
                        <FormField
                          control={forgotPasswordForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Correo electrónico</FormLabel>
                              <FormControl>
                                <Input placeholder="tunombre@epicaldigital.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="submit" 
                          className="w-full bg-gray-900 hover:bg-gray-800" 
                          disabled={forgotPasswordMutation.isPending}
                        >
                          {forgotPasswordMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Enviando solicitud...
                            </>
                          ) : (
                            "Generar token de recuperación"
                          )}
                        </Button>
                      </form>
                    </Form>
                  ) : (
                    <div className="space-y-4">
                      {resetToken && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                          <h4 className="font-semibold text-green-800 mb-2">¡Token generado exitosamente!</h4>
                          <p className="text-sm text-green-700 mb-3">
                            Tu token de recuperación se ha generado. Cópialo y úsalo en el formulario abajo:
                          </p>
                          <div className="bg-white border rounded p-3 font-mono text-sm break-all">
                            {resetToken}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              navigator.clipboard.writeText(resetToken);
                              toast({
                                title: "Copiado",
                                description: "Token copiado al portapapeles",
                              });
                            }}
                          >
                            📋 Copiar token
                          </Button>
                        </div>
                      )}
                      
                      <Form {...resetPasswordForm}>
                        <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
                          <FormField
                            control={resetPasswordForm.control}
                            name="token"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Token de recuperación</FormLabel>
                                <FormControl>
                                  <Input placeholder="Pega aquí el token generado" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={resetPasswordForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nueva contraseña</FormLabel>
                                <div className="relative">
                                  <FormControl>
                                    <Input 
                                      type={showResetPassword ? "text" : "password"} 
                                      placeholder="••••••••" 
                                      {...field} 
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowResetPassword(!showResetPassword)}
                                  >
                                    {showResetPassword ? (
                                      <EyeOff className="h-4 w-4 text-gray-500" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-gray-500" />
                                    )}
                                  </Button>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={resetPasswordForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirmar nueva contraseña</FormLabel>
                                <div className="relative">
                                  <FormControl>
                                    <Input 
                                      type={showResetConfirmPassword ? "text" : "password"} 
                                      placeholder="••••••••" 
                                      {...field} 
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                                  >
                                    {showResetConfirmPassword ? (
                                      <EyeOff className="h-4 w-4 text-gray-500" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-gray-500" />
                                    )}
                                  </Button>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button 
                            type="submit" 
                            className="w-full bg-gray-900 hover:bg-gray-800" 
                            disabled={resetPasswordMutation.isPending}
                          >
                            {resetPasswordMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Actualizando contraseña...
                              </>
                            ) : (
                              "Actualizar contraseña"
                            )}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setForgotPasswordStep("email");
                              resetPasswordForm.reset();
                            }}
                          >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver al paso anterior
                          </Button>
                        </form>
                      </Form>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-center">
                  <Button variant="link" onClick={() => setActiveTab("login")}>
                    ¿Recordaste tu contraseña? Inicia sesión
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Columna derecha - Hero section */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900">
        <div className="flex flex-col items-center justify-center w-full p-12 text-white">
          <div className="max-w-lg text-center">
            <h2 className="text-4xl font-bold mb-6">Mind - Epical</h2>
            <p className="text-xl mb-8 text-gray-300">
              Plataforma completa para el equipo de Epical que facilita la gestión de proyectos, 
              cotizaciones y seguimiento de tiempo con comunicación interna integrada.
            </p>
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg flex items-start space-x-3">
                <FileText className="h-6 w-6 text-blue-400 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-lg mb-2">Cotizaciones Inteligentes</h3>
                  <p className="text-gray-400">Crea y gestiona cotizaciones para presentar a clientes con cálculos precisos.</p>
                </div>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg flex items-start space-x-3">
                <BarChart className="h-6 w-6 text-green-400 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-lg mb-2">Gestión de Proyectos</h3>
                  <p className="text-gray-400">Coordina proyectos en curso y mantén informado a todo el equipo sobre avances.</p>
                </div>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg flex items-start space-x-3">
                <ClockIcon className="h-6 w-6 text-amber-400 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-lg mb-2">Registro de Horas</h3>
                  <p className="text-gray-400">Control de tiempo dedicado por cada integrante del equipo Epical a los proyectos.</p>
                </div>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg flex items-start space-x-3">
                <MessageSquare className="h-6 w-6 text-purple-400 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-lg mb-2">Chat Interno</h3>
                  <p className="text-gray-400">Comunícate con el equipo directamente dentro de la plataforma para coordinar tareas.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}