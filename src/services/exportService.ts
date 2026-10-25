import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipment, MaintenanceExecution, CampusLocation } from '../types';
import { MONTH_SHORT_NAMES, MONTH_NAMES, StorageService } from './storage';
import { readExcelFile, writeExcelFile } from './excelService';

export const ExportService = {
  // --------------------------------------------------------------------------
  // 1. EXPORTAR PLAN ANUAL A EXCEL
  // --------------------------------------------------------------------------
  async exportAnnualPlanToExcel(year: number, equipments: Equipment[], matrix: Record<string, boolean[]>) {
    const activeEquipments = equipments.filter((e) => e.status === 'activo');

    // Preparar filas de datos
    const rows = activeEquipments.map((eq) => {
      const schedule = matrix[eq.id] || new Array(12).fill(false);
      const rowData: Record<string, any> = {
        Código: eq.code,
        'Equipo / Descripción': eq.name,
        Ubicación: eq.location,
        Frecuencia: eq.frequency.toUpperCase(),
      };

      let totalInterventions = 0;
      MONTH_SHORT_NAMES.forEach((m, idx) => {
        const isScheduled = schedule[idx];
        rowData[m] = isScheduled ? 'X' : '';
        if (isScheduled) totalInterventions++;
      });

      rowData['Total Año'] = totalInterventions;
      return rowData;
    });

    // Fila de resumen totales mensuales
    const totalRow: Record<string, any> = {
      Código: 'TOTAL',
      'Equipo / Descripción': 'Mantenimientos programados por mes',
      Ubicación: '',
      Frecuencia: '',
    };
    let grandTotal = 0;
    MONTH_SHORT_NAMES.forEach((m, idx) => {
      const monthTotal = activeEquipments.reduce((acc, eq) => {
        const sched = matrix[eq.id] || [];
        return acc + (sched[idx] ? 1 : 0);
      }, 0);
      totalRow[m] = monthTotal;
      grandTotal += monthTotal;
    });
    totalRow['Total Año'] = grandTotal;
    rows.push(totalRow);

    await writeExcelFile({
      filename: `FCBV_Plan_Mantenimiento_Preventivo_${year}.xlsx`,
      sheetName: `Plan ${year}`,
      rows,
      widths: [
        12, // Código
        38, // Nombre
        28, // Ubicación
        14, // Frecuencia
        ...MONTH_SHORT_NAMES.map(() => 6), // 12 meses
        10, // Total Año
      ],
    });
  },

  // --------------------------------------------------------------------------
  // 2. EXPORTAR PLAN ANUAL A PDF
  // --------------------------------------------------------------------------
  exportAnnualPlanToPDF(year: number, equipments: Equipment[], matrix: Record<string, boolean[]>) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const activeEquipments = equipments.filter((e) => e.status === 'activo');

    // Encabezado institucional
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(14, 10, 269, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `FUNDACIÓN COLEGIO BILINGÜE (FCBV) - CRONOGRAMA ANUAL DE MANTENIMIENTO PREVENTIVO ${year}`,
      18,
      20
    );
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Gestión de Equipos Críticos de Infraestructura & Tecnología | Generado: ${new Date().toLocaleDateString('es-CO')}`,
      18,
      25
    );

    // Preparar columnas
    const head = [['Código', 'Equipo / Descripción', 'Ubicación', 'Frec.', ...MONTH_SHORT_NAMES, 'Total']];

    // Preparar cuerpo de la tabla
    const body: any[] = activeEquipments.map((eq) => {
      const schedule = matrix[eq.id] || new Array(12).fill(false);
      let count = 0;
      const monthCols = schedule.map((hasX) => {
        if (hasX) {
          count++;
          return 'X';
        }
        return '-';
      });
      return [
        eq.code,
        eq.name,
        eq.location,
        eq.frequency.substring(0, 4).toUpperCase(),
        ...monthCols,
        count.toString(),
      ];
    });

    // Fila resumen
    let totalAll = 0;
    const totalsMonthCols = MONTH_SHORT_NAMES.map((_, idx) => {
      const count = activeEquipments.reduce((acc, eq) => {
        const sched = matrix[eq.id] || [];
        return acc + (sched[idx] ? 1 : 0);
      }, 0);
      totalAll += count;
      return count.toString();
    });
    body.push([
      'TOTAL',
      'Total intervenciones programadas por mes',
      '',
      '',
      ...totalsMonthCols,
      totalAll.toString(),
    ]);

    autoTable(doc, {
      head: head,
      body: body,
      startY: 32,
      styles: {
        fontSize: 7.5,
        cellPadding: 1.5,
        valign: 'middle',
        halign: 'center',
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 18 },
        1: { halign: 'left', cellWidth: 62 },
        2: { halign: 'left', cellWidth: 42 },
        3: { halign: 'center', cellWidth: 14 },
        ...MONTH_SHORT_NAMES.reduce((acc: any, _, idx) => {
          acc[4 + idx] = { halign: 'center', cellWidth: 9 };
          return acc;
        }, {}),
        16: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      },
      didParseCell: function (data) {
        if (data.section === 'body') {
          // Destacar las celdas con 'X'
          if (data.cell.raw === 'X') {
            data.cell.styles.textColor = [15, 23, 42];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [224, 242, 254]; // sky-100
          }
          // Fila de totales
          if (data.row.index === body.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [241, 245, 249];
          }
        }
      },
    });

    // Pie de página institucional
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `FCBV - Mantenimiento Preventivo | Página ${i} de ${pageCount} | Documento Oficial de Control y Gestión`,
        14,
        202
      );
    }

    doc.save(`FCBV_Plan_Mantenimiento_Preventivo_${year}.pdf`);
  },

  // --------------------------------------------------------------------------
  // 3. EXPORTAR REGISTRO DE EJECUCIÓN A EXCEL
  // --------------------------------------------------------------------------
  async exportExecutionsToExcel(
    year: number,
    executions: MaintenanceExecution[],
    equipments: Equipment[],
    filterMonth?: number,
    filterStatus?: string
  ) {
    const eqMap = new Map<string, Equipment>(equipments.map((e) => [e.id, e]));

    const filtered = executions.filter((item) => {
      if (item.year !== year) return false;
      if (filterMonth && filterMonth !== 0 && item.month !== filterMonth) return false;
      const status = StorageService.calculateStatus(item, item.year, item.month);
      if (filterStatus && filterStatus !== 'todos' && status !== filterStatus) return false;
      return true;
    });

    const rows = filtered.map((item) => {
      const eq = eqMap.get(item.equipmentId);
      const status = StorageService.calculateStatus(item, item.year, item.month);

      return {
        Año: item.year,
        Mes: MONTH_NAMES[item.month - 1] || item.month,
        Código: eq?.code || 'N/A',
        'Nombre del Equipo': eq?.name || 'N/A',
        Ubicación: eq?.location || 'N/A',
        'Fecha Programada (Día Hábil)': item.scheduledDate || 'Sin programar',
        Estado: status.toUpperCase(),
        '¿Ejecutado?': item.isExecuted ? 'SÍ' : 'NO',
        'Fecha y Hora de Ejecución': item.executedDate || 'Pendiente',
        'Técnico Responsable': item.responsibleName || 'N/A',
        'Cargo / Rol': item.responsibleRole || 'N/A',
        'Firma Digital': item.signatureDataUrl ? 'Firmado digitalmente' : 'Sin firma',
        'Tareas Realizadas': (item.completedTasks || []).join('; '),
        'Repuestos / Piezas': (item.partsReplaced || []).join('; '),
        Observaciones: item.observations || '',
      };
    });

    await writeExcelFile({
      filename: `FCBV_Registro_Mantenimiento_Ejecutado_${year}.xlsx`,
      sheetName: 'Ejecución Mantenimiento',
      rows,
      widths: [
        8, // Año
        12, // Mes
        12, // Código
        34, // Nombre
        28, // Ubicación
        22, // Fecha Programada
        14, // Estado
        12, // Ejecutado
        24, // Fecha Ejecución
        24, // Responsable
        26, // Rol
        18, // Firma
        45, // Tareas
        30, // Repuestos
        40, // Observaciones
      ],
    });
  },

  // --------------------------------------------------------------------------
  // 4. EXPORTAR REGISTRO DE EJECUCIÓN A PDF
  // --------------------------------------------------------------------------
  exportExecutionsToPDF(
    year: number,
    executions: MaintenanceExecution[],
    equipments: Equipment[],
    filterMonth?: number,
    filterStatus?: string
  ) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const eqMap = new Map<string, Equipment>(equipments.map((e) => [e.id, e]));

    const filtered = executions.filter((item) => {
      if (item.year !== year) return false;
      if (filterMonth && filterMonth !== 0 && item.month !== filterMonth) return false;
      const status = StorageService.calculateStatus(item, item.year, item.month);
      if (filterStatus && filterStatus !== 'todos' && status !== filterStatus) return false;
      return true;
    });

    // Encabezado
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(14, 10, 269, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`FUNDACIÓN COLEGIO BILINGÜE (FCBV) - INFORME DE MANTENIMIENTO PREVENTIVO EJECUTADO`, 18, 19);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const monthFilterText =
      filterMonth && filterMonth !== 0 ? `Mes: ${MONTH_NAMES[filterMonth - 1]}` : 'Todos los meses';
    doc.text(
      `Año: ${year} | Filtro: ${monthFilterText} | Fecha emisión: ${new Date().toLocaleString('es-CO')}`,
      18,
      24
    );

    const head = [
      [
        'Código',
        'Equipo / Nombre',
        'Ubicación',
        'Mes',
        'Fecha Prog.',
        'Estado',
        'Fecha Ejecución',
        'Responsable',
        'Firma',
      ],
    ];

    const body: any[] = filtered.map((item) => {
      const eq = eqMap.get(item.equipmentId);
      const status = StorageService.calculateStatus(item, item.year, item.month);
      return [
        eq?.code || 'N/A',
        eq?.name || 'N/A',
        eq?.location || 'N/A',
        MONTH_SHORT_NAMES[item.month - 1] || item.month.toString(),
        item.scheduledDate || 'Sin fecha',
        status.toUpperCase(),
        item.executedDate || '-',
        item.responsibleName || 'Pendiente',
        item.signatureDataUrl ? 'FIRMADO' : '-',
      ];
    });

    autoTable(doc, {
      head: head,
      body: body,
      startY: 32,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        valign: 'middle',
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 20 },
        1: { cellWidth: 55 },
        2: { cellWidth: 42 },
        3: { halign: 'center', cellWidth: 15 },
        4: { halign: 'center', cellWidth: 25 },
        5: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
        6: { halign: 'center', cellWidth: 32 },
        7: { cellWidth: 38 },
        8: { halign: 'center', cellWidth: 18 },
      },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 5) {
          const val = String(data.cell.raw);
          if (val === 'EJECUTADO') {
            data.cell.styles.textColor = [22, 101, 52]; // emerald-800
            data.cell.styles.fillColor = [220, 252, 231]; // emerald-100
          } else if (val === 'ATRASADO') {
            data.cell.styles.textColor = [153, 27, 27]; // red-800
            data.cell.styles.fillColor = [254, 226, 226]; // red-100
          } else {
            data.cell.styles.textColor = [161, 98, 7]; // amber-800
            data.cell.styles.fillColor = [254, 243, 199]; // amber-100
          }
        }
      },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Colegio Bilingüe FCBV | Registro de Mantenimiento Preventivo de Equipos Críticos | Página ${i} de ${pageCount}`,
        14,
        202
      );
    }

    doc.save(`FCBV_Reporte_Mantenimiento_Ejecutado_${year}.pdf`);
  },

  // --------------------------------------------------------------------------
  // 5. GENERAR Y DESCARGAR PLANTILLA EXCEL PARA IMPORTACIÓN
  // --------------------------------------------------------------------------
  async downloadEquipmentExcelTemplate() {
    const templateRows = [
      {
        Código: 'AP-03',
        Nombre: 'Access Point Wi-Fi 6 Cisco Catalyst',
        Ubicación: 'Cafetería y Zona Común',
        Edificio: 'Edificio de Servicios', // Opcional (se crea o asigna automáticamente)
        Tipo_Area: 'otro', // Opcional (datacenter, laboratorio, aula, oficina, auditorio, infraestructura, otro)
        Marca: 'Cisco',
        Modelo: 'C9115AXI-A',
        Serial: 'FOC99382109',
        Frecuencia: 'trimestral', // mensual, trimestral, semestral, anual
        Partes: 'Fuente PoE, Antena, Puerto Gigabit, Carcasa',
        Tareas_Mantenimiento: 'Limpieza de polvo, Comprobación de canal de radio, Medición de latencia',
        Estado: 'activo', // activo o baja
        Observaciones: 'Equipo instalado para cobertura exterior de eventos',
      },
      {
        Código: 'SW-03',
        Nombre: 'Switch Edge 24 Puertos PoE',
        Ubicación: 'Oficina Admisiones',
        Edificio: 'Edificio Administrativo',
        Tipo_Area: 'oficina',
        Marca: 'HP Aruba',
        Modelo: '2530-24G',
        Serial: 'CN8984920',
        Frecuencia: 'semestral',
        Partes: 'Chasis metálico, Ventiladores, Fuente de poder',
        Tareas_Mantenimiento: 'Soplado y limpieza, Revisión de logs, Backup de configuración',
        Estado: 'activo',
        Observaciones: 'Conecta oficinas de admisiones y rectoría',
      },
    ];

    await writeExcelFile({
      filename: 'Plantilla_Importar_Equipos_FCBV.xlsx',
      sheetName: 'Plantilla Equipos',
      rows: templateRows,
      widths: [
        12, // Código
        34, // Nombre
        30, // Ubicación
        24, // Edificio
        16, // Tipo_Area
        15, // Marca
        18, // Modelo
        18, // Serial
        14, // Frecuencia
        40, // Partes
        50, // Tareas
        12, // Estado
        40, // Observaciones
      ],
    });
  },

  // --------------------------------------------------------------------------
  // 6. PARSEAR ARCHIVO EXCEL DE IMPORTACIÓN DE EQUIPOS
  // --------------------------------------------------------------------------
  async parseEquipmentExcel(file: File): Promise<Record<string, unknown>[]> {
    return readExcelFile(file);
  },

  // --------------------------------------------------------------------------
  // 7. EXPORTAR CATÁLOGO DE UBICACIONES A EXCEL
  // --------------------------------------------------------------------------
  async exportLocationsToExcel(locations: CampusLocation[], equipments: Equipment[]) {
    // Mapa de conteo de equipos por ubicación
    const countMap = new Map<string, { total: number; active: number }>();
    equipments.forEach((eq) => {
      const key = eq.location.toLowerCase().trim();
      const curr = countMap.get(key) || { total: 0, active: 0 };
      curr.total++;
      if (eq.status === 'activo') curr.active++;
      countMap.set(key, curr);
    });

    const rows = locations.map((loc) => {
      const counts = countMap.get(loc.name.toLowerCase().trim()) || { total: 0, active: 0 };
      return {
        'Nombre del Espacio / Ubicación': loc.name,
        'Edificio / Bloque': loc.building || 'Campus Principal',
        'Tipo de Área': loc.areaType.toUpperCase(),
        Estado: loc.status === 'activa' ? 'ACTIVA' : 'INACTIVA',
        'Equipos Totales': counts.total,
        'Equipos Activos': counts.active,
        'Descripción / Notas': loc.description || '',
      };
    });

    await writeExcelFile({
      filename: `FCBV_Catalogo_Ubicaciones_Campus_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Ubicaciones Campus',
      rows,
      widths: [
        32, // Nombre
        26, // Edificio
        18, // Tipo de Área
        12, // Estado
        16, // Equipos Totales
        16, // Equipos Activos
        45, // Descripción
      ],
    });
  },

  // --------------------------------------------------------------------------
  // 8. GENERAR Y DESCARGAR PLANTILLA EXCEL PARA IMPORTACIÓN DE UBICACIONES
  // --------------------------------------------------------------------------
  async downloadLocationExcelTemplate() {
    const templateRows = [
      {
        Nombre_Ubicacion: 'Laboratorio de Informática 3',
        Edificio_Bloque: 'Bloque Bachillerato',
        Tipo_Area: 'laboratorio', // opciones: aula, laboratorio, datacenter, oficina, auditorio, infraestructura, otro
        Estado: 'activa', // activa o inactiva
        Descripcion: 'Piso 2, 28 estaciones de cómputo para clases de programación y robótica',
      },
      {
        Nombre_Ubicacion: 'Data Center Secundario',
        Edificio_Bloque: 'Edificio Administrativo',
        Tipo_Area: 'datacenter',
        Estado: 'activa',
        Descripcion: 'Sótano, rack de respaldo y tablero eléctrico secundario',
      },
      {
        Nombre_Ubicacion: 'Auditorio Principal',
        Edificio_Bloque: 'Centro Cultural y Deportivo',
        Tipo_Area: 'auditorio',
        Estado: 'activa',
        Descripcion: 'Capacidad 400 personas, cabina de sonido y proyector de alta potencia',
      },
      {
        Nombre_Ubicacion: 'Biblioteca Infantil',
        Edificio_Bloque: 'Bloque Primaria',
        Tipo_Area: 'aula',
        Estado: 'activa',
        Descripcion: 'Piso 1, zona de lectura y 4 terminales de consulta',
      },
      {
        Nombre_Ubicacion: 'Oficina Soporte Técnico y Redes',
        Edificio_Bloque: 'Edificio Administrativo',
        Tipo_Area: 'oficina',
        Estado: 'activa',
        Descripcion: 'Mesa de ayuda TI y taller de diagnóstico de hardware',
      },
    ];

    await writeExcelFile({
      filename: 'Plantilla_Importar_Ubicaciones_FCBV.xlsx',
      sheetName: 'Plantilla Ubicaciones',
      rows: templateRows,
      widths: [
        34, // Nombre
        28, // Edificio
        18, // Tipo_Area
        12, // Estado
        55, // Descripcion
      ],
    });
  },

  // --------------------------------------------------------------------------
  // 9. PARSEAR ARCHIVO EXCEL DE IMPORTACIÓN DE UBICACIONES
  // --------------------------------------------------------------------------
  async parseLocationExcel(file: File): Promise<Record<string, unknown>[]> {
    return readExcelFile(file);
  },

  // --------------------------------------------------------------------------
  // 10. REPORTES OFICIALES SGC: PA-03-F01 (LISTADO DE EQUIPOS CRÍTICOS)
  // --------------------------------------------------------------------------
  async exportPA03F01ToExcel(equipments: Equipment[]) {
    const rows = equipments.map((eq) => ({
      Codigo: eq.code,
      Nombre: eq.name,
      Ubicación: eq.location || 'Campus General',
    }));

    await writeExcelFile({
      filename: `FCBV_PA-03-F01_Listado_Equipos_Criticos_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'PA-03-F01 Equipos',
      rows,
      widths: [16, 42, 32],
    });
  },

  // --------------------------------------------------------------------------
  // 11. REPORTES OFICIALES SGC: PA-03-F02 (FICHA TÉCNICA DE EQUIPOS)
  // --------------------------------------------------------------------------
  async exportPA03F02ToExcel(equipments: Equipment[]) {
    const rows = equipments.map((eq) => ({
      Código: eq.code,
      'Descripción del Equipo': eq.name,
      'Área / Ubicación': eq.location || 'Campus General',
      'Fabricante (Marca)': eq.brand || 'N/A',
      Modelo: eq.model || 'N/A',
      Serial: eq.serial || 'S/N',
      'Partes del Equipo': (eq.parts || []).join('; '),
      'Mantenimientos a Efectuar': (eq.maintenanceTasks || []).join('; '),
      'Frecuencia MTTO': eq.frequency.toUpperCase(),
      'Observaciones Generales': eq.observations || '',
    }));

    await writeExcelFile({
      filename: `FCBV_PA-03-F02_Fichas_Tecnicas_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'PA-03-F02 Fichas',
      rows,
      widths: [14, 38, 28, 22, 24, 24, 36, 42, 16, 36],
    });
  },

  // --------------------------------------------------------------------------
  // 12. REPORTES OFICIALES SGC: PA-03-F03 (PROGRAMACIÓN DE MTTOS EQUIPOS)
  // --------------------------------------------------------------------------
  async exportPA03F03ToExcel(year: number, equipments: Equipment[], matrix: Record<string, boolean[]>) {
    await this.exportAnnualPlanToExcel(year, equipments, matrix);
  },

  // --------------------------------------------------------------------------
  // 13. REPORTES OFICIALES SGC: PA-03-F05 (REGISTRO DE MTTO EJECUTADO)
  // --------------------------------------------------------------------------
  async exportPA03F05ToExcel(equipments: Equipment[], executions: MaintenanceExecution[]) {
    const eqMap = new Map(equipments.map((e) => [e.id, e]));
    const executedItems = executions.filter((e) => e.isExecuted);

    const rows = executedItems.map((ex) => {
      const eq = eqMap.get(ex.equipmentId);
      return {
        Código: eq?.code || 'N/A',
        'Nombre del Equipo': eq ? `${eq.name} - ${eq.location}` : 'N/A',
        Fecha: ex.executedDate ? ex.executedDate.slice(0, 10) : ex.scheduledDate,
        'Descripción del Mantenimiento': (ex.completedTasks || eq?.maintenanceTasks || []).join(', '),
        'Firma Elaboró': ex.responsibleName || 'Joan Fuentes (Técnico TI)',
        'Firma Revisó': 'Coordinación de Calidad y TI',
        Observaciones: ex.observations || '',
      };
    });

    await writeExcelFile({
      filename: `FCBV_PA-03-F05_Registro_Mtto_Ejecutado_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'PA-03-F05 Ejecutado',
      rows:
        rows.length > 0
          ? rows
          : [
              {
                Código: 'EJEMPLO',
                'Nombre del Equipo': 'Sin registros aún',
                Fecha: '-',
                'Descripción del Mantenimiento': '-',
                'Firma Elaboró': '-',
                'Firma Revisó': '-',
                Observaciones: '',
              },
            ],
      widths: [14, 42, 14, 50, 28, 28, 32],
    });
  },
};
