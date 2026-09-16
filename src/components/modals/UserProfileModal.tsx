import React, { useState, useRef } from 'react';
import { X, User, Briefcase, Mail, Phone, Smile, Save, Check, Camera, Sparkles, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { AvatarCatalogModal, DEFAULT_AVATARS } from '../profile/AvatarCatalogModal';

export const UserProfileModal: React.FC = () => {
  const { isProfileOpen, setIsProfileOpen, currentUser, setCurrentUser, addToast } = useApp();

  const [firstName, setFirstName] = useState(currentUser?.firstName || '');
  const [lastName, setLastName] = useState(currentUser?.lastName || '');
  const [jobTitle, setJobTitle] = useState(currentUser?.jobTitle || '');
  const [phoneNumber, setPhoneNumber] = useState(currentUser?.phone || currentUser?.phoneNumber || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [timeZone, setTimeZone] = useState(currentUser?.timeZone || 'Europe/Madrid');
  const [customStatus, setCustomStatus] = useState(currentUser?.customStatus || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saved, setSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isProfileOpen || !currentUser) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Por favor selecciona un archivo de imagen válido', 'error');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);

      const res = await api.uploadFile(formData);
      if (res.success && res.data) {
        setAvatarUrl(res.data.url);
        addToast('Foto de perfil cargada. Haz clic en Guardar para confirmar.', 'success');
      } else {
        addToast(res.message || 'Error al subir la foto', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error al subir foto de perfil', 'error');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.updateProfile({
      firstName,
      lastName,
      jobTitle,
      phoneNumber,
      bio,
      timeZone,
      customStatus,
      avatarUrl
    });

    if (res.success && res.data) {
      setCurrentUser(res.data);
      setSaved(true);
      addToast('Perfil actualizado correctamente', 'success');
      setTimeout(() => setSaved(false), 2000);
    } else {
      addToast(res.message || 'Error al guardar perfil', 'error');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none text-xs animate-in fade-in">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950/40">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <User className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-100 text-sm">Perfil de Usuario</h3>
            </div>
            <button
              onClick={() => setIsProfileOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
            {/* Avatar and Basic Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-4 border-b border-slate-800/80 text-center sm:text-left">
              <div className="relative group shrink-0">
                <img
                  src={avatarUrl || currentUser.avatarUrl || DEFAULT_AVATARS[0].svgDataUri}
                  alt={currentUser.firstName}
                  className="w-20 h-20 rounded-2xl object-cover ring-2 ring-indigo-500/50 shadow-md bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-medium cursor-pointer"
                  title="Subir foto real"
                >
                  <Camera className="w-5 h-5 mb-0.5" />
                  <span>{uploadingAvatar ? 'Subiendo...' : 'Cambiar'}</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <div className="flex-1 min-w-0">
                <div className="font-bold text-base text-slate-100 truncate">
                  {currentUser.firstName} {currentUser.lastName}
                </div>
                <div className="text-slate-400 text-xs truncate">{currentUser.email || `@${currentUser.userName}`}</div>
                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 text-[10px] font-mono">
                  Rol: {currentUser.role}
                </div>

                {/* Avatar action buttons */}
                <div className="mt-2.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                    <span>Subir foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCatalogOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Catálogo de Avatares</span>
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(DEFAULT_AVATARS[0].svgDataUri)}
                      className="px-2 py-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] transition-colors"
                      title="Restablecer avatar predeterminado"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium text-[11px]">Nombre</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 transition-all text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium text-[11px]">Apellido</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 transition-all text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium text-[11px]">Estado personalizado</label>
              <div className="relative flex items-center">
                <Smile className="w-4 h-4 text-slate-500 absolute left-3" />
                <input
                  type="text"
                  value={customStatus}
                  onChange={e => setCustomStatus(e.target.value)}
                  placeholder="ej: 🎯 Enfocado en la entrega de Sprint"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 transition-all text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium text-[11px]">Cargo o Posición</label>
                <div className="relative flex items-center">
                  <Briefcase className="w-4 h-4 text-slate-500 absolute left-3" />
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={e => setJobTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 transition-all text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium text-[11px]">Teléfono de contacto</label>
                <div className="relative flex items-center">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3" />
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="+34 600 000 000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 transition-all text-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium text-[11px]">Zona Horaria</label>
              <select
                value={timeZone}
                onChange={e => setTimeZone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 transition-all text-xs"
              >
                <option value="Europe/Madrid">Europe/Madrid (UTC+1)</option>
                <option value="America/New_York">America/New_York (EST / UTC-5)</option>
                <option value="America/Bogota">America/Bogota (COT / UTC-5)</option>
                <option value="America/Mexico_City">America/Mexico_City (CST / UTC-6)</option>
                <option value="America/Santiago">America/Santiago (CLT / UTC-3)</option>
                <option value="America/Buenos_Aires">America/Buenos_Aires (ART / UTC-3)</option>
                <option value="UTC">UTC (Tiempo Universal)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium text-[11px]">Biografía / Acerca de mí</label>
              <textarea
                rows={2}
                value={bio}
                onChange={e => setBio(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 transition-all text-xs"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
              <span className="text-[11px] text-emerald-400 font-medium">
                {saved && '✓ Cambios guardados con éxito en PostgreSQL'}
              </span>
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ml-auto"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Perfil</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Catalog Modal */}
      <AvatarCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        onSelectAvatar={uri => {
          setAvatarUrl(uri);
          addToast('Avatar predeterminado seleccionado', 'info');
        }}
        currentAvatarUrl={avatarUrl}
      />
    </>
  );
};
