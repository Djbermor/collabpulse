import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  File,
  Image as ImageIcon,
  Code,
  Search,
  CheckCircle2,
  ExternalLink,
  Plus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FileItem } from '../../types';
import { api } from '../../services/api';

export const FilesView: React.FC = () => {
  const { currentUser, addToast } = useApp();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filterType, setFilterType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    const res = await api.getFiles(filterType || undefined);
    if (res.success && res.data) {
      setFiles(res.data);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [filterType]);

  const handleUploadFile = async (file: globalThis.File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);

    const res = await api.uploadFile(formData);
    if (res.success && res.data) {
      setFiles(prev => [res.data, ...prev]);
      addToast(`Archivo "${file.name}" subido exitosamente`, 'success');
    } else {
      addToast(res.message || 'Error al subir archivo', 'error');
    }
    setIsUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUploadFile(file);
    }
  };

  const handleDeleteFile = async (id: string) => {
    await api.deleteFile(id);
    setFiles(prev => prev.filter(f => f.id !== id));
    addToast('Archivo eliminado de la organización', 'info');
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-indigo-400" />;
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-rose-400" />;
    if (type.includes('json') || type.includes('markdown') || type.includes('code'))
      return <Code className="w-5 h-5 text-emerald-400" />;
    return <File className="w-5 h-5 text-cyan-400" />;
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div
      id="files-view-container"
      className={`flex-1 flex flex-col h-full bg-slate-900/60 overflow-hidden text-xs transition-colors ${
        isDragOver ? 'bg-indigo-950/20 ring-2 ring-indigo-500/50' : ''
      }`}
      onDragOver={e => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="h-14 bg-slate-950/70 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-400" />
          <h2 className="font-bold text-slate-100 text-sm">Archivos y Documentos del Workspace</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{isUploading ? 'Subiendo...' : 'Subir Archivo'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {['', 'image', 'pdf', 'json'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                filterType === type ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {type === '' ? 'Todos' : type === 'image' ? 'Imágenes' : type === 'pdf' ? 'PDFs' : 'Código/Datos'}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
          />
        </div>
      </div>

      {/* File Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500">
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="font-semibold text-slate-300">No hay archivos en esta categoría</p>
              <p className="text-slate-500 text-[11px] mt-1">Arrastra archivos aquí o haz clic en "Subir Archivo".</p>
            </div>
          ) : (
            filteredFiles.map(file => (
              <div
                key={file.id}
                id={`file-card-${file.id}`}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 transition-all shadow-xs flex flex-col justify-between group space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                    {getFileIcon(file.fileType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-100 text-xs truncate" title={file.name}>
                      {file.name}
                    </h3>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB • Subido por {file.uploaderName}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-slate-400">
                  <span className="text-[10px] text-slate-500">
                    {new Date(file.createdAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-1">
                    {file.url ? (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded hover:bg-slate-800 hover:text-indigo-400 transition-colors"
                        title="Ver o descargar"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <button
                        onClick={() => addToast(`Descarga de ${file.name} iniciada`, 'info')}
                        className="p-1 rounded hover:bg-slate-800 hover:text-indigo-400 transition-colors cursor-pointer"
                        title="Descargar archivo"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      className="p-1 rounded hover:bg-rose-950/50 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Eliminar archivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
