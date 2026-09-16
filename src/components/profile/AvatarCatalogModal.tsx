import React, { useState } from 'react';
import { X, Check, Building, HeartPulse, User, Sparkles } from 'lucide-react';

export interface DefaultAvatar {
  id: string;
  name: string;
  category: 'corporate' | 'healthcare';
  role: string;
  svgDataUri: string;
}

// Generate inline SVG Data URI for crisp, copyright-free corporate and healthcare avatars
const createSvgAvatar = (bgGradient: [string, string], iconChar: string, label: string, accentColor: string): string => {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="g_${label}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGradient[0]}" />
      <stop offset="100%" stop-color="${bgGradient[1]}" />
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="48" fill="url(#g_${label})" stroke="${accentColor}" stroke-width="2.5" />
  <!-- Silhouette head & shoulders -->
  <circle cx="50" cy="38" r="18" fill="#ffffff" opacity="0.92" />
  <path d="M 22 84 C 22 62, 78 62, 78 84 Z" fill="#ffffff" opacity="0.92" />
  <!-- Role badge -->
  <circle cx="72" cy="72" r="14" fill="${accentColor}" stroke="#0f172a" stroke-width="2" />
  <text x="72" y="77" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">${iconChar}</text>
</svg>`.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const DEFAULT_AVATARS: DefaultAvatar[] = [
  // A. EMPRESA / CORPORATIVO
  {
    id: 'corp-director',
    name: 'Dirección General',
    category: 'corporate',
    role: 'Dirección',
    svgDataUri: createSvgAvatar(['#4f46e5', '#312e81'], '★', 'director', '#f59e0b')
  },
  {
    id: 'corp-gerente',
    name: 'Gerencia de Operaciones',
    category: 'corporate',
    role: 'Gerencia',
    svgDataUri: createSvgAvatar(['#2563eb', '#1e3a8a'], 'G', 'gerente', '#38bdf8')
  },
  {
    id: 'corp-admin',
    name: 'Administración',
    category: 'corporate',
    role: 'Administración',
    svgDataUri: createSvgAvatar(['#0891b2', '#164e63'], 'A', 'admin', '#22d3ee')
  },
  {
    id: 'corp-rrhh',
    name: 'Recursos Humanos',
    category: 'corporate',
    role: 'Recursos Humanos',
    svgDataUri: createSvgAvatar(['#db2777', '#831843'], '♥', 'rrhh', '#f472b6')
  },
  {
    id: 'corp-finanzas',
    name: 'Finanzas y Contabilidad',
    category: 'corporate',
    role: 'Finanzas',
    svgDataUri: createSvgAvatar(['#059669', '#064e3b'], '$', 'finanzas', '#34d399')
  },
  {
    id: 'corp-tech',
    name: 'Líder de Tecnología',
    category: 'corporate',
    role: 'Tecnología',
    svgDataUri: createSvgAvatar(['#7c3aed', '#4c1d95'], 'T', 'tech', '#a78bfa')
  },
  {
    id: 'corp-dev',
    name: 'Ingeniería y Desarrollo',
    category: 'corporate',
    role: 'Desarrollador',
    svgDataUri: createSvgAvatar(['#0284c7', '#0c4a6e'], '</>', 'dev', '#67e8f9')
  },
  {
    id: 'corp-ventas',
    name: 'Ventas y Comercial',
    category: 'corporate',
    role: 'Ventas',
    svgDataUri: createSvgAvatar(['#d97706', '#78350f'], '%', 'ventas', '#fbbf24')
  },
  {
    id: 'corp-marketing',
    name: 'Marketing y Comunicación',
    category: 'corporate',
    role: 'Marketing',
    svgDataUri: createSvgAvatar(['#ea580c', '#7c2d12'], 'M', 'marketing', '#fb923c')
  },
  {
    id: 'corp-soporte',
    name: 'Soporte y Atención al Cliente',
    category: 'corporate',
    role: 'Soporte',
    svgDataUri: createSvgAvatar(['#0d9488', '#134e4a'], '?', 'soporte', '#2dd4bf')
  },
  {
    id: 'corp-analista',
    name: 'Analista de Datos / Negocio',
    category: 'corporate',
    role: 'Analista',
    svgDataUri: createSvgAvatar(['#6366f1', '#3730a3'], '📊', 'analista', '#818cf8')
  },
  {
    id: 'corp-consultor',
    name: 'Consultoría y Estrategia',
    category: 'corporate',
    role: 'Consultor',
    svgDataUri: createSvgAvatar(['#475569', '#0f172a'], 'C', 'consultor', '#94a3b8')
  },

  // B. SALUD / HOSPITAL
  {
    id: 'health-medico',
    name: 'Médico General / Especialista',
    category: 'healthcare',
    role: 'Médico',
    svgDataUri: createSvgAvatar(['#0284c7', '#0369a1'], '✚', 'medico', '#38bdf8')
  },
  {
    id: 'health-enfermeria',
    name: 'Enfermería y Cuidados',
    category: 'healthcare',
    role: 'Enfermería',
    svgDataUri: createSvgAvatar(['#0d9488', '#0f766e'], '✚', 'enfermeria', '#2dd4bf')
  },
  {
    id: 'health-cirugia',
    name: 'Cirugía y Quirófano',
    category: 'healthcare',
    role: 'Cirugía',
    svgDataUri: createSvgAvatar(['#4338ca', '#312e81'], '⚡', 'cirugia', '#818cf8')
  },
  {
    id: 'health-laboratorio',
    name: 'Laboratorio y Análisis',
    category: 'healthcare',
    role: 'Laboratorio',
    svgDataUri: createSvgAvatar(['#059669', '#047857'], '🔬', 'laboratorio', '#34d399')
  },
  {
    id: 'health-farmacia',
    name: 'Farmacia Hospitalaria',
    category: 'healthcare',
    role: 'Farmacia',
    svgDataUri: createSvgAvatar(['#ca8a04', '#854d0e'], 'Rx', 'farmacia', '#facc15')
  },
  {
    id: 'health-admin',
    name: 'Administración Hospitalaria',
    category: 'healthcare',
    role: 'Administración',
    svgDataUri: createSvgAvatar(['#3b82f6', '#1d4ed8'], 'H', 'hospadmin', '#60a5fa')
  },
  {
    id: 'health-recepcion',
    name: 'Recepción y Admisión',
    category: 'healthcare',
    role: 'Recepción',
    svgDataUri: createSvgAvatar(['#e11d48', '#9f1239'], 'i', 'recepcion', '#fb7185')
  },
  {
    id: 'health-urgencias',
    name: 'Urgencias y Emergencias',
    category: 'healthcare',
    role: 'Emergencias',
    svgDataUri: createSvgAvatar(['#dc2626', '#991b1b'], '!', 'urgencias', '#f87171')
  },
  {
    id: 'health-clinico',
    name: 'Personal Clínico Auxiliar',
    category: 'healthcare',
    role: 'Personal Clínico',
    svgDataUri: createSvgAvatar(['#14b8a6', '#0f766e'], '♥', 'clinico', '#5eead4')
  }
];

interface AvatarCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAvatar: (avatarUri: string) => void;
  currentAvatarUrl?: string;
}

export const AvatarCatalogModal: React.FC<AvatarCatalogModalProps> = ({
  isOpen,
  onClose,
  onSelectAvatar,
  currentAvatarUrl
}) => {
  const [activeTab, setActiveTab] = useState<'corporate' | 'healthcare'>('corporate');

  if (!isOpen) return null;

  const filteredAvatars = DEFAULT_AVATARS.filter(a => a.category === activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Catálogo de Avatares Predeterminados</h2>
              <p className="text-xs text-slate-400">Selecciona un avatar corporativo o del sector salud para tu perfil</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Family Tabs */}
        <div className="px-6 pt-4 border-b border-slate-800/60 flex items-center gap-2 shrink-0 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('corporate')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'corporate'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Empresa y Corporativo</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {DEFAULT_AVATARS.filter(a => a.category === 'corporate').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('healthcare')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'healthcare'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <HeartPulse className="w-4 h-4" />
            <span>Salud y Hospitalario</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {DEFAULT_AVATARS.filter(a => a.category === 'healthcare').length}
            </span>
          </button>
        </div>

        {/* Avatar Grid */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredAvatars.map(av => {
            const isSelected = currentAvatarUrl === av.svgDataUri;
            return (
              <button
                key={av.id}
                onClick={() => {
                  onSelectAvatar(av.svgDataUri);
                  onClose();
                }}
                className={`p-3.5 rounded-2xl border transition-all text-center flex flex-col items-center gap-2.5 relative group cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-950/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-md">
                    <Check className="w-3 h-3" />
                  </div>
                )}
                <img
                  src={av.svgDataUri}
                  alt={av.name}
                  className="w-16 h-16 rounded-full shadow-md transition-transform group-hover:scale-105"
                />
                <div className="min-w-0 w-full">
                  <div className="text-xs font-bold text-slate-200 truncate">{av.name}</div>
                  <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{av.role}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
