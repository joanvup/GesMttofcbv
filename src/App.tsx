import React, { useState, useEffect, useMemo } from 'react';
import { Equipment, EquipmentFrequency, MaintenanceExecution, CampusLocation, AreaType } from './types';
import { StorageService, getDefaultMonthsForFrequency } from './services/storage';
import { ActiveTab } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Auth/Login';
import { EquipmentList } from './components/EquipmentModule/EquipmentList';
import { EquipmentFormModal } from './components/EquipmentModule/EquipmentFormModal';
import { EquipmentDetailsModal } from './components/EquipmentModule/EquipmentDetailsModal';
import { ExcelImportModal } from './components/EquipmentModule/ExcelImportModal';
import { AnnualPlanView } from './components/AnnualPlanModule/AnnualPlanView';
import { ExecutionView } from './components/ExecutionModule/ExecutionView';
import { LocationList } from './components/LocationModule/LocationList';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { ReportsView, ReportFormatId } from './components/ReportsModule/ReportsView';
import { UserManagement } from './components/UserManagement';
import { DatabaseSettings } from './components/DatabaseSettings';
import { DashboardView } from './components/DashboardView';
import { EquipmentScannerModal } from './components/Scanner/EquipmentScannerModal';
import { CorrectiveMaintenanceModal } from './components/ExecutionModule/CorrectiveMaintenanceModal';
import { CheckCircle, AlertCircle, Info, Database, HelpCircle, Trash2, RotateCcw, X, Shield, Menu } from 'lucide-react';
import { ClearDataModal } from './components/ClearDataModal';

export default function App() {
  // --------------------------------------------------------------------------
  // Autenticación y Layout
  // --------------------------------------------------------------------------
  const [token, setToken] = useState<string | null>(localStorage.getItem('fcbv_token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('fcbv_user') || 'null'));
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Navegación
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  useEffect(() => {
    // Validar token al cargar
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.user);
          if (data.user.role === 'revisor') {
            setActiveTab('reportes');
          }
        } else {
          handleLogout();
        }
      })
      .catch(() => handleLogout())
      .finally(() => setIsAuthLoading(false));
    } else {
      setIsAuthLoading(false);
    }
  }, []);

  const handleLogin = (newToken: string, newUser: any) => {
    localStorage.setItem('fcbv_token', newToken);
    localStorage.setItem('fcbv_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    
    if (newUser.role === 'revisor') {
      setActiveTab('reportes');
    } else {
      setActiveTab('equipos');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('fcbv_token');
    localStorage.removeItem('fcbv_user');
    setToken(null);
    setUser(null);
  };

  // ... (Rest of existing state variables)
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [planMatrix, setPlanMatrix] = useState<Record<string, boolean[]>>({});
  const [executions, setExecutions] = useState<MaintenanceExecution[]>([]);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [buildings, setBuildings] = useState<string[]>([]);

  // Estados de navegación rápida para reportes
  const [reportsInitialFormat, setReportsInitialFormat] = useState<ReportFormatId>('F01');
  const [reportsInitialEquipmentId, setReportsInitialEquipmentId] = useState<string>('todos');

  // Modales
  const [isEquipmentFormOpen, setIsEquipmentFormOpen] = useState(false);
  const [equipmentToEdit, setEquipmentToEdit] = useState<Equipment | null>(null);
  const [equipmentToView, setEquipmentToView] = useState<Equipment | null>(null);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isBackupRestoreOpen, setIsBackupRestoreOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Modales y estado para Escáner QR / Serial y Mantenimiento Correctivo
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCorrectiveModalOpen, setIsCorrectiveModalOpen] = useState(false);
  const [selectedEquipmentForCorrective, setSelectedEquipmentForCorrective] = useState<Equipment | null>(null);
  const [selectedExecutionForCorrective, setSelectedExecutionForCorrective] = useState<MaintenanceExecution | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Carga inicial
  useEffect(() => {
    if (user) {
      loadData(selectedYear);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const plan = StorageService.getAnnualPlan(selectedYear);
      setPlanMatrix(plan);
    }
  }, [selectedYear, user]);

  const loadData = async (year: number) => {
    const loadedEquipments = await StorageService.getEquipmentList();
    const loadedPlan = await StorageService.getAnnualPlan(year);
    const loadedExecutions = await StorageService.getExecutions();
    const loadedLocations = await StorageService.getLocations();
    const loadedBuildings = await StorageService.getBuildings();

    setEquipments(loadedEquipments);
    setPlanMatrix(loadedPlan);
    setExecutions(loadedExecutions);
    setLocations(loadedLocations);
    setBuildings(loadedBuildings);
  };

  // --------------------------------------------------------------------------
  // Manejadores de Equipos
  // --------------------------------------------------------------------------
  const handleSaveEquipment = async (equipmentData: Equipment) => {
    if (user?.role !== 'admin') return;

    // Check for duplicate code
    const isDuplicateCode = equipments.some((e) => e.code.toUpperCase().trim() === equipmentData.code.toUpperCase().trim() && e.id !== equipmentData.id);
    if (isDuplicateCode) {
      showToast(`Error: Ya existe un equipo con el código ${equipmentData.code}.`, 'error');
      return;
    }

    const existingIndex = equipments.findIndex((e) => e.id === equipmentData.id);
    let updatedList: Equipment[];

    if (existingIndex >= 0) {
      updatedList = [...equipments];
      updatedList[existingIndex] = equipmentData;
    } else {
      updatedList = [equipmentData, ...equipments];
    }

    try {
      await StorageService.saveEquipmentList(updatedList);
      
      setEquipments(updatedList);
      showToast(`Equipo ${equipmentData.code} ${existingIndex >= 0 ? 'actualizado' : 'registrado'} con éxito.`);

      const updatedPlan = { ...planMatrix };
      if (equipmentData.status === 'activo') {
        if (!updatedPlan[equipmentData.id] || existingIndex < 0) {
          updatedPlan[equipmentData.id] = getDefaultMonthsForFrequency(
            equipmentData.frequency,
            equipmentData.customMonths
          );
        }
      } else {
        updatedPlan[equipmentData.id] = new Array(12).fill(false);
      }
      setPlanMatrix(updatedPlan);
      await StorageService.saveAnnualPlan(selectedYear, updatedPlan);
    } catch (e: any) {
      showToast(`Error al guardar equipo: ${e.message}`, 'error');
    }
  };

  const handleToggleEquipmentStatus = async (equipment: Equipment) => {
    if (user?.role !== 'admin') return;
    const newStatus = equipment.status === 'activo' ? 'baja' : 'activo';
    const updated = { ...equipment, status: newStatus, updatedAt: new Date().toISOString() };
    const updatedList = equipments.map((e) => (e.id === equipment.id ? updated : e));

    try {
      await StorageService.saveEquipmentList(updatedList);
      setEquipments(updatedList);

      const updatedPlan = { ...planMatrix };
      if (newStatus === 'baja') {
        updatedPlan[equipment.id] = new Array(12).fill(false);
        showToast(`Equipo ${equipment.code} dado de baja lógica.`, 'info');
      } else {
        updatedPlan[equipment.id] = getDefaultMonthsForFrequency(equipment.frequency, equipment.customMonths);
        showToast(`Equipo ${equipment.code} reactivado.`, 'success');
      }
      setPlanMatrix(updatedPlan);
      await StorageService.saveAnnualPlan(selectedYear, updatedPlan);
    } catch (e: any) {
      showToast(`Error al cambiar estado: ${e.message}`, 'error');
    }
  };

  const handleImportSuccess = async (importedEquipments: Equipment[], newLocationsToCreate?: CampusLocation[]) => {
    if (user?.role !== 'admin') return;

    // Remove duplicates
    const existingCodes = new Set(equipments.map((e) => e.code.toUpperCase().trim()));
    const validImportedEquipments: Equipment[] = [];
    const skippedCodes: string[] = [];

    for (const eq of importedEquipments) {
      const code = eq.code.toUpperCase().trim();
      if (existingCodes.has(code)) {
        skippedCodes.push(eq.code);
      } else {
        existingCodes.add(code);
        validImportedEquipments.push(eq);
      }
    }

    if (skippedCodes.length > 0) {
      showToast(`Se omitieron ${skippedCodes.length} equipos porque el código ya existe.`, 'info');
    }

    if (validImportedEquipments.length === 0 && importedEquipments.length > 0) {
      return;
    }

    const combined = [...validImportedEquipments, ...equipments];
    
    try {
      await StorageService.saveEquipmentList(combined);
      setEquipments(combined);

      const updatedPlan = { ...planMatrix };
      validImportedEquipments.forEach((eq) => {
        updatedPlan[eq.id] = eq.status === 'activo' 
          ? getDefaultMonthsForFrequency(eq.frequency, eq.customMonths) 
          : new Array(12).fill(false);
      });
      setPlanMatrix(updatedPlan);
      await StorageService.saveAnnualPlan(selectedYear, updatedPlan);

      const locationsToVerify: any[] = [];
      if (newLocationsToCreate && newLocationsToCreate.length > 0) {
        newLocationsToCreate.forEach((nl) => locationsToVerify.push({ name: nl.name, building: nl.building, areaType: nl.areaType, description: nl.description }));
      }
      validImportedEquipments.forEach((eq) => {
        if (eq.location && eq.location.trim()) locationsToVerify.push({ name: eq.location.trim() });
      });

      const { createdLocations, allLocations } = await StorageService.ensureLocationsExist(locationsToVerify);
      setLocations(allLocations);
      setBuildings(await StorageService.getBuildings());

      showToast(`Importación exitosa: ${validImportedEquipments.length} equipos agregados.`, 'success');
    } catch (e: any) {
      showToast(`Error al importar equipos: ${e.message}`, 'error');
    }
  };

  const handleToggleMonth = async (equipmentId: string, monthIndex: number) => {
    if (user?.role !== 'admin') return;
    const currentSchedule = planMatrix[equipmentId] ? [...planMatrix[equipmentId]] : new Array(12).fill(false);
    currentSchedule[monthIndex] = !currentSchedule[monthIndex];
    const updatedPlan = { ...planMatrix, [equipmentId]: currentSchedule };
    
    setPlanMatrix(updatedPlan);
    await StorageService.saveAnnualPlan(selectedYear, updatedPlan);
    
    const eq = equipments.find((e) => e.id === equipmentId);
    if (eq) {
      const stateTxt = currentSchedule[monthIndex] ? 'programado' : 'desprogramado';
      showToast(`${eq.code}: Mantenimiento mes ${monthIndex + 1} ${stateTxt}.`, 'info');
    }
  };

  const handleResetPlanToDefaults = async () => {
    if (user?.role !== 'admin') return;
    const newPlan: Record<string, boolean[]> = {};
    equipments.forEach((eq) => {
      newPlan[eq.id] = eq.status === 'activo' ? getDefaultMonthsForFrequency(eq.frequency, eq.customMonths) : new Array(12).fill(false);
    });
    setPlanMatrix(newPlan);
    await StorageService.saveAnnualPlan(selectedYear, newPlan);
    showToast(`Cronograma ${selectedYear} recalculado.`, 'success');
  };

  const [preSelectedPlanEquipmentIds, setPreSelectedPlanEquipmentIds] = useState<string[]>([]);
  const [openBulkModalOnPlan, setOpenBulkModalOnPlan] = useState<boolean>(false);

  const handleBulkUpdatePlan = (updatedPlan: Record<string, boolean[]>, updatedEquipments?: Equipment[], message?: string, updatedExecutions?: MaintenanceExecution[]) => {
    if (user?.role !== 'admin') return;
    setPlanMatrix(updatedPlan);
     StorageService.saveAnnualPlan(selectedYear, updatedPlan);
    if (updatedEquipments) {
      setEquipments(updatedEquipments);
      StorageService.saveEquipmentList(updatedEquipments);
    }
    if (updatedExecutions) {
      setExecutions(updatedExecutions);
      StorageService.saveExecutions(updatedExecutions);
    }
    showToast(message || 'Programación masiva actualizada.', 'success');
  };

  const handleBulkChangeFrequency = async (equipmentIds: string[], frequency: EquipmentFrequency) => {
    if (user?.role !== 'admin') return;
    const updated = await StorageService.updateEquipmentsFrequency(equipmentIds, frequency);
    setEquipments(updated);

    const plan = { ...planMatrix };
    equipmentIds.forEach((id) => {
      const eq = updated.find((e) => e.id === id);
      if (eq && eq.status === 'activo') plan[id] = getDefaultMonthsForFrequency(frequency, eq.customMonths);
    });
    setPlanMatrix(plan);
    StorageService.saveAnnualPlan(selectedYear, plan);
    showToast('Frecuencia y cronograma actualizados.', 'success');
  };

  const handleNavigateToPlanForBulkSchedule = (equipmentIds: string[]) => {
    setPreSelectedPlanEquipmentIds(equipmentIds);
    setOpenBulkModalOnPlan(true);
    setActiveTab('plan');
  };

  const handleSaveExecution = async (execution: MaintenanceExecution) => {
    if (user?.role !== 'admin') return;
    await StorageService.upsertExecution(execution);
    setExecutions(await StorageService.getExecutions());
    showToast(execution.isExecuted ? 'Mantenimiento marcado como EJECUTADO.' : 'Mantenimiento programado.', 'success');
  };

  const handleBulkSaveExecutions = async (executedList: MaintenanceExecution[], count: number) => {
    if (user?.role !== 'admin') return;
    const currentList = await StorageService.getExecutions();
    const map = new Map<string, MaintenanceExecution>();
    currentList.forEach((e) => map.set(`${e.equipmentId}_${e.year}_${e.month}`, e));
    executedList.forEach((e) => map.set(`${e.equipmentId}_${e.year}_${e.month}`, e));
    
    const merged = Array.from(map.values());
    await StorageService.saveExecutions(merged);
    setExecutions(merged);
    showToast(`Ejecución masiva exitosa: ${count} órdenes.`, 'success');
  };

  const handleResetAllData = async () => {
    if (user?.role !== 'admin') return;
    await StorageService.resetToDefault?.();
    loadData(selectedYear);
    showToast('Datos de demostración restaurados.', 'info');
  };

  const handleClearAllDemoData = async (options: { preserveLocations: boolean }) => {
    if (user?.role !== 'admin') return;
    await StorageService.clearAllData(options);
    loadData(selectedYear);
    showToast('Datos limpiados.', 'info');
  };

  const handleRestoreDatabaseSuccess = (summary: any) => {
    if (user?.role !== 'admin') return;
    loadData(selectedYear);
    showToast('Copia de seguridad restaurada.', 'success');
  };

  const handleSaveLocation = async (locationData: CampusLocation, oldName?: string) => {
    if (user?.role !== 'admin') return;
    await StorageService.upsertLocation(locationData, oldName);
    setLocations(await StorageService.getLocations());
    if (oldName && oldName.trim() !== locationData.name.trim()) {
      setEquipments(await StorageService.getEquipmentList());
    }
    showToast(`Ubicación guardada con éxito.`);
  };

  const handleDeleteLocation = async (locationId: string, reassignToLocationName?: string) => {
    if (user?.role !== 'admin') return;
    const locToDelete = locations.find((l) => l.id === locationId);
    if (!locToDelete) return;

    if (reassignToLocationName && reassignToLocationName.trim()) {
      const updatedEquipments = equipments.map((eq) => {
        if (eq.location.toLowerCase() === locToDelete.name.toLowerCase()) {
          return { ...eq, location: reassignToLocationName.trim(), updatedAt: new Date().toISOString() };
        }
        return eq;
      });
      setEquipments(updatedEquipments);
      StorageService.saveEquipmentList(updatedEquipments);
    }
    await StorageService.deleteLocation(locationId);
    setLocations(await StorageService.getLocations());
    showToast('Ubicación eliminada', 'info');
  };

  const handleQuickCreateLocation = (newLoc: CampusLocation) => {
    if (user?.role !== 'admin') return;
    StorageService.upsertLocation(newLoc);
    setLocations( StorageService.getLocations());
    showToast(`Nueva ubicación registrada.`, 'success');
  };

  const handleImportLocations = async (importedLocations: CampusLocation[]) => {
    if (user?.role !== 'admin') return;
    for (const loc of importedLocations) { await StorageService.upsertLocation(loc); }
    setLocations(await StorageService.getLocations());
    showToast('Ubicaciones importadas.', 'success');
  };

  const handleAddBuilding = async (name: string) => {
    if (user?.role !== 'admin') return { success: false, message: 'Permiso denegado' };
    const res = await StorageService.addBuilding(name);
    if (res.success) setBuildings(await StorageService.getBuildings());
    showToast(res.message, res.success ? 'success' : 'error');
    return res;
  };

  const handleRenameBuilding = async (oldName: string, newName: string) => {
    if (user?.role !== 'admin') return { success: false, message: 'Permiso denegado' };
    const res = await StorageService.renameBuilding(oldName, newName);
    if (res.success) {
      setBuildings(await StorageService.getBuildings());
      setLocations(await StorageService.getLocations());
    }
    showToast(res.message, res.success ? 'success' : 'error');
    return res;
  };

  const handleDeleteBuilding = async (name: string, reassignTo?: string) => {
    if (user?.role !== 'admin') return { success: false, message: 'Permiso denegado' };
    const res = await StorageService.deleteBuilding(name, reassignTo);
    if (res.success) {
      setBuildings(await StorageService.getBuildings());
      setLocations(await StorageService.getLocations());
    }
    showToast(res.message, 'info');
    return res;
  };

  const handleResetBuildings = async () => {
    if (user?.role !== 'admin') return;
    await StorageService.saveBuildings(StorageService.INITIAL_BUILDINGS);
    setBuildings(await StorageService.getBuildings());
    showToast('Edificios restablecidos.', 'info');
  };

  const complianceRate = useMemo(() => {
    let totalPlanned = 0;
    let totalExecuted = 0;
    
    equipments.forEach(eq => {
      const plan = planMatrix[eq.id];
      if (plan) {
        plan.forEach((isPlanned, monthIndex) => {
          if (isPlanned) {
            totalPlanned++;
            const exec = executions.find(x => x.equipmentId === eq.id && x.year === selectedYear && x.month === monthIndex + 1);
            if (exec && exec.isExecuted) {
              totalExecuted++;
            }
          }
        });
      }
    });
    
    return totalPlanned === 0 ? 0 : Math.round((totalExecuted / totalPlanned) * 100);
  }, [equipments, planMatrix, executions, selectedYear]);

  // Handlers para Escáner y Mantenimiento Correctivo
  const handleOpenScanner = () => {
    setIsScannerOpen(true);
  };

  const handleEquipmentSelectedFromScanner = (equipment: Equipment, action: 'view' | 'corrective' | 'preventive') => {
    setIsScannerOpen(false);
    if (action === 'view') {
      setEquipmentToView(equipment);
    } else if (action === 'corrective') {
      setSelectedEquipmentForCorrective(equipment);
      setSelectedExecutionForCorrective(null);
      setIsCorrectiveModalOpen(true);
    } else if (action === 'preventive') {
      setActiveTab('ejecucion');
      showToast(`Equipo ${equipment.code} seleccionado para revisión en Plan`, 'info');
    }
  };

  const handleCreateNewEquipmentFromScan = (prefilledData: Partial<Equipment>) => {
    setIsScannerOpen(false);
    const newDraft: Equipment = {
      id: crypto.randomUUID(),
      code: prefilledData.code || '',
      name: prefilledData.name || '',
      location: prefilledData.location || (locations[0]?.name || 'Data Center Principal'),
      brand: prefilledData.brand || '',
      model: prefilledData.model || '',
      serial: prefilledData.serial || '',
      frequency: prefilledData.frequency || 'trimestral',
      parts: prefilledData.parts || [],
      maintenanceTasks: prefilledData.maintenanceTasks || [],
      observations: prefilledData.observations || '',
      status: 'activo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEquipmentToEdit(newDraft);
    setIsEquipmentFormOpen(true);
  };

  const handleOpenCorrectiveModal = (equipment?: Equipment, execution?: MaintenanceExecution) => {
    setSelectedEquipmentForCorrective(equipment || equipments[0] || null);
    setSelectedExecutionForCorrective(execution || null);
    setIsCorrectiveModalOpen(true);
  };

  const handleSaveCorrectiveMaintenance = async (executionData: MaintenanceExecution) => {
    try {
      await StorageService.recordCorrectiveMaintenance(executionData);
      setExecutions((prev) => {
        const idx = prev.findIndex((e) => e.id === executionData.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = executionData;
          return updated;
        }
        return [executionData, ...prev];
      });
      setIsCorrectiveModalOpen(false);
      setSelectedEquipmentForCorrective(null);
      setSelectedExecutionForCorrective(null);
      showToast('Mantenimiento correctivo guardado y sincronizado con éxito', 'success');
    } catch (err: any) {
      console.error('Error al guardar correctivo:', err);
      showToast('Error al guardar mantenimiento correctivo', 'error');
    }
  };

  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Cargando sistema...</div>;
  }

  if (!token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800 antialiased overflow-hidden">
      {/* Sidebar Layout */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        user={user} 
        onLogout={handleLogout} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Header Superior */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 shrink-0 print:hidden z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">
              {activeTab === 'dashboard' && 'Panel de Control'}
              {activeTab === 'equipos' && 'Registro de Equipos Críticos'}
              {activeTab === 'plan' && 'Plan de Mantenimiento Anual'}
              {activeTab === 'ejecucion' && 'Mantenimiento Ejecutado'}
              {activeTab === 'ubicaciones' && 'Ubicaciones del Campus'}
              {activeTab === 'reportes' && 'Reportes Oficiales SGC'}
              {activeTab === 'usuarios' && 'Gestión de Usuarios'}
            </h2>
          </div>
          
          {isAdmin && (
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={() => setIsBackupRestoreOpen(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors" title="Backup y Restauración">
                <Database className="w-5 h-5" />
              </button>
              <button onClick={() => setShowHelpModal(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors" title="Guía">
                <HelpCircle className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-slate-200 mx-1"></div>
              <button onClick={() => setShowClearConfirm(true)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Limpiar Sistema">
                <Trash2 className="w-5 h-5" />
              </button>
              <button onClick={() => setShowResetConfirm(true)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Cargar Datos Demo">
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          )}
        </header>

        {/* Notificación Toast */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium ${
                toast.type === 'success' ? 'bg-emerald-900 text-emerald-100 border-emerald-700' : 
                toast.type === 'error' ? 'bg-rose-900 text-rose-100 border-rose-700' : 
                'bg-slate-900 text-slate-100 border-slate-700'
              }`}>
              {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        {/* Contenido Principal con Scroll Independiente */}
        <main className="flex-1 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {activeTab === 'dashboard' && isAdmin && (
              <DashboardView
                equipments={equipments}
                planMatrix={planMatrix}
                executions={executions}
                selectedYear={selectedYear}
                complianceRate={complianceRate}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'equipos' && isAdmin && (
              <EquipmentList
                equipments={equipments}
                allLocations={locations}
                onAddEquipment={() => { setEquipmentToEdit(null); setIsEquipmentFormOpen(true); }}
                onEditEquipment={(eq) => { setEquipmentToEdit(eq); setIsEquipmentFormOpen(true); }}
                onViewEquipment={setEquipmentToView}
                onToggleStatus={handleToggleEquipmentStatus}
                onOpenImportModal={() => setIsExcelImportOpen(true)}
                onNavigateToLocations={() => setActiveTab('ubicaciones')}
                onBulkSchedule={handleNavigateToPlanForBulkSchedule}
                onBulkChangeFrequency={handleBulkChangeFrequency}
                onOpenScanner={handleOpenScanner}
              />
            )}

            {activeTab === 'plan' && isAdmin && (
              <AnnualPlanView
                equipments={equipments}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
                planMatrix={planMatrix}
                executions={executions}
                onToggleMonth={handleToggleMonth}
                onResetPlanToDefaults={handleResetPlanToDefaults}
                onBulkUpdatePlan={handleBulkUpdatePlan}
                initialSelectedEquipmentIds={preSelectedPlanEquipmentIds}
                initialOpenBulkModal={openBulkModalOnPlan}
                onClearInitialBulkOpen={() => setOpenBulkModalOnPlan(false)}
                onBulkSaveExecutions={handleBulkSaveExecutions}
              />
            )}

            {activeTab === 'ejecucion' && isAdmin && (
              <ExecutionView
                equipments={equipments}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
                planMatrix={planMatrix}
                executions={executions}
                onSaveExecution={handleSaveExecution}
                onBulkSaveExecutions={handleBulkSaveExecutions}
                onOpenCorrectiveModal={handleOpenCorrectiveModal}
              />
            )}

            {activeTab === 'ubicaciones' && isAdmin && (
              <LocationList
                locations={locations}
                equipments={equipments}
                buildings={buildings}
                onSaveLocation={handleSaveLocation}
                onDeleteLocation={handleDeleteLocation}
                onViewEquipment={setEquipmentToView}
                onImportLocations={handleImportLocations}
                onAddBuilding={handleAddBuilding}
                onRenameBuilding={handleRenameBuilding}
                onDeleteBuilding={handleDeleteBuilding}
                onResetBuildings={handleResetBuildings}
              />
            )}

            {activeTab === 'reportes' && (
              <ReportsView
                key={`${reportsInitialFormat}-${reportsInitialEquipmentId}`}
                equipments={equipments}
                planMatrix={planMatrix}
                executions={executions}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
                locations={locations}
                technicianSignature={StorageService.getTechnicianSignature()}
                initialFormat={reportsInitialFormat}
                initialEquipmentId={reportsInitialEquipmentId}
              />
            )}

            {activeTab === 'usuarios' && isAdmin && (
              <UserManagement />
            )}

            {activeTab === 'database' && isAdmin && (
              <DatabaseSettings />
            )}
          </div>
        </main>
      </div>

      {/* Modales de Gestión de Equipos (Solo Admin) */}
      {isAdmin && isEquipmentFormOpen && (
        <EquipmentFormModal
          isOpen={isEquipmentFormOpen}
          onClose={() => { setIsEquipmentFormOpen(false); setEquipmentToEdit(null); }}
          onSave={handleSaveEquipment}
          initialEquipment={equipmentToEdit}
          locations={locations}
          onQuickCreateLocation={handleQuickCreateLocation}
          onOpenScanner={() => {
            setIsEquipmentFormOpen(false);
            setIsScannerOpen(true);
          }}
        />
      )}

      {equipmentToView && (
        <EquipmentDetailsModal
          isOpen={Boolean(equipmentToView)}
          equipment={equipmentToView}
          onClose={() => setEquipmentToView(null)}
          onEdit={isAdmin ? ((eq) => { setEquipmentToView(null); setEquipmentToEdit(eq); setIsEquipmentFormOpen(true); }) : undefined}
          onToggleStatus={isAdmin ? ((eq) => { handleToggleEquipmentStatus(eq); setEquipmentToView(null); }) : undefined}
          onViewOfficialReport={(eq) => {
            setReportsInitialFormat('F02');
            setReportsInitialEquipmentId(eq.id);
            setActiveTab('reportes');
          }}
        />
      )}

      {isAdmin && isExcelImportOpen && (
        <ExcelImportModal
          isOpen={isExcelImportOpen}
          onClose={() => setIsExcelImportOpen(false)}
          onImportSuccess={handleImportSuccess}
          existingLocations={locations}
          existingBuildings={buildings}
        />
      )}

      {isAdmin && isBackupRestoreOpen && (
        <BackupRestoreModal
          isOpen={isBackupRestoreOpen}
          onClose={() => setIsBackupRestoreOpen(false)}
          onRestoreSuccess={handleRestoreDatabaseSuccess}
        />
      )}

      {/* Modal de Escáner QR / Barras / Serial / Reconocimiento OCR de Etiquetas */}
      <EquipmentScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        equipments={equipments}
        locations={locations}
        onEquipmentIdentified={handleEquipmentSelectedFromScanner}
        onCreateEquipment={handleCreateNewEquipmentFromScan}
        onAddNewEquipment={handleCreateNewEquipmentFromScan}
        onSelectEquipmentForCorrective={(eq) => handleEquipmentSelectedFromScanner(eq, 'corrective')}
        onSelectEquipmentForPreventive={(eq) => handleEquipmentSelectedFromScanner(eq, 'preventive')}
        onViewEquipmentDetails={(eq) => handleEquipmentSelectedFromScanner(eq, 'view')}
      />

      {/* Modal de Registro de Mantenimiento Correctivo */}
      <CorrectiveMaintenanceModal
        isOpen={isCorrectiveModalOpen}
        onClose={() => {
          setIsCorrectiveModalOpen(false);
          setSelectedEquipmentForCorrective(null);
          setSelectedExecutionForCorrective(null);
        }}
        onSave={handleSaveCorrectiveMaintenance}
        equipment={selectedEquipmentForCorrective}
        allEquipments={equipments}
        existingExecution={selectedExecutionForCorrective}
      />

      {isAdmin && (
        <ClearDataModal
          isOpen={showClearConfirm}
          onClose={() => setShowClearConfirm(false)}
          onConfirmClear={(options) => { handleClearAllDemoData(options); setShowClearConfirm(false); }}
          equipmentsCount={equipments.length}
          locationsCount={locations.length}
          executionsCount={executions.length}
        />
      )}
      
      {isAdmin && showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-600" />
              Restaurar Datos de Demostración FCBV
            </h3>
            <p className="text-xs text-slate-600 mt-2">Esta acción restablecerá los equipos de muestra de FCBV.</p>
            <div className="flex justify-end gap-2.5 mt-5">
              <button onClick={() => setShowResetConfirm(false)} className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button onClick={() => { handleResetAllData(); setShowResetConfirm(false); }} className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg">Sí, Restaurar</button>
            </div>
          </div>
        </div>
      )}
      
      {isAdmin && showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white text-slate-800 rounded-xl p-6 max-w-xl w-full shadow-2xl">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex items-center gap-2"><Shield className="text-indigo-600 w-5 h-5"/> Guía del Sistema</h3>
                <button onClick={() => setShowHelpModal(false)}><X className="w-5 h-5 text-slate-400"/></button>
             </div>
             <p className="text-sm text-slate-600">El sistema permite gestionar el SGC completo a través de los módulos laterales.</p>
          </div>
        </div>
      )}
    </div>
  );
}

