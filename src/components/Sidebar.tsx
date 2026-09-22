import React from 'react';
import { 
  Server, 
  Calendar, 
  Wrench, 
  MapPin, 
  FileText, 
  LogOut, 
  ShieldCheck,
  ChevronRight,
  User as UserIcon,
  Users,
  Database,
  ScanLine
} from 'lucide-react';
import { ActiveTab } from './Navbar';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  user: any;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenScanner?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  user,
  onLogout,
  isOpen,
  onClose,
  onOpenScanner
}) => {
  const isRevisor = user?.role === 'revisor';

  const navItems = [
    { id: 'dashboard', label: '0. Panel de Control', icon: ShieldCheck, hidden: isRevisor },
    { id: 'equipos', label: '1. Censo de Equipos', icon: Server, hidden: isRevisor },
    { id: 'plan', label: '2. Plan Anual', icon: Calendar, hidden: isRevisor },
    { id: 'ejecucion', label: '3. Registro Ejecución', icon: Wrench, hidden: isRevisor },
    { id: 'ubicaciones', label: '4. Mapa de Áreas', icon: MapPin, hidden: isRevisor },
    { id: 'reportes', label: '5. Reportes Oficiales SGC', icon: FileText, hidden: false },
    { id: 'usuarios', label: '6. Gestión de Usuarios', icon: Users, hidden: isRevisor },
    { id: 'database', label: '7. Motor Base de Datos', icon: Database, hidden: isRevisor },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col h-screen transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} shrink-0 print:hidden`}>
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-900/50">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-black text-white tracking-tight uppercase">FCBV SGC</h1>
          <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">Mantenimiento</p>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-slate-800 bg-slate-800/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
            <UserIcon className="w-4 h-4 text-slate-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{user?.name || 'Usuario'}</p>
            <p className="text-[10px] text-slate-400 capitalize">{user?.role === 'admin' ? 'Administrador' : 'Revisor SGC'}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {onOpenScanner && !isRevisor && (
          <div className="mb-3">
            <button
              type="button"
              id="sidebar-btn-scanner"
              onClick={() => {
                onOpenScanner();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-950/50 border border-indigo-400/30 transition-all cursor-pointer"
            >
              <ScanLine className="w-4 h-4 text-white" />
              <span>Escanear QR / OCR Etiquetas</span>
            </button>
          </div>
        )}

        {navItems.filter(item => !item.hidden).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id as ActiveTab);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                isActive 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-200' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
            </button>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4 text-slate-500" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
    </>
  );
};
