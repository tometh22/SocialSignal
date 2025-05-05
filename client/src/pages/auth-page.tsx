import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

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

  // Redireccionar si el usuario ya está autenticado
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

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
  function onLoginSubmit(data: LoginFormValues) {
    loginMutation.mutate(data);
  }

  // Manejar envío del formulario de registro
  function onRegisterSubmit(data: RegisterFormValues) {
    const { confirmPassword, ...userData } = data;
    registerMutation.mutate(userData);
  }

  return (
    <div className="flex min-h-screen">
      {/* Columna izquierda - Formulario */}
      <div className="flex items-center justify-center w-full lg:w-1/2 p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sistema de Gestión Epical</h1>
            <p className="text-gray-600">
              Accede a la plataforma de gestión de proyectos y cotizaciones
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
                    Ingresa tus credenciales para acceder a tu cuenta
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
                              <Input placeholder="nombre@ejemplo.com" {...field} />
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
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={loginMutation.isPending}
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
                    Regístrate para acceder al sistema
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
                                <Input placeholder="Juan" {...field} />
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
                                <Input placeholder="Pérez" {...field} />
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
                              <Input placeholder="nombre@ejemplo.com" {...field} />
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
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
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
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full" 
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
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-r from-blue-500 to-purple-600">
        <div className="flex flex-col items-center justify-center w-full p-12 text-white">
          <div className="max-w-lg text-center">
            <h2 className="text-4xl font-bold mb-6">Sistema de Gestión de Proyectos</h2>
            <p className="text-xl mb-8">
              Una plataforma completa para gestionar tus proyectos de monitoreo social, 
              cotizaciones, y seguimiento de tiempo con análisis detallado de costos.
            </p>
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="bg-white/10 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Cotizaciones Inteligentes</h3>
                <p>Genera cotizaciones basadas en plantillas con cálculos automatizados.</p>
              </div>
              <div className="bg-white/10 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Gestión de Proyectos</h3>
                <p>Administra proyectos activos con seguimiento detallado de avances.</p>
              </div>
              <div className="bg-white/10 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Registro de Horas</h3>
                <p>Seguimiento preciso del tiempo invertido por cada miembro del equipo.</p>
              </div>
              <div className="bg-white/10 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Análisis Financiero</h3>
                <p>Visualiza el rendimiento financiero de proyectos y clientes.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}