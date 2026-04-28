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

// Multer para facturas mensuales personales
const invoicesDir = path.join(process.cwd(), 'public/uploads/invoices');
if (!fs.existsSync(invoicesDir)) {
  fs.mkdirSync(invoicesDir, { recursive: true });
}

const invoiceStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Subcarpeta por usuario
    const userId = (req as any).user?.id ?? 'anon';
    const userDir = path.join(invoicesDir, String(userId));
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: function (req, file, cb) {
    const period = (req.body?.period ?? 'unknown').replace(/[^0-9-]/g, '');
    const uniqueSuffix = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${period}-${uniqueSuffix}${ext}`);
  },
});

const invoiceFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Se aceptan PDF e imágenes (JPG/PNG/WEBP).'));
  }
};

export const uploadInvoice = multer({
  storage: invoiceStorage,
  fileFilter: invoiceFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Multer para attachments de propuestas de posteos en status review
const postProposalDir = path.join(process.cwd(), 'public/uploads/post-proposals');
if (!fs.existsSync(postProposalDir)) {
  fs.mkdirSync(postProposalDir, { recursive: true });
}

const postProposalStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, postProposalDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `pp-${uniqueSuffix}${ext}`);
  },
});

const postProposalFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'video/mp4', 'video/quicktime', 'video/webm',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Se aceptan imágenes, PDF y videos cortos (MP4/MOV/WEBM).'));
  }
};

export const uploadPostProposal = multer({
  storage: postProposalStorage,
  fileFilter: postProposalFileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
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