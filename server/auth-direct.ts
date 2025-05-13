import { Express } from "express";
import { IStorage } from "./storage";

// Punto de entrada alternativo de autenticación con implementación simplificada
export function setupDirectAuth(app: Express, storage: IStorage) {
  // Ruta alternativa para login directo (bypass para problemas con versiones compiladas)
  app.post("/api/login-direct", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      console.log("Intento directo de inicio de sesión:", { email });
      
      // Buscar el usuario
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        console.log("Usuario no encontrado:", email);
        return res.status(401).send("Credenciales incorrectas");
      }
      
      // Acceso especial para usuarios específicos (hardcoded)
      const validUsers = [
        { email: "victoria.puricelli@epical.digital", password: "epical2025" },
        { email: "vicky@epical.digital", password: "epical2024" }
      ];
      
      const isValidUser = validUsers.some(
        (valid) => valid.email === email && valid.password === password
      );
      
      if (!isValidUser) {
        console.log("Credenciales incorrectas para:", email);
        return res.status(401).send("Credenciales incorrectas");
      }
      
      // Establecer la sesión
      req.session.userId = user.id;
      console.log("Sesión establecida con ID:", user.id);
      
      // Retornar información básica del usuario
      const safeUser = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAdmin: user.isAdmin
      };
      
      // Enviar como texto plano para evitar problemas de análisis
      return res.status(200).send(`
        <html>
          <body>
            <script>
              window.localStorage.setItem('userToken', '${user.id}');
              window.localStorage.setItem('userData', '${JSON.stringify(safeUser).replace(/'/g, "\\'")}');
              window.location.href = '/';
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error en login directo:", error);
      res.status(500).send("Error interno del servidor");
    }
  });
}