import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  FileText,
  Activity,
  Check,
  Building,
  Key,
  Database,
  Lock,
  Search,
  RefreshCw,
  Sliders,
  UserPlus,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Mail,
  User,
  Briefcase,
  UserCheck,
  UserX,
  MessageSquare,
  Hash,
  CheckSquare,
  Calendar,
  Phone,
  Video,
  Bookmark,
  Bell,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AuditLog, UserRole, FeaturePermissions } from '../../types';
import { api } from '../../services/api';

const featureDefinitions: {
  key: keyof FeaturePermissions;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'core' | 'extended';
}[] = [
  {
    key: 'messaging',
    name: 'Mensajería',
    description: 'Conversaciones directas 1 a 1 y mensajería en tiempo real.',
    icon: MessageSquare,
    category: 'core'
  },
  {
    key: 'channels',
    name: 'Canales',
    description: 'Creación, consulta y mensajería en canales públicos y privados.',
    icon: Hash,
    category: 'core'
  },
  {
    key: 'groups',
    name: 'Grupos',
    description: 'Creación, asignación de miembros y mensajería de grupos colaborativos.',
    icon: Users,
    category: 'core'
  },
  {
    key: 'tasks',
    name: 'Tablero de Tareas',
    description: 'Tablero Kanban corporativo, asignaciones y estados de trabajo.',
    icon: CheckSquare,
    category: 'extended'
  },
  {
    key: 'calendar',
    name: 'Calendario',
    description: 'Eventos corporativos, agendamiento y visualización de reuniones.',
    icon: Calendar,
    category: 'extended'
  },
  {
    key: 'calls',
    name: 'Llamadas',
    description: 'Llamadas de voz 1 a 1 y señalización SSE en tiempo real.',
    icon: Phone,
    category: 'extended'
  },
  {
    key: 'videoCalls',
    name: 'Videollamadas',
    description: 'Videollamadas HD, salas WebRTC/LiveKit SFU y pantalla compartida.',
    icon: Video,
    category: 'extended'
  },
  {
    key: 'files',
    name: 'Archivos & Adjuntos',
    description: 'Gestor documental empresarial y almacenamiento central de archivos.',
    icon: FileText,
    category: 'extended'
  },
  {
    key: 'saved',
    name: 'Guardados',
    description: 'Marcado rápido de mensajes y notas importantes para consulta rápida.',
    icon: Bookmark,
    category: 'extended'
  },
  {
    key: 'activity',
    name: 'Actividad',
    description: 'Centro de notificaciones y registro cronológico de actividad de equipo.',
    icon: Bell,
    category: 'extended'
  }
];

export const AdminView: React.FC = () => {
  const { currentTenant, currentWorkspace, currentUser, addToast, features, updateFeaturePermissions } = useApp();
  const [activeTab, setActiveTab] = useState<'permissions' | 'organizations' | 'users' | 'pending' | 'stats' | 'audit' | 'settings'>('permissions');
  const [updatingFeature, setUpdatingFeature] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditFilter, setAuditFilter] = useState('');
  const [wsName, setWsName] = useState(currentWorkspace?.name || '');
  const [wsDesc, setWsDesc] = useState(currentWorkspace?.description || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Modals for CRUD
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);

  // Organizations Modals & Form
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgDomain, setNewOrgDomain] = useState('');
  const [newOrgIndustry, setNewOrgIndustry] = useState('Tecnología / Salud');
  const [assigningUserOrg, setAssigningUserOrg] = useState<any | null>(null);
  const [targetOrgIdToAssign, setTargetOrgIdToAssign] = useState('');
  const [targetOrgRoleToAssign, setTargetOrgRoleToAssign] = useState('Member');
  const [viewingOrgMembers, setViewingOrgMembers] = useState<any | null>(null);
  const [orgMembersList, setOrgMembersList] = useState<any[]>([]);

  // Form states for user creation
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Member');
  const [newPassword, setNewPassword] = useState('');
  const [newUserAccountStatus, setNewUserAccountStatus] = useState<'ACTIVE' | 'PENDING_ACTIVATION'>('ACTIVE');
  const [newUserOrgId, setNewUserOrgId] = useState('');

  // Form states for editing
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Member');
  const [editStatus, setEditStatus] = useState<'Active' | 'Suspended' | 'Inactive'>('Active');

  const handleToggleFeature = async (key: keyof FeaturePermissions, label: string) => {
    const nextVal = !features[key];
    setUpdatingFeature(key);
    try {
      const ok = await updateFeaturePermissions({ [key]: nextVal });
      if (ok) {
        addToast(`Funcionalidad "${label}" ${nextVal ? 'habilitada' : 'deshabilitada'}`, 'success');
      } else {
        addToast(`No se pudo actualizar el permiso de "${label}"`, 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error al guardar permiso', 'error');
    } finally {
      setUpdatingFeature(null);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, usersRes, auditRes, orgsRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAuditLogs({ action: auditFilter || undefined }),
        api.getOrganizations(true)
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data);
      }
      if (orgsRes.success && orgsRes.data) {
        setOrganizations(orgsRes.data);
      }
      if (auditRes.success) setAuditLogs(auditRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [auditFilter]);

  const handleRoleChange = async (userId: string, targetRole: string) => {
    const res = await api.updateUserRole(userId, targetRole);
    if (res.success) {
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: targetRole } : u)));
      addToast(`Rol actualizado a ${targetRole}`, 'success');
      loadData();
    } else {
      addToast(res.message || 'Error al actualizar el rol', 'error');
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    const upper = newStatus.toUpperCase();
    const resolved = ['ACTIVE', 'INACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED'].includes(upper) ? upper : newStatus;
    const res = await api.adminUpdateUserStatus(userId, resolved as any);
    if (res.success) {
      addToast(`Estado de cuenta actualizado a ${resolved}`, 'success');
      loadData();
    } else {
      addToast(res.message || 'Error al actualizar el estado', 'error');
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      addToast('El nombre de la organización es requerido', 'error');
      return;
    }
    try {
      const res = await api.createOrganization({
        name: newOrgName.trim(),
        slug: newOrgSlug.trim() || undefined,
        primaryDomain: newOrgDomain.trim() || undefined,
        industry: newOrgIndustry.trim() || 'Tecnología / Salud'
      });
      if (res.success) {
        addToast(`Organización "${newOrgName}" creada exitosamente`, 'success');
        setIsCreateOrgModalOpen(false);
        setNewOrgName('');
        setNewOrgSlug('');
        setNewOrgDomain('');
        loadData();
      } else {
        addToast(res.message || 'Error creando organización', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error al crear organización', 'error');
    }
  };

  const handleToggleOrgStatus = async (org: any) => {
    const isCurrentlyActive = (org.status || '').toUpperCase() === 'ACTIVE' || org.status === 'Active';
    try {
      const res = isCurrentlyActive
        ? await api.deactivateOrganization(org.id)
        : await api.activateOrganization(org.id);

      if (res.success) {
        addToast(
          isCurrentlyActive ? `Organización "${org.name}" desactivada` : `Organización "${org.name}" activada`,
          'success'
        );
        loadData();
      } else {
        addToast(res.message || 'Error actualizando estado de organización', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error al actualizar organización', 'error');
    }
  };

  const handleAssignUserOrg = async () => {
    if (!assigningUserOrg || !targetOrgIdToAssign) return;
    try {
      const res = await api.adminAssignUserOrganization(assigningUserOrg.id, targetOrgIdToAssign, targetOrgRoleToAssign);
      if (res.success) {
        addToast('Colaborador asignado a la organización exitosamente', 'success');
        setAssigningUserOrg(null);
        setTargetOrgIdToAssign('');
        loadData();
      } else {
        addToast(res.message || 'Error asignando organización', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error al asignar organización', 'error');
    }
  };

  const handleRemoveUserOrg = async (userId: string, orgId: string) => {
    try {
      const res = await api.adminRemoveUserOrganization(userId, orgId);
      if (res.success) {
        addToast('Colaborador desvinculado de la organización', 'success');
        loadData();
      } else {
        addToast(res.message || 'Error desvinculando de la organización', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error al desvincular organización', 'error');
    }
  };

  const handleViewOrgMembers = async (org: any) => {
    setViewingOrgMembers(org);
    try {
      const res = await api.getOrganizationMembers(org.id);
      if (res.success && res.data) {
        setOrgMembersList(res.data);
      } else {
        setOrgMembersList([]);
      }
    } catch (err) {
      setOrgMembersList([]);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newFirstName.trim() || !newLastName.trim()) {
      addToast('Por favor complete los campos obligatorios', 'warning');
      return;
    }

    try {
      const res = await api.adminCreateUser({
        email: newEmail.trim(),
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        jobTitle: newJobTitle.trim() || 'Colaborador',
        role: newRole,
        password: newPassword.trim() || undefined,
        accountStatus: newUserAccountStatus,
        organizationId: newUserOrgId || undefined
      } as any);

      if (res.success) {
        addToast(`Colaborador ${newFirstName} ${newLastName} registrado exitosamente (${newUserAccountStatus})`, 'success');
        setIsCreateModalOpen(false);
        setNewFirstName('');
        setNewLastName('');
        setNewEmail('');
        setNewJobTitle('');
        setNewRole('Member');
        setNewPassword('');
        setNewUserAccountStatus('ACTIVE');
        setNewUserOrgId('');
        loadData();
      } else {
        addToast(res.message || 'Error al crear usuario', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error de conexión', 'error');
    }
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditFirstName(user.firstName || '');
    setEditLastName(user.lastName || '');
    setEditJobTitle(user.jobTitle || '');
    setEditRole(user.role || 'Member');
    setEditStatus(user.accountStatus || (user.isActive ? 'Active' : 'Inactive'));
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const res = await api.adminUpdateUser(editingUser.id, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        jobTitle: editJobTitle.trim(),
        role: editRole,
        accountStatus: editStatus
      });

      if (res.success) {
        addToast('Usuario actualizado correctamente', 'success');
        setEditingUser(null);
        loadData();
      } else {
        addToast(res.message || 'Error al actualizar usuario', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error de conexión', 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    if (currentUser?.id === deletingUser.id) {
      addToast('No puedes eliminar tu propia cuenta de administrador', 'warning');
      setDeletingUser(null);
      return;
    }

    try {
      const res = await api.adminDeleteUser(deletingUser.id);
      if (res.success) {
        addToast(`Usuario ${deletingUser.firstName || ''} ${deletingUser.lastName || ''} eliminado`, 'success');
        setUsers(prev => prev.filter(u => u.id !== deletingUser.id));
        setDeletingUser(null);
        loadData();
      } else {
        addToast(res.message || 'Error al eliminar usuario', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error de conexión', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.updateWorkspaceSettings({
      name: wsName,
      description: wsDesc
    });
    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      addToast('Configuración del workspace guardada', 'success');
      loadData();
    } else {
      addToast(res.message || 'Error al guardar configuración', 'error');
    }
  };

  const availableRoles: UserRole[] = ['Owner', 'Admin', 'Member', 'Guest'];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900/60 overflow-hidden text-xs relative">
      {/* Header */}
      <div className="h-14 bg-slate-950/70 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-slate-100 text-sm">Administración y Gobernanza del Tenant</h2>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'permissions' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Permisos de funcionalidades</span>
          </button>
          <button
            onClick={() => setActiveTab('organizations')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'organizations' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Organizaciones ({organizations.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Colaboradores ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pending' ? 'bg-amber-600 text-white' : 'text-amber-400/90 hover:text-amber-300'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Pendientes ({users.filter(u => (u.accountStatus || '').toUpperCase() === 'PENDING_ACTIVATION').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'stats' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Métricas
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Auditoría
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'settings' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Workspace
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Tab: Organizations */}
        {activeTab === 'organizations' && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="font-bold text-slate-200 text-sm">Organizaciones de la Entidad ({organizations.length})</h3>
                <p className="text-slate-400 text-[11px]">Gestión multi-organizacional, dominios asociados y estado operativo</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadData}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1.5 cursor-pointer"
                  title="Actualizar lista"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Refrescar</span>
                </button>
                <button
                  onClick={() => setIsCreateOrgModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/30"
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Nueva Organización</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold text-[11px]">
                    <th className="p-3">Organización</th>
                    <th className="p-3">Dominio Principal</th>
                    <th className="p-3">Sector / Industria</th>
                    <th className="p-3">Miembros Activos</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {organizations.map(org => {
                    const isOrgActive = (org.status || '').toUpperCase() === 'ACTIVE' || org.status === 'Active';
                    return (
                      <tr key={org.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center font-bold text-indigo-300 text-xs shrink-0">
                            {org.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                              <span>{org.name}</span>
                              {org.id === currentTenant?.id && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">Actual</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{org.slug} • {org.id}</div>
                          </div>
                        </td>
                        <td className="p-3 text-slate-300 font-mono text-[11px]">
                          {org.primaryDomain || 'N/A'}
                        </td>
                        <td className="p-3 text-slate-300">
                          {org.industry || 'Tecnología'}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-950/60 border border-indigo-800 text-indigo-300">
                            <Users className="w-3 h-3" />
                            {org.memberCount ?? org.activeMemberCount ?? 0} miembros
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isOrgActive
                                ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-400'
                                : 'bg-slate-900 border border-slate-700 text-rose-400'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isOrgActive ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                            {isOrgActive ? 'ACTIVA' : 'INACTIVA'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleViewOrgMembers(org)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                              title="Ver miembros"
                            >
                              Ver miembros
                            </button>
                            <button
                              onClick={() => handleToggleOrgStatus(org)}
                              className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                                isOrgActive
                                  ? 'bg-rose-950/60 border border-rose-800 text-rose-300 hover:bg-rose-900/80'
                                  : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300 hover:bg-emerald-900/80'
                              }`}
                            >
                              {isOrgActive ? 'Desactivar' : 'Reactivar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Pending Activation */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="font-bold text-amber-400 text-sm flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Solicitudes Pendientes de Activación ({users.filter(u => (u.accountStatus || '').toUpperCase() === 'PENDING_ACTIVATION').length})
                </h3>
                <p className="text-slate-400 text-[11px]">Colaboradores registrados que requieren aprobación administrativa para iniciar sesión</p>
              </div>

              <button
                onClick={loadData}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refrescar</span>
              </button>
            </div>

            {users.filter(u => (u.accountStatus || '').toUpperCase() === 'PENDING_ACTIVATION').length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-950 text-slate-400">
                <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="font-semibold text-slate-200">No hay cuentas pendientes de activación</p>
                <p className="text-[11px] text-slate-500 mt-1">Todas las solicitudes de registro han sido procesadas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold text-[11px]">
                      <th className="p-3">Colaborador</th>
                      <th className="p-3">Cargo</th>
                      <th className="p-3">Organizaciones Asignadas</th>
                      <th className="p-3">Fecha Registro</th>
                      <th className="p-3 text-right">Acción de Aprobación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {users
                      .filter(u => (u.accountStatus || '').toUpperCase() === 'PENDING_ACTIVATION')
                      .map(u => (
                        <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-3 flex items-center gap-2.5">
                            <img
                              src={u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-800"
                            />
                            <div>
                              <div className="font-semibold text-slate-100">{u.firstName} {u.lastName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                            </div>
                          </td>
                          <td className="p-3 text-slate-300">{u.jobTitle || 'Colaborador'}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap items-center gap-1">
                              {u.organizations && u.organizations.length > 0 ? (
                                u.organizations.map((org: any) => (
                                  <span key={org.id} className="px-2 py-0.5 rounded text-[10px] bg-indigo-950/80 border border-indigo-800 text-indigo-300">
                                    {org.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-500 italic text-[11px]">Sin organización</span>
                              )}
                              <button
                                onClick={() => setAssigningUserOrg(u)}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                                title="Asignar organización"
                              >
                                + Org
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleStatusChange(u.id, 'ACTIVE')}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/30 cursor-pointer flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Aprobar y Activar</span>
                              </button>
                              <button
                                onClick={() => handleStatusChange(u.id, 'INACTIVE')}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:border-rose-800 text-slate-400 hover:text-rose-300 border border-slate-700 text-xs cursor-pointer"
                              >
                                Rechazar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Stats */}
        {activeTab === 'stats' && (
          <div className="space-y-6 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-sm">
                <div className="text-slate-400 font-medium text-xs">Total Usuarios</div>
                <div className="text-2xl font-bold text-slate-100 mt-1">{stats?.totalUsers ?? users.length}</div>
                <div className="text-[11px] text-slate-500 mt-1">Con acceso al tenant actual</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-sm">
                <div className="text-slate-400 font-medium text-xs">Canales Activos</div>
                <div className="text-2xl font-bold text-indigo-400 mt-1">{stats?.totalChannels ?? '...'}</div>
                <div className="text-[11px] text-slate-500 mt-1">Públicos y Privados con aislamiento</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-sm">
                <div className="text-slate-400 font-medium text-xs">Mensajes Procesados</div>
                <div className="text-2xl font-bold text-cyan-400 mt-1">{stats?.totalMessages ?? '...'}</div>
                <div className="text-[11px] text-slate-500 mt-1">Indexados en tiempo real con SignalR</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-sm">
                <div className="text-slate-400 font-medium text-xs">Tareas del Sprint</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  {stats?.completedTasks ?? 0} / {stats?.totalTasks ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {stats?.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}% completadas
                </div>
              </div>
            </div>

            {/* Architecture Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/30 to-slate-950 border border-indigo-500/20 space-y-3">
              <div className="flex items-center gap-2 font-bold text-indigo-300 text-sm">
                <Database className="w-4 h-4 text-indigo-400" />
                <span>Arquitectura Multi-Organizacional y Gobernanza Nexora</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-xs">
                Nexora implementa un modelo empresarial multi-organizacional con aislamiento de datos,
                relaciones N:M de colaboradores mediante membresías y búsqueda federada en el directorio global.
                La política corporativa estricta prohíbe el borrado físico (Zero Hard Delete).
              </p>
            </div>
          </div>
        )}

        {/* Tab: Users & RBAC */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="font-bold text-slate-200 text-sm">Gestión de Colaboradores y RBAC ({users.length})</h3>
                <p className="text-slate-400 text-[11px]">Control de acceso basado en roles, organizaciones y ciclo de vida</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadData}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1.5 cursor-pointer"
                  title="Actualizar lista"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Refrescar</span>
                </button>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/30"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Nuevo Colaborador</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold text-[11px]">
                    <th className="p-3">Colaborador</th>
                    <th className="p-3">Organizaciones</th>
                    <th className="p-3">Presencia</th>
                    <th className="p-3">Estado Cuenta</th>
                    <th className="p-3">Rol RBAC</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map(u => {
                    const upperStatus = (u.accountStatus || (u.isActive ? 'ACTIVE' : 'INACTIVE')).toUpperCase();
                    return (
                      <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 flex items-center gap-2.5">
                          <img
                            src={u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-800"
                          />
                          <div>
                            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                              <span>{u.firstName} {u.lastName}</span>
                              {currentUser?.id === u.id && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">Tú</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {u.organizations && u.organizations.length > 0 ? (
                              u.organizations.map((org: any) => (
                                <span
                                  key={org.id}
                                  className="px-2 py-0.5 rounded text-[10px] bg-indigo-950/80 border border-indigo-800 text-indigo-300 flex items-center gap-1"
                                >
                                  {org.name}
                                  <button
                                    onClick={() => handleRemoveUserOrg(u.id, org.id)}
                                    className="text-indigo-400 hover:text-rose-400 cursor-pointer ml-0.5"
                                    title="Desvincular de organización"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Sin organización</span>
                            )}
                            <button
                              onClick={() => setAssigningUserOrg(u)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                              title="Asignar organización"
                            >
                              + Org
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-900 text-slate-300 border border-slate-800">
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Online' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                            {u.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              upperStatus === 'ACTIVE'
                                ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-400'
                                : upperStatus === 'PENDING_ACTIVATION'
                                ? 'bg-amber-950/60 border border-amber-800 text-amber-400'
                                : 'bg-slate-900 border border-slate-700 text-rose-400'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                upperStatus === 'ACTIVE'
                                  ? 'bg-emerald-400'
                                  : upperStatus === 'PENDING_ACTIVATION'
                                  ? 'bg-amber-400'
                                  : 'bg-rose-500'
                              }`}
                            />
                            {upperStatus === 'ACTIVE' ? 'ACTIVO' : upperStatus === 'PENDING_ACTIVATION' ? 'PENDIENTE' : 'INACTIVO'}
                          </span>
                        </td>
                        <td className="p-3">
                          <select
                            value={u.role}
                            onChange={e => handleRoleChange(u.id, e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                          >
                            {availableRoles.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {upperStatus === 'PENDING_ACTIVATION' && (
                              <button
                                onClick={() => handleStatusChange(u.id, 'ACTIVE')}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-sm cursor-pointer"
                                title="Aprobar y activar usuario"
                              >
                                Aprobar
                              </button>
                            )}
                            {upperStatus === 'ACTIVE' && currentUser?.id !== u.id && (
                              <button
                                onClick={() => handleStatusChange(u.id, 'INACTIVE')}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 text-[11px] cursor-pointer"
                                title="Desactivar usuario"
                              >
                                Desactivar
                              </button>
                            )}
                            {upperStatus === 'INACTIVE' && (
                              <button
                                onClick={() => handleStatusChange(u.id, 'ACTIVE')}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-emerald-950/60 text-slate-400 hover:text-emerald-400 text-[11px] cursor-pointer"
                                title="Reactivar usuario"
                              >
                                Reactivar
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Editar usuario"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {currentUser?.id !== u.id && (
                              <button
                                onClick={() => setDeletingUser(u)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Dar de baja usuario"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Audit Logs */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-slate-200 text-sm">Registro Estructurado de Auditoría</h3>
              <select
                value={auditFilter}
                onChange={e => setAuditFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:outline-none"
              >
                <option value="">Todas las acciones</option>
                <option value="USER_CREATED">USER_CREATED</option>
                <option value="USER_UPDATED">USER_UPDATED</option>
                <option value="USER_DELETED">USER_DELETED</option>
                <option value="USER_STATUS_UPDATED">USER_STATUS_UPDATED</option>
                <option value="CHANNEL_CREATED">CHANNEL_CREATED</option>
                <option value="ROLE_CHANGED">ROLE_CHANGED</option>
                <option value="LOGIN">LOGIN</option>
                <option value="TASK_CREATED">TASK_CREATED</option>
                <option value="MEETING_STARTED">MEETING_STARTED</option>
                <option value="FILE_UPLOADED">FILE_UPLOADED</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold text-[11px]">
                    <th className="p-3">Acción</th>
                    <th className="p-3">Entidad</th>
                    <th className="p-3">Usuario</th>
                    <th className="p-3">Dirección IP</th>
                    <th className="p-3">Fecha y Hora</th>
                    <th className="p-3">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500 font-sans">
                        No hay registros para este filtro.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-900/40">
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-800/50 font-bold text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{log.entity}</td>
                        <td className="p-3 text-slate-200 font-sans font-medium">{log.userName}</td>
                        <td className="p-3 text-slate-400">{log.ipAddress}</td>
                        <td className="p-3 text-slate-500 font-sans">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 text-slate-400 font-sans max-w-xs truncate">
                          {log.metadata ? JSON.stringify(log.metadata) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Settings */}
        {activeTab === 'settings' && (
          <div className="max-w-xl space-y-6">
            <h3 className="font-bold text-slate-100 text-sm">Configuración de Organización y Workspace</h3>

            <form onSubmit={handleSaveSettings} className="space-y-4 p-5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Nombre del Workspace</label>
                <input
                  type="text"
                  value={wsName}
                  onChange={e => setWsName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Descripción</label>
                <textarea
                  rows={2}
                  value={wsDesc}
                  onChange={e => setWsDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-emerald-400">
                  {saveSuccess && '✓ Configuración actualizada y registrada en auditoría'}
                </span>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab: Permisos de funcionalidades */}
        {activeTab === 'permissions' && (
          <div className="max-w-4xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-slate-100 text-sm">Permisos de funcionalidades</h3>
                </div>
                <p className="text-slate-400 mt-1 text-xs">
                  Gestiona el acceso y disponibilidad de módulos para todos los usuarios de la organización.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[11px] text-slate-400">Tenant:</span>
                <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/40 text-indigo-300 font-semibold">
                  {currentTenant?.id || currentUser?.tenantId}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Módulos del Sistema ({featureDefinitions.length})
                </span>
                <span className="text-[11px] text-slate-500">
                  Los cambios se aplican y sincronizan en tiempo real
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {featureDefinitions.map(f => {
                  const Icon = f.icon;
                  const isEnabled = !!features[f.key];
                  const isUpdating = updatingFeature === f.key;

                  return (
                    <div
                      key={f.key}
                      id={`feature-card-${f.key}`}
                      className={`p-4 rounded-xl border transition-all duration-150 flex items-center justify-between gap-4 ${
                        isEnabled
                          ? 'bg-slate-950/70 border-slate-800/90 shadow-xs'
                          : 'bg-slate-950/40 border-slate-800/40 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                            isEnabled
                              ? 'bg-indigo-600/15 border-indigo-500/30 text-indigo-400'
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200 text-xs">{f.name}</span>
                            {f.category === 'core' && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-950/70 border border-indigo-800/50 text-indigo-300">
                                Core MVP
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate max-w-md mt-0.5">
                            {f.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            isEnabled
                              ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                            }`}
                          />
                          <span>{isEnabled ? 'Habilitada' : 'Deshabilitada'}</span>
                        </span>

                        <button
                          type="button"
                          id={`toggle-${f.key}`}
                          onClick={() => handleToggleFeature(f.key, f.name)}
                          disabled={isUpdating}
                          aria-pressed={isEnabled}
                          title={`${isEnabled ? 'Deshabilitar' : 'Habilitar'} ${f.name}`}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            isEnabled ? 'bg-indigo-600' : 'bg-slate-800 hover:bg-slate-700'
                          } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              isEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">Crear Nuevo Usuario</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Nombre</label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={e => setNewFirstName(e.target.value)}
                    placeholder="Valeria"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Apellido</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={e => setNewLastName(e.target.value)}
                    placeholder="Ramos"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="valeria.ramos@empresa.com"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Cargo / Puesto</label>
                  <input
                    type="text"
                    value={newJobTitle}
                    onChange={e => setNewJobTitle(e.target.value)}
                    placeholder="Tech Lead, QA..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Rol RBAC</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    {availableRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Estado de Cuenta Inicial</label>
                  <select
                    value={newUserAccountStatus}
                    onChange={e => setNewUserAccountStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="ACTIVE">Activo (Acceso Inmediato)</option>
                    <option value="PENDING_ACTIVATION">Pendiente de Activación</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Organización Asignada</label>
                  <select
                    value={newUserOrgId}
                    onChange={e => setNewUserOrgId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="">Seleccionar Organización...</option>
                    {organizations
                      .filter(o => (o.status || '').toUpperCase() === 'ACTIVE' || o.status === 'Active')
                      .map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Contraseña Inicial (Opcional)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Dejar en blanco para predeterminada"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ORGANIZATION MODAL */}
      {isCreateOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">Nueva Organización Empresarial</h3>
              </div>
              <button
                onClick={() => setIsCreateOrgModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrganization} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nombre de la Organización</label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  placeholder="Ej: Clínica San Rafael, Red Hospitalaria Norte..."
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Identificador / Slug</label>
                  <input
                    type="text"
                    value={newOrgSlug}
                    onChange={e => setNewOrgSlug(e.target.value)}
                    placeholder="san-rafael"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Dominio Corporativo</label>
                  <input
                    type="text"
                    value={newOrgDomain}
                    onChange={e => setNewOrgDomain(e.target.value)}
                    placeholder="clinica-sanrafael.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Sector / Industria</label>
                <input
                  type="text"
                  value={newOrgIndustry}
                  onChange={e => setNewOrgIndustry(e.target.value)}
                  placeholder="Salud, Farmacéutica, Tecnología Médica..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOrgModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  Crear Organización
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN USER TO ORGANIZATION MODAL */}
      {assigningUserOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">
                  Asignar a Organización: {assigningUserOrg.firstName} {assigningUserOrg.lastName}
                </h3>
              </div>
              <button
                onClick={() => setAssigningUserOrg(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Seleccionar Organización</label>
                <select
                  value={targetOrgIdToAssign}
                  onChange={e => setTargetOrgIdToAssign(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="">Seleccione una organización activa...</option>
                  {organizations
                    .filter(o => (o.status || '').toUpperCase() === 'ACTIVE' || o.status === 'Active')
                    .map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.slug})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Rol en la Organización</label>
                <select
                  value={targetOrgRoleToAssign}
                  onChange={e => setTargetOrgRoleToAssign(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="Member">Member (Colaborador)</option>
                  <option value="Admin">Admin (Administrador)</option>
                  <option value="Guest">Guest (Invitado)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssigningUserOrg(null)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!targetOrgIdToAssign}
                  onClick={handleAssignUserOrg}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  Asignar Colaborador
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ORGANIZATION MEMBERS MODAL */}
      {viewingOrgMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-xs max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">
                  Miembros de: {viewingOrgMembers.name} ({orgMembersList.length})
                </h3>
              </div>
              <button
                onClick={() => setViewingOrgMembers(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {orgMembersList.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  No hay miembros registrados en esta organización.
                </div>
              ) : (
                orgMembersList.map(m => (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={m.user?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-800"
                      />
                      <div>
                        <div className="font-semibold text-slate-200">{m.user?.displayName || m.user?.email || m.userId}</div>
                        <div className="text-[10px] text-slate-400">{m.user?.jobTitle || 'Miembro'} • {m.user?.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800 text-indigo-300 font-medium">
                        {m.role}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                          (m.status || '').toUpperCase() === 'ACTIVE' || m.status === 'Active'
                            ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingOrgMembers(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">Editar Usuario: {editingUser.firstName} {editingUser.lastName}</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Nombre</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={e => setEditFirstName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Apellido</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={e => setNewLastName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Correo Electrónico (Solo lectura)</label>
                <input
                  type="text"
                  disabled
                  value={editingUser.email}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Cargo / Puesto</label>
                  <input
                    type="text"
                    value={editJobTitle}
                    onChange={e => setEditJobTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Rol RBAC</label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    {availableRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Estado de la Cuenta</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="Active">Activo (ACTIVE)</option>
                  <option value="Suspended">Suspendido</option>
                  <option value="Inactive">Inactivo (INACTIVE)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-slate-100 text-sm">Dar de Baja Colaborador</h3>
            </div>
            <p className="text-slate-300 leading-relaxed">
              ¿Está seguro de que desea dar de baja a <strong className="text-white">{deletingUser.firstName} {deletingUser.lastName}</strong> (<code className="text-slate-400">{deletingUser.email}</code>)?
              Se aplicará una baja lógica reversible (Zero Hard Delete) y se registrará en la auditoría.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-md shadow-rose-600/30 cursor-pointer"
              >
                Dar de Baja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
