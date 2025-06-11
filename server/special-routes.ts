import express from 'express';
import { storage } from './storage';
import { z } from 'zod';

// Crear un enrutador especial para manejar casos específicos
const specialRouter = express.Router();

// Esquema específico para actualizar tarifas en formato localizado
const updateRateSchema = z.object({
  hourlyRate: z.string().transform((val) => {
    // Convertir la cadena con coma decimal a número
    return parseFloat(val.replace(',', '.'));
  }),
  name: z.string().optional(),
  roleId: z.number().optional(),
});

// Ruta especial para actualizar la tarifa de un miembro del personal que acepta comas decimales
specialRouter.post('/personnel/:id/update-rate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID inválido" });
    }

    
    // Validar y transformar los datos incluyendo el formato con coma
    const validatedData = updateRateSchema.parse(req.body);
    
    
    // Actualizar el personal utilizando el valor numérico ya convertido
    const updatedPerson = await storage.updatePersonnel(id, validatedData);
    
    if (!updatedPerson) {
      return res.status(404).json({ message: "Miembro del personal no encontrado" });
    }
    
    res.json(updatedPerson);
  } catch (error) {
    console.error("Error al actualizar tarifa:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Datos de tarifa inválidos", 
        errors: error.errors 
      });
    }
    
    res.status(500).json({ message: "Error al actualizar la tarifa" });
  }
});

export { specialRouter };