import multer from 'multer';
import { Request } from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

// Configurar el directorio de destino para las cargas
const uploadDir = path.join(process.cwd(), 'public/uploads');

// Asegurarse de que el directorio existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar almacenamiento para multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generar un nombre de archivo único para evitar colisiones
    const uniqueSuffix = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `logo-${uniqueSuffix}${ext}`);
  }
});

// Filtrar tipos de archivos para solo permitir imágenes
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, GIF, SVG, WEBP).'));
  }
};

// Configurar Multer con límites razonables
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  }
});

// Multer para documentos de propuestas CRM
const proposalDir = path.join(process.cwd(), 'public/uploads/proposals');
if (!fs.existsSync(proposalDir)) {
  fs.mkdirSync(proposalDir, { recursive: true });
}

const proposalStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, proposalDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `proposal-${uniqueSuffix}${ext}`);
  }
});

const proposalFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/webp',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Se aceptan PDF, Word, Excel, PowerPoint e imágenes.'));
  }
};

export const uploadDocument = multer({
  storage: proposalStorage,
  fileFilter: proposalFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Función auxiliar para eliminar un archivo antiguo
export const deleteOldFile = (filePath: string) => {
  if (!filePath) return;
  
  const fullPath = path.join(process.cwd(), filePath);
  
  // Solo eliminar si el archivo existe y está dentro del directorio uploads
  if (fs.existsSync(fullPath) && fullPath.includes('/uploads/')) {
    try {
      fs.unlinkSync(fullPath);
    } catch (error) {
      console.error('Error al eliminar archivo antiguo:', error);
    }
  }
};