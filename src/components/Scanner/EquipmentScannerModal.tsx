import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Camera, 
  FlipHorizontal, 
  Search, 
  Wrench, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Upload, 
  Loader2, 
  ScanLine,
  ShieldAlert,
  Tag,
  RotateCcw,
  RotateCw,
  FileText,
  ChevronDown,
  ChevronUp,
  Cpu,
  Barcode,
  Image as ImageIcon,
  Sparkles
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Equipment, CampusLocation, PlateOcrResult } from '../../types';
import { StorageService } from '../../services/storage';
import { QrService } from '../../services/qrService';
import { processPlateRecognition, rotateImageBlob } from '../../services/plateRecognitionService';

interface EquipmentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipments: Equipment[];
  locations?: CampusLocation[];
  onSelectEquipmentForCorrective?: (equipment: Equipment) => void;
  onSelectEquipmentForPreventive?: (equipment: Equipment) => void;
  onViewEquipmentDetails?: (equipment: Equipment) => void;
  onAddNewEquipment?: (prefilledData: Partial<Equipment>) => void;
  onAddNewEquipmentWithAi?: (prefilledData: Partial<Equipment>) => void; // Compatibilidad hacia atrás
  onEquipmentIdentified?: (equipment: Equipment, action: 'view' | 'corrective' | 'preventive') => void;
  onCreateEquipment?: (prefilledData: Partial<Equipment>) => void;
}

type ScanMode = 'camera' | 'photo_ocr' | 'manual';

export const EquipmentScannerModal: React.FC<EquipmentScannerModalProps> = ({
  isOpen,
  onClose,
  equipments,
  locations = [],
  onSelectEquipmentForCorrective,
  onSelectEquipmentForPreventive,
  onViewEquipmentDetails,
  onAddNewEquipment,
  onAddNewEquipmentWithAi,
  onEquipmentIdentified,
  onCreateEquipment,
}) => {
  const [activeMode, setActiveMode] = useState<ScanMode>('camera');
  const [manualInput, setManualInput] = useState('');

  // Dispatchers para soportar tanto callbacks directos como delegados
  const handleAddNew = (prefilledData: Partial<Equipment>) => {
    onClose();
    if (typeof onAddNewEquipment === 'function') {
      onAddNewEquipment(prefilledData);
    } else if (typeof onAddNewEquipmentWithAi === 'function') {
      onAddNewEquipmentWithAi(prefilledData);
    } else if (typeof onCreateEquipment === 'function') {
      onCreateEquipment(prefilledData);
    }
  };

  const handleCorrectiveAction = (equipment: Equipment) => {
    onClose();
    if (typeof onSelectEquipmentForCorrective === 'function') {
      onSelectEquipmentForCorrective(equipment);
    } else if (typeof onEquipmentIdentified === 'function') {
      onEquipmentIdentified(equipment, 'corrective');
    }
  };

  const handlePreventiveAction = (equipment: Equipment) => {
    onClose();
    if (typeof onSelectEquipmentForPreventive === 'function') {
      onSelectEquipmentForPreventive(equipment);
    } else if (typeof onEquipmentIdentified === 'function') {
      onEquipmentIdentified(equipment, 'preventive');
    }
  };

  const handleViewDetailsAction = (equipment: Equipment) => {
    onClose();
    if (typeof onViewEquipmentDetails === 'function') {
      onViewEquipmentDetails(equipment);
    } else if (typeof onEquipmentIdentified === 'function') {
      onEquipmentIdentified(equipment, 'view');
    }
  };
  
  // Scanner state (Cámara en vivo)
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentFacingMode, setCurrentFacingMode] = useState<'environment' | 'user'>('environment');
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'fcbv-barcode-scanner-viewport';

  // OCR & Detection state
  const [lastScannedRaw, setLastScannedRaw] = useState<string | null>(null);
  const [matchedEquipment, setMatchedEquipment] = useState<Equipment | null>(null);
  const [detectedPlateInfo, setDetectedPlateInfo] = useState<PlateOcrResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [currentUploadedFile, setCurrentUploadedFile] = useState<File | null>(null);
  const [detectedAngle, setDetectedAngle] = useState<number>(0);
  const [detectionSource, setDetectionSource] = useState<'barcode' | 'ocr' | 'hybrid' | 'gemini_vision' | null>(null);
  const [showRawOcrText, setShowRawOcrText] = useState(false);

  // Campos estructurados de la etiqueta
  const [editablePlateFields, setEditablePlateFields] = useState({
    brand: '',
    model: '',
    serial: '',
    code: '',
    deviceType: '',
    specs: '',
  });

  // OCR Loading state
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrLoadingMessage, setOcrLoadingMessage] = useState('');

  // Submodo de captura para OCR (cámara en vivo para foto vs subida de archivo)
  const [ocrCaptureType, setOcrCaptureType] = useState<'camera' | 'upload'>('camera');
  const [ocrCameraActive, setOcrCameraActive] = useState(false);
  const [ocrCameraFacingMode, setOcrCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const ocrVideoRef = useRef<HTMLVideoElement | null>(null);
  const ocrStreamRef = useRef<MediaStream | null>(null);

  // Detener y limpiar cámara de códigos de barras (Html5Qrcode)
  const stopCamera = async () => {
    if (html5QrCodeRef.current && isCameraActive) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch {
        // Ignorar si ya estaba detenido
      }
      setIsCameraActive(false);
    }
  };

  // Detener y limpiar cámara dedicada de foto OCR
  const stopOcrCamera = () => {
    if (ocrStreamRef.current) {
      ocrStreamRef.current.getTracks().forEach((track) => track.stop());
      ocrStreamRef.current = null;
    }
    if (ocrVideoRef.current) {
      ocrVideoRef.current.srcObject = null;
    }
    setOcrCameraActive(false);
  };

  // Iniciar cámara dedicada de alta resolución para capturar foto de etiqueta
  const startOcrCamera = async (facing: 'environment' | 'user' = ocrCameraFacingMode) => {
    stopOcrCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      });
      ocrStreamRef.current = stream;
      if (ocrVideoRef.current) {
        ocrVideoRef.current.srcObject = stream;
        await ocrVideoRef.current.play().catch(() => {});
      }
      setOcrCameraActive(true);
    } catch (err: any) {
      console.warn('Error al activar cámara para foto OCR:', err);
      setOcrCameraActive(false);
      setCameraError('No se pudo acceder a la cámara en vivo. Puedes subir una foto de la etiqueta o verificar los permisos en el navegador.');
    }
  };

  // Cambiar entre cámara trasera y frontal en modo foto OCR
  const handleToggleOcrFacing = async () => {
    const nextFacing = ocrCameraFacingMode === 'environment' ? 'user' : 'environment';
    setOcrCameraFacingMode(nextFacing);
    if (ocrCameraActive) {
      await startOcrCamera(nextFacing);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      stopOcrCamera();
      resetScanState();
    } else {
      if (activeMode === 'camera') {
        stopOcrCamera();
        startScanner();
      } else if (activeMode === 'photo_ocr') {
        stopCamera();
        if (ocrCaptureType === 'camera' && !uploadedImagePreview) {
          startOcrCamera(ocrCameraFacingMode);
        } else {
          stopOcrCamera();
        }
      } else {
        stopCamera();
        stopOcrCamera();
      }
    }

    return () => {
      stopCamera();
      stopOcrCamera();
    };
  }, [isOpen, activeMode, currentFacingMode, ocrCaptureType, ocrCameraFacingMode, uploadedImagePreview]);

  const resetScanState = () => {
    setLastScannedRaw(null);
    setMatchedEquipment(null);
    setDetectedPlateInfo(null);
    setUploadedImagePreview(null);
    setCurrentUploadedFile(null);
    setDetectionSource(null);
    setShowRawOcrText(false);
    setEditablePlateFields({
      brand: '',
      model: '',
      serial: '',
      code: '',
      deviceType: '',
      specs: '',
    });
    setHasSearched(false);
    setManualInput('');
    setCameraError(null);
    setIsOcrLoading(false);
  };

  const startScanner = async () => {
    setCameraError(null);
    try {
      if (html5QrCodeRef.current && isCameraActive) {
        await html5QrCodeRef.current.stop();
      }

      const qrScanner = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = qrScanner;

      await qrScanner.start(
        { facingMode: currentFacingMode },
        {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleCodeDetected(decodedText);
        },
        () => {
          // Continuar buscando
        }
      );

      setIsCameraActive(true);
    } catch (err) {
      console.warn('Error al iniciar la cámara del escáner:', err);
      setIsCameraActive(false);
      setCameraError(
        'No se pudo acceder a la cámara del dispositivo. Asegúrate de otorgar permisos en el navegador o utiliza la opción de Foto de Etiqueta (OCR) o Búsqueda Manual.'
      );
    }
  };

  const handleToggleFacingMode = async () => {
    await stopCamera();
    setCurrentFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Procesamiento al detectar un código de barras o QR en vivo
  const handleCodeDetected = (rawCode: string) => {
    if (isOcrLoading) return;

    setLastScannedRaw(rawCode);
    setHasSearched(true);

    const parsed = QrService.parseScanResult(rawCode);
    const searchTarget = parsed.code || parsed.serial || rawCode;

    // Buscar en inventario de equipos
    const found = StorageService.findEquipmentByCodeOrSerial(searchTarget, equipments);
    if (found) {
      setMatchedEquipment(found);
      setDetectedPlateInfo(null);
    } else {
      setMatchedEquipment(null);
      setDetectedPlateInfo({
        detectedCode: parsed.code || rawCode,
        detectedSerial: parsed.serial || rawCode,
      });
      setEditablePlateFields(prev => ({
        ...prev,
        code: parsed.code || rawCode,
        serial: parsed.serial || rawCode,
      }));
    }
  };

  // Escaneo manual al escribir código o serial
  const handleManualSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = manualInput.trim();
    if (!query) return;

    handleCodeDetected(query);
  };

  // Procesa una imagen (capturada por cámara o subida de archivo) con el motor OCR y código de barras
  const processOcrImage = async (file: File, base64: string) => {
    setCurrentUploadedFile(file);
    setUploadedImagePreview(base64);
    setDetectedAngle(0);
    setIsOcrLoading(true);
    setOcrLoadingMessage('Iniciando lectura de etiqueta trasera con motor OCR...');
    setCameraError(null);
    setHasSearched(false);

    try {
      const { plateInfo, source, barcodeDetected, detectedAngle: autoAngle, correctedDataUrl } = await processPlateRecognition(
        file,
        base64,
        (status) => setOcrLoadingMessage(status)
      );

      if (correctedDataUrl) {
        setUploadedImagePreview(correctedDataUrl);
      }
      setDetectedAngle(autoAngle || 0);
      setDetectedPlateInfo(plateInfo);
      setDetectionSource(source);

      const initialFields = {
        brand: plateInfo.detectedBrand || '',
        model: plateInfo.detectedModel || '',
        serial: plateInfo.detectedSerial || barcodeDetected || '',
        code: plateInfo.detectedCode || barcodeDetected || '',
        deviceType: plateInfo.deviceType || 'Equipo de Infraestructura / Cómputo',
        specs: plateInfo.specsFound || '',
      };
      setEditablePlateFields(initialFields);
      setLastScannedRaw(initialFields.code || initialFields.serial || null);
      setHasSearched(true);

      // Cruzar con equipos existentes en la base de datos
      const targetSearch = initialFields.code || initialFields.serial || initialFields.model || '';
      const found = targetSearch ? StorageService.findEquipmentByCodeOrSerial(targetSearch, equipments) : undefined;

      if (found) {
        setMatchedEquipment(found);
      } else {
        setMatchedEquipment(null);
      }
    } catch (err: any) {
      console.warn('Aviso al procesar OCR de imagen:', err);
      setCameraError('No se pudo procesar la imagen con el motor OCR. Intenta con una fotografía más nítida o ingresa los datos manualmente.');
    } finally {
      setIsOcrLoading(false);
    }
  };

  // Capturar fotografía desde el visor de cámara en vivo para OCR
  const handleCapturePhotoFromOcrCamera = () => {
    const video = ocrVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Esperando a que la cámara del equipo esté enfocada y lista...');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopOcrCamera();

    const base64 = canvas.toDataURL('image/jpeg', 0.95);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `foto_etiqueta_${Date.now()}.jpg`, { type: 'image/jpeg' });
      await processOcrImage(file, base64);
    }, 'image/jpeg', 0.95);
  };

  // Capturar fotograma en vivo desde el escáner de códigos si no se detecta código de barras impreso
  const handleCaptureSnapshotFromLiveScanner = async () => {
    const video = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement | null;
    if (video && video.videoWidth && video.videoHeight) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.95);
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], `captura_en_vivo_${Date.now()}.jpg`, { type: 'image/jpeg' });
          await stopCamera();
          setActiveMode('photo_ocr');
          await processOcrImage(file, base64);
        }, 'image/jpeg', 0.95);
        return;
      }
    }
    // Si no está disponible el elemento video directo, cambiar a pestaña de foto OCR con cámara
    await stopCamera();
    setActiveMode('photo_ocr');
    setOcrCaptureType('camera');
  };

  // Análisis de fotografía cargada desde archivo o galería
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await processOcrImage(file, base64);
    };
    reader.readAsDataURL(file);
  };

  // Rotar fotografía 90° hacia la derecha y re-analizar con OCR
  const handleRotate90 = async () => {
    if (!currentUploadedFile && !uploadedImagePreview) return;
    setIsOcrLoading(true);
    setOcrLoadingMessage('Rotando imagen 90° y re-ejecutando OCR...');
    try {
      const sourceToRotate = currentUploadedFile || uploadedImagePreview!;
      const { file: rotatedFile, dataUrl: rotatedDataUrl } = await rotateImageBlob(sourceToRotate, 90);
      setCurrentUploadedFile(rotatedFile);
      setUploadedImagePreview(rotatedDataUrl);
      setDetectedAngle((prev) => (prev + 90) % 360);

      const { plateInfo, source, barcodeDetected } = await processPlateRecognition(
        rotatedFile,
        rotatedDataUrl,
        (status) => setOcrLoadingMessage(status)
      );

      setDetectedPlateInfo(plateInfo);
      setDetectionSource(source);

      const initialFields = {
        brand: plateInfo.detectedBrand || editablePlateFields.brand || '',
        model: plateInfo.detectedModel || editablePlateFields.model || '',
        serial: plateInfo.detectedSerial || barcodeDetected || editablePlateFields.serial || '',
        code: plateInfo.detectedCode || barcodeDetected || editablePlateFields.code || '',
        deviceType: plateInfo.deviceType || editablePlateFields.deviceType || 'Equipo de Infraestructura / Cómputo',
        specs: plateInfo.specsFound || editablePlateFields.specs || '',
      };
      setEditablePlateFields(initialFields);
      setLastScannedRaw(initialFields.code || initialFields.serial || null);
      setHasSearched(true);

      const targetSearch = initialFields.code || initialFields.serial || initialFields.model || '';
      const found = targetSearch ? StorageService.findEquipmentByCodeOrSerial(targetSearch, equipments) : undefined;
      setMatchedEquipment(found || null);
    } catch (err) {
      console.warn('Error al rotar y re-analizar OCR:', err);
      setCameraError('No se pudo rotar la imagen.');
    } finally {
      setIsOcrLoading(false);
    }
  };

  // Re-buscar en censo con los campos editados
  const handleReSearchWithEditedFields = () => {
    const targetSearch = editablePlateFields.code || editablePlateFields.serial || editablePlateFields.model || '';
    if (!targetSearch) return;

    setLastScannedRaw(targetSearch);
    const found = StorageService.findEquipmentByCodeOrSerial(targetSearch, equipments);
    setMatchedEquipment(found || null);
    setHasSearched(true);
  };

  // Alta Directa como Equipo Crítico usando los datos verificados del OCR
  const handleDirectCreateWithFields = () => {
    const brand = editablePlateFields.brand || detectedPlateInfo?.detectedBrand || '';
    const model = editablePlateFields.model || detectedPlateInfo?.detectedModel || '';
    const serial = editablePlateFields.serial || detectedPlateInfo?.detectedSerial || lastScannedRaw || '';
    const code = editablePlateFields.code || detectedPlateInfo?.detectedCode || lastScannedRaw || `EQ-${Date.now().toString().slice(-4)}`;
    const type = editablePlateFields.deviceType || detectedPlateInfo?.deviceType || 'Equipo';
    const specs = editablePlateFields.specs || detectedPlateInfo?.specsFound || '';

    // Sugerir frecuencia, tareas y partes estándar según el tipo de equipo
    let freq: 'mensual' | 'trimestral' | 'semestral' | 'anual' = 'trimestral';
    let cat = 'Infraestructura Tecnológica General';
    let suggestedTasks: string[] = [
      'Limpieza general exterior y de rejillas de ventilación',
      'Inspección visual de conectores y cableado',
      'Prueba de encendido y funcionamiento operativo',
    ];
    let suggestedParts: string[] = ['Fuente / Adaptador de poder', 'Cable de alimentación'];

    const lowerCombined = `${type} ${brand} ${model}`.toLowerCase();

    if (lowerCombined.includes('ups') || lowerCombined.includes('bater') || lowerCombined.includes('energ')) {
      freq = 'mensual';
      cat = 'Energía y Respaldo Eléctrico';
      suggestedTasks = [
        'Comprobación de voltaje de entrada (AC) y salida',
        'Inspección física de bornes y baterías de respaldo',
        'Prueba de transferencia a modo batería',
        'Limpieza de ventilador interno y rejillas',
      ];
      suggestedParts = ['Baterías 12V recargables', 'Fusibles de protección'];
    } else if (lowerCombined.includes('servidor') || lowerCombined.includes('server')) {
      freq = 'mensual';
      cat = 'Servidores y Data Center';
      suggestedTasks = [
        'Soplado y limpieza de módulos de ventilación y disipadores',
        'Revisión de alertas de hardware y estado de discos RAID',
        'Verificación de fuentes redundantes y voltajes',
        'Inspección de logs térmicos y de ventilación',
      ];
      suggestedParts = ['Discos duros SAS/SATA', 'Fuentes de poder redundantes', 'Memoria RAM ECC'];
    } else if (lowerCombined.includes('aire') || lowerCombined.includes('clima')) {
      freq = 'mensual';
      cat = 'Climatización y Confort Ambiental';
      suggestedTasks = [
        'Lavado y desinfección de filtros de aire evaporador',
        'Comprobación de presiones de gas refrigerante',
        'Inspección de drenaje de condensados',
        'Medición de amperaje del compresor y ventiladores',
      ];
      suggestedParts = ['Filtros de aire', 'Capacitores de arranque', 'Termostato digital'];
    } else if (
      lowerCombined.includes('pc') ||
      lowerCombined.includes('computador') ||
      lowerCombined.includes('ser5') ||
      lowerCombined.includes('mini pc') ||
      lowerCombined.includes('laptop') ||
      lowerCombined.includes('beelink')
    ) {
      freq = 'semestral';
      cat = 'Equipos de Cómputo';
      suggestedTasks = [
        'Limpieza y soplado interno del ventilador del procesador',
        'Verificación de temperaturas de CPU y estado del almacenamiento (SMART)',
        'Inspección de pasta térmica y flujo de aire',
        'Limpieza de puertos USB, HDMI, ethernet y teclado/mouse',
      ];
      suggestedParts = ['Memoria RAM DDR4/DDR5', 'Unidad SSD M.2 NVMe', 'Adaptador 19V'];
    } else if (lowerCombined.includes('router') || lowerCombined.includes('switch') || lowerCombined.includes('red')) {
      freq = 'trimestral';
      cat = 'Redes y Telecomunicaciones';
      suggestedTasks = [
        'Limpieza de puertos RJ-45 / SFP y rejillas de ventilación',
        'Verificación de LEDs de estado, PoE y enlaces activos',
        'Revisión de fijación en rack y peinado de patch cords',
        'Prueba de temperatura y latencia de red',
      ];
      suggestedParts = ['Patch cords Cat6/Cat6A', 'Transceivers SFP', 'Transformador de corriente'];
    } else if (lowerCombined.includes('ap') || lowerCombined.includes('access point') || lowerCombined.includes('wifi')) {
      freq = 'trimestral';
      cat = 'Redes Inalámbricas (Wi-Fi)';
      suggestedTasks = [
        'Limpieza exterior del chasis y antenas del Access Point',
        'Verificación de alimentación PoE e integridad del conector RJ-45',
        'Inspección de anclaje a cielo raso / pared',
        'Prueba de cobertura y calidad de señal Wi-Fi',
      ];
      suggestedParts = ['Inyector PoE', 'Cable patch Cat6'];
    }

    const prefilledDraft: Partial<Equipment> = {
      code,
      name: `${type} ${brand} ${model}`.trim() || 'Nuevo Equipo Crítico',
      brand,
      model,
      serial,
      frequency: freq,
      parts: suggestedParts,
      maintenanceTasks: suggestedTasks,
      observations: [
        `[Categoría SGC]: ${cat}`,
        specs ? `[Especificaciones de Etiqueta OCR]: ${specs}` : '',
        'Identificado mediante Reconocimiento OCR de Etiqueta Trasera.',
      ].filter(Boolean).join('\n\n'),
      status: 'activo',
    };

    handleAddNew(prefilledDraft);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header institucional */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">Escáner de Equipos Críticos</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  OCR de Etiquetas
                </span>
              </div>
              <p className="text-xs text-slate-400">Lectura de Etiquetas Traseras, Seriales, QR y Códigos de Barras</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de modo de escaneo */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveMode('camera');
              resetScanState();
            }}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              activeMode === 'camera'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Cámara en Vivo (QR/Barras)
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveMode('photo_ocr');
              stopCamera();
              resetScanState();
            }}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              activeMode === 'photo_ocr'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            Foto de Etiqueta (OCR)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('manual');
              stopCamera();
              resetScanState();
            }}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              activeMode === 'manual'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Búsqueda Manual
          </button>
        </div>

        {/* Área del visor / interacción */}
        <div className="p-4 sm:p-6 space-y-4">
          
          {/* MODO 1: Cámara en Vivo */}
          {activeMode === 'camera' && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square max-h-[290px] w-full flex items-center justify-center border-2 border-slate-800 shadow-inner">
                {/* HTML5 QRCode Viewport */}
                <div id={scannerContainerId} className="w-full h-full object-cover" />

                {/* Guía visual */}
                {isCameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-52 h-52 border-2 border-indigo-400/80 rounded-2xl relative shadow-lg">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-500 -mt-1 -ml-1 rounded-tl" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-500 -mt-1 -mr-1 rounded-tr" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-500 -mb-1 -ml-1 rounded-bl" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-500 -mb-1 -mr-1 rounded-br" />
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <span className="mt-3 text-[11px] text-white/90 bg-slate-900/80 px-3 py-1 rounded-full font-medium backdrop-blur-xs">
                      Apunta al código QR o código de barras
                    </span>
                  </div>
                )}

                {/* Mensaje de error de cámara */}
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center text-rose-300">
                    <AlertTriangle className="w-9 h-9 text-rose-500 mb-2" />
                    <p className="text-xs font-semibold text-rose-200 mb-3">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => setActiveMode('photo_ocr')}
                      className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-500"
                    >
                      Probar Foto de Etiqueta (OCR)
                    </button>
                  </div>
                )}
              </div>

              {/* Botón para cambiar cámara (frontal / trasera) y acceso rápido a Foto OCR */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 px-1">
                <div className="flex items-center gap-2">
                  <span>Cámara: {currentFacingMode === 'environment' ? 'Trasera (Recomendada)' : 'Frontal'}</span>
                  <button
                    type="button"
                    onClick={handleToggleFacingMode}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                    Girar
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCaptureSnapshotFromLiveScanner}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold transition-colors shadow-xs"
                  title="Captura el fotograma actual para extraer Modelo, Serial y Marca mediante OCR"
                >
                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
                  Tomar Foto para OCR
                </button>
              </div>
            </div>
          )}

          {/* MODO 2: Foto de Etiqueta Trasera (Reconocimiento OCR de Alta Precisión con Cámara o Archivo) */}
          {activeMode === 'photo_ocr' && (
            <div className="space-y-4">
              {!uploadedImagePreview ? (
                <div className="space-y-3">
                  {/* Selector de origen: Tomar Foto con Cámara vs Subir Archivo */}
                  <div className="flex items-center justify-center gap-2 p-1 bg-slate-100 rounded-xl max-w-sm mx-auto text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setOcrCaptureType('camera');
                        startOcrCamera(ocrCameraFacingMode);
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                        ocrCaptureType === 'camera'
                          ? 'bg-white text-indigo-700 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Tomar Foto (Cámara)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopOcrCamera();
                        setOcrCaptureType('upload');
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                        ocrCaptureType === 'upload'
                          ? 'bg-white text-indigo-700 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Subir Archivo
                    </button>
                  </div>

                  {/* OPCIÓN A: Visor de Cámara en vivo para tomar la foto */}
                  {ocrCaptureType === 'camera' && (
                    <div className="space-y-3">
                      <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 max-h-[300px] w-full flex items-center justify-center border-2 border-slate-800 shadow-inner">
                        <video
                          ref={ocrVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />

                        {/* Guía visual con marco enfocado para la placa/etiqueta */}
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                          <div className="w-64 h-36 border-2 border-dashed border-indigo-400/90 rounded-2xl relative shadow-lg bg-slate-900/10">
                            <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-4 border-l-4 border-indigo-500 -mt-1 -ml-1 rounded-tl" />
                            <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-4 border-r-4 border-indigo-500 -mt-1 -mr-1 rounded-tr" />
                            <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-4 border-l-4 border-indigo-500 -mb-1 -ml-1 rounded-bl" />
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-4 border-r-4 border-indigo-500 -mb-1 -mr-1 rounded-br" />
                          </div>
                          <span className="mt-2 text-[11px] text-white/95 bg-slate-900/85 px-3 py-1 rounded-full font-medium backdrop-blur-xs shadow-xs text-center">
                            Enfoca la placa o etiqueta trasera (Modelo, Serial S/N, Marca)
                          </span>
                        </div>

                        {cameraError && (
                          <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center text-rose-300">
                            <AlertTriangle className="w-8 h-8 text-rose-500 mb-2" />
                            <p className="text-xs font-semibold text-rose-200 mb-3">{cameraError}</p>
                            <button
                              type="button"
                              onClick={() => {
                                stopOcrCamera();
                                setOcrCaptureType('upload');
                              }}
                              className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-500"
                            >
                              Subir Foto desde Archivo
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Botonera de control: Disparador y Giro de cámara */}
                      <div className="flex items-center justify-between gap-2 px-1">
                        <button
                          type="button"
                          onClick={handleToggleOcrFacing}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors shadow-xs"
                          title="Alternar entre cámara trasera y frontal"
                        >
                          <FlipHorizontal className="w-3.5 h-3.5" />
                          <span>Girar Cámara</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCapturePhotoFromOcrCamera}
                          disabled={isOcrLoading}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
                        >
                          <Camera className="w-4 h-4 text-white" />
                          <span>Capturar Foto para OCR</span>
                        </button>

                        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer transition-colors shadow-xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Archivo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* OPCIÓN B: Subida manual de archivo o galería */}
                  {ocrCaptureType === 'upload' && (
                    <div className="p-6 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 rounded-2xl text-center transition-colors">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                        <FileText className="w-6 h-6 text-indigo-600" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mb-1">
                        Reconocimiento OCR de Etiquetas Traseras
                      </h3>
                      <p className="text-xs text-slate-600 max-w-md mx-auto mb-4 leading-relaxed">
                        Selecciona una foto clara de la etiqueta técnica trasera o sticker del equipo. El motor OCR reconocerá automáticamente el <strong>Modelo</strong>, <strong>Marca</strong>, <strong>Número de Serie (S/N)</strong> y <strong>Especificaciones Técnicas</strong>.
                      </p>

                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md transition-all">
                          <Upload className="w-4 h-4" />
                          Seleccionar Archivo de Foto
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            setOcrCaptureType('camera');
                            startOcrCamera(ocrCameraFacingMode);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-all"
                        >
                          <Camera className="w-4 h-4 text-indigo-600" />
                          Usar Cámara en Vivo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 animate-in fade-in duration-200">
                  {/* Vista previa de la foto escaneada */}
                  <div className="p-3 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center gap-3 border border-slate-800">
                    <div className="relative w-28 h-28 shrink-0 bg-slate-950 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center">
                      <img
                        src={uploadedImagePreview}
                        alt="Etiqueta escaneada"
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute bottom-1 right-1 text-[9px] bg-slate-900/90 text-slate-200 px-1.5 py-0.5 rounded font-mono">
                        Etiqueta
                      </span>
                    </div>

                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                          {detectionSource === 'gemini_vision' ? (
                            <Sparkles className="w-4 h-4 shrink-0 text-amber-400 animate-pulse" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                          )}
                          <span>
                            {detectionSource === 'gemini_vision'
                              ? 'Lectura Asistida por IA Vision (Alta Precisión)'
                              : detectionSource === 'hybrid'
                              ? 'Detección Híbrida: Código de Barras + IA/OCR'
                              : detectionSource === 'barcode'
                              ? 'Código de Barras Decodificado'
                              : 'Texto y Parámetros Leídos por OCR'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setUploadedImagePreview(null);
                              setCurrentUploadedFile(null);
                              setOcrCaptureType('camera');
                              startOcrCamera(ocrCameraFacingMode);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg cursor-pointer transition-colors shadow-xs"
                            title="Tomar otra foto con la cámara del equipo"
                          >
                            <Camera className="w-3 h-3" />
                            <span>Tomar Otra</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleRotate90}
                            disabled={isOcrLoading}
                            className="inline-flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 border border-slate-700 px-2.5 py-1 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                            title="Girar imagen 90° hacia la derecha y re-analizar con OCR"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Rotar 90°</span>
                          </button>

                          <label className="inline-flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg cursor-pointer transition-colors shrink-0">
                            <RotateCcw className="w-3 h-3" />
                            <span>Cambiar</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-300">
                        {editablePlateFields.brand || editablePlateFields.model
                          ? `Identificado: ${editablePlateFields.brand || ''} ${editablePlateFields.model || ''} - Serial: ${editablePlateFields.serial || 'Sin serial'}`
                          : 'Lectura OCR completada. Puedes revisar y ajustar los campos detectados a continuación.'}
                      </p>

                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {detectedAngle > 0 && (
                          <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                            <RotateCw className="w-2.5 h-2.5" />
                            Ángulo {detectedAngle}°
                          </span>
                        )}
                        {editablePlateFields.serial && (
                          <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
                            S/N: {editablePlateFields.serial}
                          </span>
                        )}
                        {editablePlateFields.model && (
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">
                            Mod: {editablePlateFields.model}
                          </span>
                        )}
                        {editablePlateFields.brand && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
                            Marca: {editablePlateFields.brand}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ficha editable con los campos extraídos por OCR */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-700 font-bold border-b border-slate-200 pb-1.5">
                      <span className="flex items-center gap-1.5 text-indigo-700">
                        <Tag className="w-3.5 h-3.5" />
                        Datos Extraídos por OCR (Verificables):
                      </span>
                      <button
                        type="button"
                        onClick={handleReSearchWithEditedFields}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold underline"
                      >
                        Re-buscar en Censo
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Marca:</label>
                        <input
                          type="text"
                          value={editablePlateFields.brand}
                          onChange={(e) => setEditablePlateFields(prev => ({ ...prev, brand: e.target.value }))}
                          placeholder="Ej. Cisco, D-Link, Dell"
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Modelo:</label>
                        <input
                          type="text"
                          value={editablePlateFields.model}
                          onChange={(e) => setEditablePlateFields(prev => ({ ...prev, model: e.target.value }))}
                          placeholder="Ej. DIR-600, Catalyst 2960"
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Número de Serie (S/N):</label>
                        <input
                          type="text"
                          value={editablePlateFields.serial}
                          onChange={(e) => setEditablePlateFields(prev => ({ ...prev, serial: e.target.value }))}
                          placeholder="Ej. PV6B196005576"
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Código Activo / P/N:</label>
                        <input
                          type="text"
                          value={editablePlateFields.code}
                          onChange={(e) => setEditablePlateFields(prev => ({ ...prev, code: e.target.value }))}
                          placeholder="Ej. SW-01 o PV6B196005576"
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Tipo de Equipo:</label>
                        <input
                          type="text"
                          value={editablePlateFields.deviceType}
                          onChange={(e) => setEditablePlateFields(prev => ({ ...prev, deviceType: e.target.value }))}
                          placeholder="Ej. Router Inalámbrico / Switch / Mini PC"
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {editablePlateFields.specs && (
                      <div className="pt-1.5 border-t border-slate-200">
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Especificaciones / Alimentación / MAC:</label>
                        <input
                          type="text"
                          value={editablePlateFields.specs}
                          onChange={(e) => setEditablePlateFields(prev => ({ ...prev, specs: e.target.value }))}
                          placeholder="Ej. MAC: 002401C8BB50 | Alimentación: 5V/1.2A"
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-[11px] text-slate-700 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    {/* Texto OCR sin procesar (plegable) */}
                    {detectedPlateInfo?.rawText && (
                      <div className="pt-1 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => setShowRawOcrText(!showRawOcrText)}
                          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-medium"
                        >
                          {showRawOcrText ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          <span>{showRawOcrText ? 'Ocultar texto sin procesar' : 'Ver texto completo reconocido por OCR'}</span>
                        </button>
                        {showRawOcrText && (
                          <pre className="mt-1.5 p-2 bg-slate-100 border border-slate-300 rounded-lg text-[10px] font-mono text-slate-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                            {detectedPlateInfo.rawText}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODO 3: Búsqueda Manual */}
          {activeMode === 'manual' && (
            <form onSubmit={handleManualSearch} className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Ingresa el Código de Activo o Número de Serie del Equipo:
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Ej. SW-01, AP-02, FOC1925B0YV, PV6B196005576"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono uppercase"
                    autoFocus
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
                >
                  Buscar
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Puedes digitar manualmente o utilizar una pistola lectora de código de barras conectada por USB/Bluetooth.
              </p>
            </form>
          )}

          {/* Indicador de progreso de OCR */}
          {isOcrLoading && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3 animate-pulse">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
              <div className="text-xs text-indigo-900 font-medium">
                {ocrLoadingMessage || 'Procesando lectura con motor OCR (Tesseract.js)...'}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* RESULTADOS DEL ESCANEO: ENCONTRADO vs NO ENCONTRADO */}
          {/* ======================================================== */}
          {hasSearched && !isOcrLoading && (
            <div className="pt-2 border-t border-slate-200 space-y-3">
              
              {/* CASO A: EQUIPO EXISTENTE EN EL INVENTARIO */}
              {matchedEquipment ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded">
                            {matchedEquipment.code}
                          </span>
                          <span className="text-xs font-bold text-emerald-950">{matchedEquipment.name}</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          Ubicación: <strong>{matchedEquipment.location}</strong> | Frecuencia: <strong>{matchedEquipment.frequency}</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-800 bg-white/70 p-2.5 rounded-xl border border-emerald-100">
                    <div><strong>Marca:</strong> {matchedEquipment.brand}</div>
                    <div><strong>Modelo:</strong> {matchedEquipment.model}</div>
                    <div><strong>Serial:</strong> {matchedEquipment.serial || 'Sin serial'}</div>
                    <div><strong>Estado:</strong> {matchedEquipment.status === 'activo' ? '✓ Activo en censo' : '⛔ Dado de baja'}</div>
                  </div>

                  {/* Acciones para equipo existente */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleCorrectiveAction(matchedEquipment)}
                      className="px-3 py-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      Registrar Mantenimiento Correctivo
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePreventiveAction(matchedEquipment)}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Wrench className="w-4 h-4 text-emerald-400" />
                      Mantenimiento Preventivo
                    </button>
                  </div>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => handleViewDetailsAction(matchedEquipment)}
                      className="text-[11px] text-emerald-800 underline hover:text-emerald-950 font-medium"
                    >
                      Ver Ficha Técnica y Partes del Equipo
                    </button>
                  </div>
                </div>
              ) : (
                /* CASO B: EQUIPO NO ENCONTRADO EN LA BASE DE DATOS */
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-amber-950">
                        Equipo No Registrado en el Censo FCBV
                      </h4>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        {editablePlateFields.brand || editablePlateFields.model ? (
                          <>
                            Etiqueta OCR identificada: <strong className="font-semibold text-amber-950">{editablePlateFields.brand} {editablePlateFields.model}</strong>
                            {editablePlateFields.serial && (
                              <span> | S/N: <strong className="font-mono text-amber-950">{editablePlateFields.serial}</strong></span>
                            )}
                          </>
                        ) : (
                          <>
                            Código / Serial detectado: <strong className="font-mono">{lastScannedRaw || editablePlateFields.serial || 'Desconocido'}</strong>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-amber-900 bg-white/80 p-3 rounded-xl border border-amber-200/80 space-y-1.5">
                    <p className="font-semibold text-slate-800">
                      El equipo no figura en la base de datos actual. Puedes registrarlo en el censo con los datos extraídos por el OCR:
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <div><strong>Equipo:</strong> {editablePlateFields.deviceType || 'Equipo Tecnológico'}</div>
                      <div><strong>Marca/Modelo:</strong> {editablePlateFields.brand || 'Genérico'} {editablePlateFields.model}</div>
                      <div><strong>Serial:</strong> {editablePlateFields.serial || 'No especificado'}</div>
                      <div><strong>Código:</strong> {editablePlateFields.code || lastScannedRaw || 'Automático'}</div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    {/* Botón principal: Dar de alta con datos extraídos por OCR */}
                    <button
                      type="button"
                      onClick={handleDirectCreateWithFields}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Dar de Alta como Equipo Crítico con estos Datos OCR
                    </button>

                    {/* Registro manual en blanco */}
                    <button
                      type="button"
                      onClick={() => {
                        const basicDraft: Partial<Equipment> = {
                          code: lastScannedRaw || editablePlateFields.code || `EQ-${Date.now().toString().slice(-4)}`,
                          serial: editablePlateFields.serial || lastScannedRaw || '',
                          brand: editablePlateFields.brand || '',
                          model: editablePlateFields.model || '',
                          status: 'activo',
                        };
                        handleAddNew(basicDraft);
                      }}
                      className="w-full px-3 py-1.5 text-slate-500 hover:text-slate-800 text-[11px] font-medium transition-colors"
                    >
                      Registrar en formulario manual en blanco
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Sistema de Gestión de Calidad (SGC) - FCBV</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-slate-600 hover:text-slate-900 font-medium"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
