import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, EyeOff, BarChart, ClockIcon, MessageSquare, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const { user, loginMutation, registerMutation, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [redirecting, setRedirecting] = useState<boolean>(false);

  // Redireccionar si el usuario ya está autenticado
  useEffect(() => {
    if (user) {
      console.log("Usuario autenticado detectado, redirigiendo...", user);
      setRedirecting(true);
      // Redirección inmediata
      navigate("/");
    }
  }, [user, navigate]);

  // Estados para mostrar/ocultar contraseñas
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

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

  // Manejar envío del formulario de inicio de sesión
  async function onLoginSubmit(data: LoginFormValues) {
    try {
      console.log("Iniciando login con:", data.email);
      loginForm.setError("root", { message: "" }); // Limpiar errores previos
      
      // Usar fetch directamente en lugar de loginMutation
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include"
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error en login:", errorText);
        let errorMessage = "Error al iniciar sesión";
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // Error no es JSON, usar el texto tal cual
          if (errorText) errorMessage = errorText;
        }
        
        loginForm.setError("root", { message: errorMessage });
        return;
      }
      
      // Leer y procesar la respuesta
      const responseText = await response.text();
      if (!responseText.trim()) {
        console.log("Respuesta vacía del servidor");
        throw new Error("Respuesta vacía del servidor");
      }
      
      // Parsear el JSON de la respuesta
      try {
        const user = JSON.parse(responseText);
        console.log("Login exitoso, redirigiendo...", user);
        
        // Actualizar el estado y redirigir
        queryClient.setQueryData(["/api/current-user"], user);
        setRedirecting(true);
        navigate("/");
      } catch (error) {
        console.error("Error al procesar respuesta:", error);
        loginForm.setError("root", { 
          message: "Error al procesar la respuesta del servidor" 
        });
      }
    } catch (error) {
      console.error("Error en el proceso de login:", error);
      loginForm.setError("root", { 
        message: error instanceof Error ? error.message : "Error al iniciar sesión" 
      });
    }
  }

  // Manejar envío del formulario de registro
  function onRegisterSubmit(data: RegisterFormValues) {
    const { confirmPassword, ...userData } = data;
    registerMutation.mutate(userData, {
      onSuccess: (user) => {
        console.log("Registro exitoso, redirigiendo...", user);
        // Actualizar el estado y redirigir
        queryClient.setQueryData(["/api/current-user"], user);
        setRedirecting(true);
        navigate("/");
      }
    });
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
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="register">Registrarse</TabsTrigger>
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
                      {/* Mostrar errores generales */}
                      {loginForm.formState.errors.root && (
                        <div className="p-3 my-2 text-sm text-white bg-destructive rounded-md">
                          {loginForm.formState.errors.root.message}
                        </div>
                      )}
                      
                      <Button 
                        type="submit" 
                        className="w-full bg-gray-900 hover:bg-gray-800" 
                        disabled={loginForm.formState.isSubmitting}
                      >
                        {loginForm.formState.isSubmitting ? (
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