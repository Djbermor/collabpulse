import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { db } from '../db';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware';
import { sanitizeText } from '../security';

export const filesRouter = Router();

// Configure real disk storage for uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    const uniqueName = `file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${cleanBase}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB max limit
  }
});

// List files in workspace
filesRouter.get('/', authenticate, requirePermission('files.read'), (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.workspace?.id || req.user!.tenantId;
  const tenantId = req.user!.tenantId;
  const { fileType } = req.query;

  let files = db.files.filter(f => (f.workspaceId === workspaceId || f.tenantId === tenantId) && f.tenantId === tenantId);
  if (fileType) {
    files = files.filter(f => f.fileType.toLowerCase().includes((fileType as string).toLowerCase()));
  }

  res.json({ success: true, data: files });
});

// Upload real file (supports multipart/form-data with field 'file', or JSON metadata fallback)
filesRouter.post(
  '/upload',
  authenticate,
  requirePermission('files.upload'),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const tenantId = user.tenantId;
    const workspaceId = req.workspace?.id || req.body.workspaceId || 'ws-default';

    let fileName = '';
    let fileType = 'application/octet-stream';
    let fileSize = 1024;
    let fileUrl = '';

    if (req.file) {
      // Real physical file uploaded via multipart
      fileName = sanitizeText(req.file.originalname);
      fileType = req.file.mimetype || 'application/octet-stream';
      fileSize = req.file.size;
      fileUrl = `/uploads/${req.file.filename}`;
    } else {
      // JSON body fallback
      const { name, fileType: bFileType, size, url } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'El nombre del archivo o un archivo físico es requerido' });
      }
      fileName = sanitizeText(name);
      fileType = bFileType || 'application/octet-stream';
      fileSize = Number(size) || 1024;
      fileUrl = url || '/uploads/default-placeholder.png';
    }

    const newFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      workspaceId,
      name: fileName,
      fileType,
      size: fileSize,
      url: fileUrl,
      uploadedBy: user.id,
      uploaderName: user.displayName || `${user.firstName} ${user.lastName}`,
      createdAt: new Date().toISOString()
    };

    db.files.unshift(newFile);
    await db.persistFile(newFile);

    db.logAudit(
      tenantId,
      user.id,
      newFile.uploaderName,
      'FILE_UPLOADED',
      'File',
      newFile.id,
      req.ip,
      { fileName: newFile.name, size: newFile.size, url: newFile.url },
      workspaceId
    );

    res.status(201).json({ success: true, data: newFile });
  }
);

// Get single file metadata
filesRouter.get('/:id', authenticate, requirePermission('files.read'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const file = db.files.find(f => f.id === id && f.tenantId === tenantId);
  if (!file) return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
  res.json({ success: true, data: file });
});

// Download physical file
filesRouter.get('/:id/download', authenticate, requirePermission('files.read'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const file = db.files.find(f => f.id === id && f.tenantId === tenantId);
  if (!file) return res.status(404).json({ success: false, message: 'Archivo no encontrado' });

  if (file.url.startsWith('/uploads/')) {
    const filename = path.basename(file.url);
    const physicalPath = path.join(uploadsDir, filename);
    if (fs.existsSync(physicalPath)) {
      return res.download(physicalPath, file.name);
    }
  }

  // Fallback redirect if hosted remotely
  return res.redirect(file.url);
});

// Delete file
filesRouter.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const tenantId = user.tenantId;

  const idx = db.files.findIndex(f => f.id === id && f.tenantId === tenantId);
  if (idx < 0) return res.status(404).json({ success: false, message: 'Archivo no encontrado' });

  const file = db.files[idx];
  const isUploader = file.uploadedBy === user.id;
  const canDelete = isUploader || req.member?.role === 'Owner' || req.member?.role === 'Admin' || req.permissions?.includes('files.delete');

  if (!canDelete) {
    return res.status(403).json({ success: false, message: 'No tiene permiso para eliminar este archivo', code: 'FORBIDDEN' });
  }

  const removed = db.files.splice(idx, 1)[0];
  await db.deleteFile(id);

  // If stored locally, remove physical file from disk
  if (removed.url && removed.url.startsWith('/uploads/')) {
    try {
      const physicalPath = path.join(uploadsDir, path.basename(removed.url));
      if (fs.existsSync(physicalPath)) {
        fs.unlinkSync(physicalPath);
      }
    } catch (e) {
      console.warn('[Files] Could not delete physical file:', e);
    }
  }

  db.logAudit(
    tenantId,
    user.id,
    user.displayName,
    'FILE_DELETED',
    'File',
    id,
    req.ip,
    { fileName: removed.name },
    file.workspaceId
  );

  res.json({ success: true, message: 'Archivo eliminado correctamente' });
});
