import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Tesseract from 'tesseract.js';
import type { PlateOcrResult } from '../types';

/**
 * Rota una imagen en el navegador usando un elemento HTMLCanvasElement.
 */
export async function rotateImageBlob(
  imageSource: File | Blob | string,
  degrees: number
): Promise<{ file: File; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const normalizedAngle = ((degrees % 360) + 360) % 360;
      const is90or270 = normalizedAngle === 90 || normalizedAngle === 270;
      const canvas = document.createElement('canvas');
      canvas.width = is90or270 ? img.height : img.width;
      canvas.height = is90or270 ? img.width : img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((normalizedAngle * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create rotated blob'));
            return;
          }
          const rotatedFile = new File([blob], `rotated_${normalizedAngle}.jpg`, {
            type: 'image/jpeg',
          });
          resolve({ file: rotatedFile, dataUrl });
        },
        'image/jpeg',
        0.95
      );
    };
    img.onerror = (e) => reject(e);

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

/**
 * Genera una versión con contraste mejorado y escala de grises para facilitar OCR y lectura de códigos de barras.
 */
export async function enhanceImageForScanning(
  imageSource: File | Blob | string
): Promise<{ file: File; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxDim = 1920;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      // Grayscale + High contrast + slight brightness boost
      ctx.filter = 'contrast(170%) grayscale(100%) brightness(108%)';
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Failed to create enhanced blob'));
          const enhancedFile = new File([blob], 'enhanced_scan.jpg', { type: 'image/jpeg' });
          resolve({ file: enhancedFile, dataUrl });
        },
        'image/jpeg',
        0.95
      );
    };
    img.onerror = (e) => reject(e);

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

/**
 * Genera una versión con colores invertidos (negativo) y alto contraste.
 * Es crucial para etiquetas con texto blanco o metálico sobre fondo negro/oscuro
 * (muy frecuente en Cisco, Beelink, Dell, HP, switches y routers).
 */
export async function createInvertedContrastImage(
  imageSource: File | Blob | string
): Promise<{ file: File; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxDim = 1920;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      ctx.filter = 'invert(100%) contrast(180%) grayscale(100%) brightness(105%)';
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Failed to create inverted blob'));
          const invertedFile = new File([blob], 'inverted_scan.jpg', { type: 'image/jpeg' });
          resolve({ file: invertedFile, dataUrl });
        },
        'image/jpeg',
        0.95
      );
    };
    img.onerror = (e) => reject(e);

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

/**
 * Limpia y normaliza el texto extraído por el OCR para compensar confusiones típicas de caracteres
 * (por ejemplo S/N leído como 5/N o S/N; o Mode| como Model).
 */
export function normalizeOcrText(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // Normalizar separadores y dos puntos mal leídos
  text = text.replace(/([A-Za-z0-9])\s*[:;=.]\s*/g, '$1: ');

  // Normalizar prefijos de Serial Number
  text = text.replace(/\b5[\/.]?N\b/gi, 'S/N');
  text = text.replace(/\bS[\/|.]N\b/gi, 'S/N');
  text = text.replace(/\bS[\/.]?N[:;\-.]*\s*/gi, 'S/N: ');
  text = text.replace(/\bSN[:;\-.]*\s*/gi, 'SN: ');
  text = text.replace(/\bSeria[l|1][:;\-.]*\s*/gi, 'Serial: ');
  text = text.replace(/\bSerial\s*N[o0]\.?[:;\-.]*\s*/gi, 'Serial No: ');
  text = text.replace(/\bService\s*Tag[:;\-.]*\s*/gi, 'Service Tag: ');
  text = text.replace(/\bST[:;\-.]*\s*/gi, 'ST: ');

  // Normalizar prefijos de Modelo
  text = text.replace(/\bMode[l|1|t][:;\-.]*\s*/gi, 'Model: ');
  text = text.replace(/\bM[\/|.]N[:;\-.]*\s*/gi, 'M/N: ');
  text = text.replace(/\bMod\.?[:;\-.]*\s*/gi, 'Mod: ');
  text = text.replace(/\bProduct\s*N[o0]\.?[:;\-.]*\s*/gi, 'Product No: ');
  text = text.replace(/\bItem\s*N[o0]\.?[:;\-.]*\s*/gi, 'Item No: ');

  return text;
}

/**
 * Normaliza y extrae campos técnicos de cómputo, red e infraestructura a partir de texto OCR o transcripción.
 */
export function extractTechnicalFieldsFromText(rawText: string): PlateOcrResult {
  const originalText = rawText || '';
  const text = normalizeOcrText(originalText);
  let detectedBrand = '';
  let detectedModel = '';
  let detectedSerial = '';
  let detectedMac = '';
  let detectedCode = '';
  let deviceType = '';
  const specs: string[] = [];

  // 1. Detección de Marca conocida (fabricantes comunes en infraestructura educativa y tecnológica)
  const brands = [
    { name: 'Beelink', regex: /\b(beelink|ser\d*|ser\s*pro|sei\d*|mini\s*s\d*|eq\d+|u59|gk55|t4\s*pro)\b/i },
    { name: 'Minisforum', regex: /\b(minisforum|nab\d+|um\d+|em\d+|venus|neptune|npb\d+)\b/i },
    { name: 'Intel', regex: /\b(intel(?:\s*nuc)?|nuc\d+|compute\s*stick)\b/i },
    { name: 'AMD', regex: /\b(amd(?:\s*ryzen)?)\b/i },
    { name: 'D-Link', regex: /\b(d-?link|dir-\d+|des-\d+|dgs-\d+|dap-\d+|dwr-\d+)\b/i },
    { name: 'Cisco', regex: /\b(cisco(?:\s*systems)?|catalyst|meraki|ironport|webex)\b/i },
    { name: 'TP-Link', regex: /\b(tp-?link|archer\s*[a-z0-9]+|omada|deco\s*[a-z0-9]+)\b/i },
    { name: 'MikroTik', regex: /\b(mikrotik|routerboard|cloud\s*router)\b/i },
    { name: 'Ubiquiti', regex: /\b(ubiquiti|unifi|u6|edgerouter|edgeswitch|nanostation|amplifi)\b/i },
    { name: 'Aruba', regex: /\b(aruba|hpe\s*aruba)\b/i },
    { name: 'Netgear', regex: /\b(netgear|prosafe|nighthawk)\b/i },
    { name: 'Linksys', regex: /\b(linksys|velop)\b/i },
    { name: 'Fortinet', regex: /\b(fortinet|fortigate|fortiswitch|fortiap)\b/i },
    { name: 'Sophos', regex: /\b(sophos|xg\s*firewall)\b/i },
    { name: 'SonicWall', regex: /\b(sonicwall|tz\d+)\b/i },
    { name: 'WatchGuard', regex: /\b(watchguard|firebox)\b/i },
    { name: 'Huawei', regex: /\b(huawei|quidway|echolife)\b/i },
    { name: 'APC', regex: /\b(apc(?:\s*by\s*schneider)?|schneider\s*electric|smart-?ups|back-?ups|surt\d+|smt\d+)\b/i },
    { name: 'Tripp Lite', regex: /\b(tripp\s*lite|smartpro|omnisvs)\b/i },
    { name: 'Forza', regex: /\b(forza(?:\s*power)?|nt-\d+|sl-\d+)\b/i },
    { name: 'CyberPower', regex: /\b(cyberpower)\b/i },
    { name: 'Eaton', regex: /\b(eaton|powerware)\b/i },
    { name: 'Vertiv', regex: /\b(vertiv|liebert)\b/i },
    { name: 'Dell', regex: /\b(dell(?:\s*inc\.?)?|poweredge|optiplex|precision|wyse|latitude|inspiron|alienware)\b/i },
    { name: 'HP', regex: /\b(hp|hewlett[\s-]*packard|hpe|proliant|prodesk|elitedesk|z2|zbook|laserjet|probook)\b/i },
    { name: 'Lenovo', regex: /\b(lenovo|thinkcentre|thinksystem|thinkpad|ideacentre|system\s*x)\b/i },
    { name: 'IBM', regex: /\b(ibm|bladecenter)\b/i },
    { name: 'ASUS', regex: /\b(asus|asustek|vivomini|expertcenter|rog)\b/i },
    { name: 'Acer', regex: /\b(acer|veriton|aspire)\b/i },
    { name: 'MSI', regex: /\b(msi|cubi|pro\s*dp)\b/i },
    { name: 'Gigabyte', regex: /\b(gigabyte|brix|aorus)\b/i },
    { name: 'Apple', regex: /\b(apple(?:\s*inc\.?)?|mac\s*mini|macbook|imac|mac\s*pro|mac\s*studio)\b/i },
    { name: 'Geekom', regex: /\b(geekom|mini\s*it\d+)\b/i },
    { name: 'Chuwi', regex: /\b(chuwi|herobox|larkbox)\b/i },
    { name: 'GMKtec', regex: /\b(gmktec|nucbox)\b/i },
    { name: 'Epson', regex: /\b(epson|powerlite|ecotank|workforce|l\d{3,4})\b/i },
    { name: 'Canon', regex: /\b(canon|imageclass|pixma|imageprograf)\b/i },
    { name: 'Kyocera', regex: /\b(kyocera|ecosys|taskalfa)\b/i },
    { name: 'Brother', regex: /\b(brother|dcp-\d+|hl-\d+|mfc-\d+)\b/i },
    { name: 'Ricoh', regex: /\b(ricoh|aficio)\b/i },
    { name: 'Xerox', regex: /\b(xerox|phaser|workcentre|versalink)\b/i },
    { name: 'Konica Minolta', regex: /\b(konica\s*minolta|bizhub)\b/i },
    { name: 'Lexmark', regex: /\b(lexmark)\b/i },
    { name: 'Zebra', regex: /\b(zebra|gk\d{3}|zd\d{3})\b/i },
    { name: 'Honeywell', regex: /\b(honeywell)\b/i },
    { name: 'Hikvision', regex: /\b(hikvision|ezviz|ds-\d+)\b/i },
    { name: 'Dahua', regex: /\b(dahua|imou)\b/i },
    { name: 'Uniview', regex: /\b(uniview|unv)\b/i },
    { name: 'Axis', regex: /\b(axis\s*communications)\b/i },
    { name: 'LG', regex: /\b(lg(?:\s*electronics)?|goldstar)\b/i },
    { name: 'Samsung', regex: /\b(samsung)\b/i },
    { name: 'Sony', regex: /\b(sony)\b/i },
    { name: 'BenQ', regex: /\b(benq)\b/i },
    { name: 'ViewSonic', regex: /\b(viewsonic)\b/i },
    { name: 'Optoma', regex: /\b(optoma)\b/i },
    { name: 'Promethean', regex: /\b(promethean|activpanel)\b/i },
    { name: 'Carrier', regex: /\b(carrier)\b/i },
    { name: 'York', regex: /\b(york)\b/i },
    { name: 'Trane', regex: /\b(trane)\b/i },
    { name: 'Daikin', regex: /\b(daikin)\b/i },
    { name: 'Midea', regex: /\b(midea)\b/i },
  ];

  for (const b of brands) {
    if (b.regex.test(text) || b.regex.test(originalText)) {
      detectedBrand = b.name;
      break;
    }
  }

  // Si no se encontró en la lista, buscar en las primeras 3 líneas (cabecera típica de placa de fabricante)
  if (!detectedBrand) {
    const lines = originalText.split('\n').map((l) => l.trim()).filter((l) => l.length > 2);
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      for (const b of brands) {
        if (b.regex.test(lines[i])) {
          detectedBrand = b.name;
          break;
        }
      }
      if (detectedBrand) break;
    }
  }

  // Si aún no se encontró, buscar etiquetas explícitas "Brand:", "Marca:", "Fabricante:"
  if (!detectedBrand) {
    const brandMatch = text.match(
      /(?:brand|marca|fabricante|manufacturer|mfg|made\s*by)[:\s=]*([A-Za-z0-9\-_\s]{2,20})(?:\r|\n|$)/i
    );
    if (brandMatch) {
      detectedBrand = brandMatch[1].trim();
    }
  }

  // 2. Detección de Modelo
  // Ejemplos: "Model: SER5", "Model: DIR-600", "M/N: WS-C2960X-24TD-L", "Model No: U6-Pro", "MOD: ..."
  const modelMatch = text.match(
    /(?:model(?:o)?|m\/n|model\s*no\.?|mod\.?|item\s*no\.?|product\s*no\.?|regulatory\s*model|rmn|p\/n\s*model|series|type|tipo)[:\s=]+([A-Za-z0-9\-._/]+(?:\s+[A-Za-z0-9\-._/]+)?)/i
  );
  if (modelMatch) {
    let candidate = modelMatch[1].trim();
    candidate = candidate.replace(/\b(made|china|taiwan|input|output|rohs|ce|fcc|can|rating|sn|s\/n)\b.*/i, '').trim();
    if (candidate.length >= 2) {
      detectedModel = candidate;
    }
  }

  // Refinamiento de submodelo o patrones específicos comunes
  // Soporta SER, SER5, SER5 Pro, SER6, SER7, etc.
  const serMatch = text.match(/\b(SER\s*\d*(?:\s*(?:PRO|MAX|PLUS))?(?:-[A-Za-z0-9\-_/]+)?)\b/i);
  if (serMatch) {
    const rawSer = serMatch[1].toUpperCase().trim();
    if (/SER5\s*PRO/i.test(originalText) || /SER5\s*PRO/i.test(text)) {
      detectedModel = 'SER5 Pro';
    } else if (rawSer === 'SER' && (/SER\s*5/i.test(originalText) || /SER5/i.test(originalText))) {
      detectedModel = 'SER5 Pro';
    } else if (rawSer.length > 0) {
      detectedModel = rawSer;
    }
    if (!detectedBrand) detectedBrand = 'Beelink';
    if (!deviceType) deviceType = 'Mini PC / Computador Compacto';
  } else if (/^SER$/i.test(detectedModel) || /^SER\s*5/i.test(detectedModel)) {
    if (/SER5\s*PRO/i.test(originalText) || /SER5\s*PRO/i.test(text)) {
      detectedModel = 'SER5 Pro';
    }
    if (!detectedBrand) detectedBrand = 'Beelink';
    if (!deviceType) deviceType = 'Mini PC / Computador Compacto';
  } else {
    // Mini PCs y NUCs
    const miniPcMatch = text.match(/\b(EQ\d+|SEi\d+|Mini\s*S\d*|GK\d+|U59|NAB\d+|UM\d+|EM\d+|NPB\d+|NUC\d+[A-Za-z0-9\-]*)\b/i);
    if (miniPcMatch) {
      detectedModel = miniPcMatch[1].toUpperCase();
      if (!detectedBrand) {
        if (/NUC/i.test(detectedModel)) detectedBrand = 'Intel';
        else if (/NAB|UM|EM|NPB/i.test(detectedModel)) detectedBrand = 'Minisforum';
        else detectedBrand = 'Beelink';
      }
    }

    // Cisco
    const wsMatch = text.match(/\b(WS-C\d+[A-Za-z0-9\-]+|C9\d{3}[A-Za-z0-9\-]*|SG\d{3}-[A-Za-z0-9\-]+|CBS\d{3}-[A-Za-z0-9\-]+|ISR\d{4}|AIR-[A-Za-z0-9\-]+)\b/i);
    if (wsMatch) {
      detectedModel = wsMatch[1].toUpperCase();
      if (!detectedBrand) detectedBrand = 'Cisco';
    }

    // D-Link
    const dirMatch = text.match(/\b(DIR-\d+[A-Za-z0-9]*|DES-\d+[A-Za-z0-9]*|DGS-\d+[A-Za-z0-9]*|DAP-\d+[A-Za-z0-9]*|DWR-\d+[A-Za-z0-9]*)\b/i);
    if (dirMatch) {
      detectedModel = dirMatch[1].toUpperCase();
      if (!detectedBrand) detectedBrand = 'D-Link';
    }

    // TP-Link
    const tplinkMatch = text.match(/\b(Archer\s+[A-Za-z0-9]+|TL-[A-Za-z0-9\-]+|Deco\s+[A-Za-z0-9]+|EAP\d+[A-Za-z0-9\-]*|Omada\s+[A-Za-z0-9]+)\b/i);
    if (tplinkMatch) {
      detectedModel = tplinkMatch[1];
      if (!detectedBrand) detectedBrand = 'TP-Link';
    }

    // Ubiquiti
    const u6Match = text.match(/\b(U6-(?:Pro|Lite|LR|Mesh|Enterprise|Plus)|UAP-[A-Za-z0-9\-]+|USW-[A-Za-z0-9\-]+|ER-[A-Za-z0-9\-]+|UDM-[A-Za-z0-9\-]+|NanoStation\s*[A-Za-z0-9\-]+|Rocket\s*[A-Za-z0-9\-]+)\b/i);
    if (u6Match) {
      detectedModel = u6Match[1];
      if (!detectedBrand) detectedBrand = 'Ubiquiti';
    }

    // Dell
    const optiMatch = text.match(/\b(OptiPlex\s*\d+[A-Za-z0-9]*|PowerEdge\s*[A-Za-z0-9]+|Latitude\s*\d+[A-Za-z0-9]*|Precision\s*\d+[A-Za-z0-9]*|Wyse\s*\d+[A-Za-z0-9]*)\b/i);
    if (optiMatch) {
      detectedModel = optiMatch[1];
      if (!detectedBrand) detectedBrand = 'Dell';
    }

    // HP
    const hpMatch = text.match(/\b(ProDesk\s*\d+[A-Za-z0-9]*|EliteDesk\s*\d+[A-Za-z0-9]*|ProLiant\s*[A-Za-z0-9\-]+|LaserJet\s*[A-Za-z0-9\-]+|ZBook\s*[A-Za-z0-9\-]+|ProBook\s*[A-Za-z0-9\-]+)\b/i);
    if (hpMatch) {
      detectedModel = hpMatch[1];
      if (!detectedBrand) detectedBrand = 'HP';
    }

    // Lenovo
    const lenovoMatch = text.match(/\b(ThinkCentre\s*[A-Za-z0-9\-]+|ThinkSystem\s*[A-Za-z0-9\-]+|ThinkPad\s*[A-Za-z0-9\-]+|IdeaCentre\s*[A-Za-z0-9\-]+)\b/i);
    if (lenovoMatch) {
      detectedModel = lenovoMatch[1];
      if (!detectedBrand) detectedBrand = 'Lenovo';
    }

    // APC
    const smartUpsMatch = text.match(/\b(Smart-?UPS\s*[A-Za-z0-9\-]+|Back-?UPS\s*[A-Za-z0-9\-]+|SURT\d+[A-Za-z0-9\-]*|SMT\d+[A-Za-z0-9\-]*)\b/i);
    if (smartUpsMatch) {
      detectedModel = smartUpsMatch[1];
      if (!detectedBrand) detectedBrand = 'APC';
    }
  }

  // 3. Detección de Serial (S/N)
  // Ejemplos: "SN: D58003JH70063", "S/N: PV6B196005576", "Serial No: FCW2145A0BC", "Service Tag: 8FG3T92", "(S) 23S10..."
  const serialMatch = text.match(
    /(?:s[\/.]?n|serial(?:\s*no\.?|\s*number|\s*#)?|sn|serie|service\s*tag|st|n\/s|sec\s*s\/n|serial\s*num)[:\s=]+([A-Za-z0-9\-]+)/i
  );

  const noiseWords = /^(made|china|taiwan|input|output|voltage|rating|equipment|ethernet|model|switch|router|access|cisco|dell|lenovo|intel|service)$/i;

  if (serialMatch) {
    let cand = serialMatch[1].trim();
    cand = cand.replace(/^[;:\-.]+/, '').replace(/[;:\-.]+$/, '');
    if (!noiseWords.test(cand) && cand.length >= 4) {
      detectedSerial = cand;
    }
  }

  // Detección Dell Service Tag (exactamente 7 caracteres alfanuméricos)
  if (!detectedSerial) {
    const dellStMatch = text.match(/(?:service\s*tag|st)[:\s=]*([A-Z0-9]{7})\b/i);
    if (dellStMatch) {
      detectedSerial = dellStMatch[1].toUpperCase();
      if (!detectedBrand) detectedBrand = 'Dell';
    }
  }

  // Detección Cisco Serial Number (11 caracteres que inician con 3 letras de planta: FCW, FOC, FDO, JMX, SAL, etc.)
  if (!detectedSerial) {
    const ciscoSnMatch = text.match(/\b((?:FCW|FOC|FDO|JMX|SAL|QAK|FXS|FDZ|CAT|REF|DCA)[A-Z0-9]{8})\b/i);
    if (ciscoSnMatch) {
      detectedSerial = ciscoSnMatch[1].toUpperCase();
      if (!detectedBrand) detectedBrand = 'Cisco';
    }
  }

  // Detección etiqueta Lenovo / IBM con prefijo (S) o (1S)
  if (!detectedSerial) {
    const lenovoBarcodeTag = text.match(/(?:\(S\)|\[S\]|\(1S\)|1S)\s*([A-Za-z0-9\-]{8,24})/i);
    if (lenovoBarcodeTag) {
      detectedSerial = lenovoBarcodeTag[1].trim();
    }
  }

  // Fallback de serial si no tiene prefijo explícito: buscar token alfanumérico largo con números y letras
  if (!detectedSerial) {
    const candidateTokens = text.match(/\b([A-Z0-9]{10,20})\b/g);
    if (candidateTokens) {
      for (const token of candidateTokens) {
        if (
          !noiseWords.test(token) &&
          !token.includes('MADEIN') &&
          !token.includes('CHINA') &&
          !token.includes('COLOMBIA') &&
          !token.includes('PRODUCT') &&
          !token.includes('ETHERNET') &&
          !token.includes('SPECIFICATION') &&
          /\d/.test(token) &&
          /[A-Za-z]/.test(token)
        ) {
          detectedSerial = token;
          break;
        }
      }
    }
  }

  // 4. Detección de Código de Activo Fijo / Placa Institucional si está en el texto
  const assetCodeMatch = text.match(/(?:activo(?:\s*fijo)?|c[oó]digo|placa|id\s*equipo)[:\s]*([A-Za-z0-9\-]+)/i);
  if (assetCodeMatch) {
    detectedCode = assetCodeMatch[1].trim();
  }

  // 5. Detección de MAC Address
  const macMatch = text.match(/(?:mac(?:\s*id|\s*address)?|lan\s*mac)[:\s]*([0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}|[0-9A-Fa-f]{12})/i);
  if (macMatch) {
    detectedMac = macMatch[1].trim();
    specs.push(`MAC: ${detectedMac}`);
  }

  // 6. Detección de Part Number (P/N) o Especificación de Configuración
  const pnMatch = text.match(/(?:p\/n|part(?:\s*no|\s*number)?|pn)[:\s]*([A-Za-z0-9\-._/]+)/i);
  if (pnMatch) {
    specs.push(`P/N: ${pnMatch[1].trim()}`);
  }
  
  // Buscar también códigos de configuración completa tipo: SER5 PRO-E-16500EJ0W64PRO-DP/XB
  const partFullMatch = originalText.match(/\b(SER\d+\s*PRO-[A-Za-z0-9\-/_]+)\b/i) || text.match(/\b(SER\d+\s*PRO-[A-Za-z0-9\-/_]+)\b/i);
  if (partFullMatch) {
    specs.push(`P/N Config: ${partFullMatch[1].trim()}`);
    if (!detectedModel || detectedModel === 'SER') {
      detectedModel = 'SER5 Pro';
    }
    if (!detectedBrand) detectedBrand = 'Beelink';
    if (!deviceType) deviceType = 'Mini PC / Computador Compacto';
  }

  // 7. Detección de Especificaciones Eléctricas (Input / Entrada / Rating)
  // Soporta 19V=3.42A, 19V===3.42A, 19V 3.42A, 100-240V ~ 50/60Hz
  const inputMatch = text.match(/(?:input|entrada|rating|alimentaci[oó]n|power)[:\s]*([0-9\.\-]+\s*(?:V|VAC|VDC|V~)?\s*(?:(?:={1,3}|[~⎓\/\-]|x|\b(?:AC|DC)\b)\s*)?[0-9\.\-]+\s*(?:A|mA|W|VA|Hz|V)?(?:\s*,?\s*[0-9\.\-]+\s*Hz)?(?:\s*,?\s*[0-9\.\-]+\s*W)?)/i);
  if (inputMatch) {
    specs.push(`Alimentación: ${inputMatch[1].trim()}`);
  }

  // 8. Detección de Versiones de Hardware / Firmware / Lote / SKU
  const hwMatch = text.match(/(?:h\/w\s*ver\.?|hw\s*ver\.?)[:\s]*([A-Za-z0-9\-_.]+)/i);
  if (hwMatch) {
    specs.push(`H/W: ${hwMatch[1].trim()}`);
  }
  const fwMatch = text.match(/(?:f\/w\s*ver\.?|fw\s*ver\.?)[:\s]*([A-Za-z0-9\-_.]+)/i);
  if (fwMatch) {
    specs.push(`F/W: ${fwMatch[1].trim()}`);
  }
  // Batch/Lote tipo: 99.222890208F0
  const batchMatch = originalText.match(/\b(\d{2}\.\d{8,14}[A-Za-z0-9]+)\b/) || text.match(/\b(\d{2}\.\d{8,14}[A-Za-z0-9]+)\b/);
  if (batchMatch) {
    specs.push(`Lote/Rev: ${batchMatch[1].trim()}`);
  }

  // 9. Detección de FCC ID o Certificación
  const fccMatch = text.match(/(?:fcc\s*id)[:\s]*([A-Za-z0-9\-]+)/i);
  if (fccMatch) {
    specs.push(`FCC ID: ${fccMatch[1].trim()}`);
  }

  // 10. Detección de Tipo de Equipo
  const lowerText = text.toLowerCase();
  if (
    /\b(ser\d*|mini\s*pc|nuc\d*|beelink|minisforum|eq\d+|sei\d+)\b/i.test(text) ||
    lowerText.includes('mini pc') ||
    lowerText.includes('beelink') ||
    lowerText.includes('minisforum')
  ) {
    deviceType = 'Mini PC / Computador Compacto';
  } else if (
    lowerText.includes('pc') ||
    lowerText.includes('computador') ||
    lowerText.includes('optiplex') ||
    lowerText.includes('thinkcentre') ||
    lowerText.includes('prodesk')
  ) {
    deviceType = 'Computador de Escritorio';
  } else if (lowerText.includes('router') || lowerText.includes('dir-') || lowerText.includes('broadband')) {
    deviceType = 'Router Inalámbrico / Enrutador de Red';
  } else if (lowerText.includes('switch') || lowerText.includes('conmutador') || lowerText.includes('catalyst')) {
    deviceType = 'Switch de Red Administrable';
  } else if (lowerText.includes('access point') || lowerText.includes('unifi') || lowerText.includes('wifi') || lowerText.includes('u6-')) {
    deviceType = 'Punto de Acceso Wi-Fi';
  } else if (lowerText.includes('ups') || lowerText.includes('smart-ups') || lowerText.includes('batería')) {
    deviceType = 'Sistema de Respaldo UPS';
  } else if (lowerText.includes('server') || lowerText.includes('servidor') || lowerText.includes('poweredge')) {
    deviceType = 'Servidor Central de Datos';
  } else if (lowerText.includes('cctv') || lowerText.includes('nvr') || lowerText.includes('dvr') || lowerText.includes('camera')) {
    deviceType = 'Grabador NVR / Cámara CCTV';
  } else if (lowerText.includes('printer') || lowerText.includes('impresora') || lowerText.includes('multifuncional')) {
    deviceType = 'Impresora / Multifuncional';
  } else if (lowerText.includes('proyector') || lowerText.includes('projector')) {
    deviceType = 'Video Proyector Multimedia';
  }

  // Código sugerido si no hay
  if (!detectedCode && detectedSerial) {
    detectedCode = detectedSerial;
  }

  return {
    detectedBrand,
    detectedModel,
    detectedSerial,
    detectedCode,
    deviceType,
    specsFound: specs.join(' | '),
    rawText,
  };
}

/**
 * Escanea códigos de barras / QR directamente desde el archivo de imagen en el navegador.
 */
export async function scanBarcodeFromFile(file: File): Promise<string | null> {
  try {
    const tempContainerId = 'temp-barcode-scanner-' + Math.random().toString(36).substring(7);
    const div = document.createElement('div');
    div.id = tempContainerId;
    div.style.display = 'none';
    document.body.appendChild(div);

    try {
      const qrScanner = new Html5Qrcode(tempContainerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.AZTEC,
          Html5QrcodeSupportedFormats.PDF_417,
        ],
        verbose: false,
      });

      const decodedText = await qrScanner.scanFile(file, false);
      try {
        qrScanner.clear();
      } catch {
        // Ignorar limpieza si ya terminó
      }
      return decodedText ? decodedText.trim() : null;
    } finally {
      if (div.parentNode) {
        div.parentNode.removeChild(div);
      }
    }
  } catch {
    // Si la imagen no contiene código de barras legible o falla la decodificación en esta orientación
    return null;
  }
}

/**
 * Escanea códigos de barra probando múltiples orientaciones (0°, 90°, 270°, 180°)
 * y filtros de alto contraste, ya que las fotos suelen tomarse con la cámara girada
 * o con barras de código paralelas al eje horizontal.
 */
export async function scanBarcodeWithMultiAngle(
  file: File,
  onStatus?: (msg: string) => void
): Promise<{
  barcode: string | null;
  bestAngle: number;
  bestFile: File;
  bestDataUrl?: string;
}> {
  // 1. Probar primero orientación original 0°
  let result = await scanBarcodeFromFile(file);
  if (result) {
    return { barcode: result, bestAngle: 0, bestFile: file };
  }

  // 2. Si 0° no decodifica, probar con contraste mejorado a 0°
  try {
    const enhanced0 = await enhanceImageForScanning(file);
    result = await scanBarcodeFromFile(enhanced0.file);
    if (result) {
      return { barcode: result, bestAngle: 0, bestFile: file, bestDataUrl: enhanced0.dataUrl };
    }
  } catch {
    // Continuar
  }

  // 3. Probar rotaciones clave (90°, 270°, 180°)
  // Las barras de códigos 1D Code 128 / Code 39 requieren cruzar transversalmente el láser virtual
  const anglesToTry = [90, 270, 180];
  for (const angle of anglesToTry) {
    if (onStatus) onStatus(`Alineando escaneo de código a ${angle}°...`);
    try {
      const { file: rotatedFile, dataUrl: rotDataUrl } = await rotateImageBlob(file, angle);
      result = await scanBarcodeFromFile(rotatedFile);
      if (result) {
        return { barcode: result, bestAngle: angle, bestFile: rotatedFile, bestDataUrl: rotDataUrl };
      }

      // Probar también rotada con contraste mejorado
      const { file: enhancedRot, dataUrl: enhDataUrl } = await enhanceImageForScanning(rotatedFile);
      result = await scanBarcodeFromFile(enhancedRot);
      if (result) {
        return { barcode: result, bestAngle: angle, bestFile: rotatedFile, bestDataUrl: rotDataUrl || enhDataUrl };
      }
    } catch {
      // Continuar al siguiente ángulo
    }
  }

  return { barcode: null, bestAngle: 0, bestFile: file };
}

/**
 * Reduce el tamaño y resolución de la imagen antes de enviarla a la API de visión.
 * Esto evita payloads excesivos, tiempos de espera largos y sobrecarga de cuota/concurrencia.
 */
export async function compressImageForAi(
  imageSource: File | Blob | string,
  maxDimension = 1200,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof imageSource === 'string' ? imageSource : '');
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      resolve(typeof imageSource === 'string' ? imageSource : '');
    };
    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

/**
 * Llama al endpoint de visión Gemini en el backend (/api/ai/scan-plate)
 * para reconocimiento inteligente de etiquetas y placas de alta precisión (Marca, Modelo, Serial, etc.).
 */
export async function scanWithGeminiAi(
  base64Image: string
): Promise<PlateOcrResult | null> {
  try {
    const optimizedBase64 = await compressImageForAi(base64Image, 1200, 0.85);

    const res = await fetch('/api/ai/scan-plate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: optimizedBase64 || base64Image }),
    });
    if (!res.ok) {
      return null;
    }
    const json = await res.json();
    if (json.success && json.data) {
      const d = json.data;
      return {
        detectedBrand: d.brand || '',
        detectedModel: d.model || '',
        detectedSerial: d.serial || '',
        detectedCode: d.code || d.serial || '',
        deviceType: d.deviceType || '',
        specsFound: d.specs || '',
        rawText: d.rawText || '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Realiza OCR en el navegador usando Tesseract.js.
 */
export async function runClientOcr(
  imageSource: File | string,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  try {
    const result = await Tesseract.recognize(imageSource, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round((m.progress || 0) * 100), 'Reconociendo texto de la placa...');
        }
      },
    });
    return result.data.text || '';
  } catch (err) {
    console.warn('OCR en cliente con Tesseract no disponible o bloqueado:', err);
    return '';
  }
}

/**
 * Orquestador completo de reconocimiento OCR de placas y etiquetas traseras:
 * 1. Decodificación de códigos de barra multi-ángulo (Html5Qrcode).
 * 2. Reconocimiento multimodal con IA Gemini Vision (detecta Marca, Modelo, S/N, Alimentación).
 * 3. Fallback a OCR adaptativo cliente (Tesseract.js con filtros de contraste dual e invertido).
 */
export async function processPlateRecognition(
  file: File,
  base64: string,
  onStatusUpdate?: (status: string) => void
): Promise<{
  plateInfo: PlateOcrResult;
  source: 'barcode' | 'ocr' | 'hybrid' | 'gemini_vision';
  barcodeDetected?: string | null;
  detectedAngle?: number;
  correctedDataUrl?: string | null;
}> {
  let barcode: string | null = null;
  let ocrText = '';
  let effectiveFile = file;
  let detectedAngle = 0;
  let correctedDataUrl: string | null = null;

  // Paso 1: Intentar decodificar códigos de barras impresos en la etiqueta (orientaciones 0°, 90°, 270°, 180°)
  if (onStatusUpdate) onStatusUpdate('Buscando códigos de barras y seriales en la etiqueta...');
  try {
    const barcodeResult = await scanBarcodeWithMultiAngle(file, onStatusUpdate);
    if (barcodeResult.barcode) {
      barcode = barcodeResult.barcode;
      effectiveFile = barcodeResult.bestFile;
      detectedAngle = barcodeResult.bestAngle;
      correctedDataUrl = barcodeResult.bestDataUrl || null;
      console.log(`Código de barras detectado a ${detectedAngle}°:`, barcode);
    }
  } catch {
    // Continuar al siguiente paso si no hay código de barras
  }

  // Paso 2: Análisis inteligente con Gemini Vision (IA de alta precisión)
  if (onStatusUpdate) onStatusUpdate('Analizando etiqueta con IA Vision de alta precisión...');
  try {
    const aiResult = await scanWithGeminiAi(base64);
    if (aiResult && (aiResult.detectedBrand || aiResult.detectedModel || aiResult.detectedSerial)) {
      if (barcode) {
        aiResult.detectedSerial = barcode;
        if (!aiResult.detectedCode) aiResult.detectedCode = barcode;
      }
      if (!aiResult.detectedCode && aiResult.detectedSerial) {
        aiResult.detectedCode = aiResult.detectedSerial;
      }
      return {
        plateInfo: aiResult,
        source: barcode ? 'hybrid' : 'gemini_vision',
        barcodeDetected: barcode,
        detectedAngle,
        correctedDataUrl,
      };
    }
  } catch {
    // Continuar con motor OCR local
  }

  // Paso 3: Análisis de texto impreso con motor OCR Tesseract (Fallback local)
  // Primero optimizamos contraste y nitidez
  if (onStatusUpdate) onStatusUpdate('Optimizando contraste de la etiqueta para OCR...');
  try {
    const enhanced = await enhanceImageForScanning(effectiveFile);
    effectiveFile = enhanced.file;
    correctedDataUrl = enhanced.dataUrl;
  } catch {
    // Continuar con original si falla canvas
  }

  if (onStatusUpdate) onStatusUpdate('Iniciando lectura OCR de texto en etiqueta trasera...');
  try {
    ocrText = await runClientOcr(effectiveFile, (progress, status) => {
      if (onStatusUpdate) onStatusUpdate(`${status} (${progress}%)`);
    });

    // Evaluar campos encontrados en la primera pasada
    let currentParsed = extractTechnicalFieldsFromText(ocrText);

    // Si falta marca, modelo o serial, o el texto es muy corto:
    // Probar pasada con contraste invertido (negativo: letras blancas sobre fondo oscuro, común en Cisco, Beelink, Dell, HP)
    if (!currentParsed.detectedBrand || !currentParsed.detectedModel || !currentParsed.detectedSerial || ocrText.trim().length < 30) {
      if (onStatusUpdate) onStatusUpdate('Aplicando filtro inverso para etiquetas de fondo oscuro...');
      try {
        const inverted = await createInvertedContrastImage(file);
        const invertedText = await runClientOcr(inverted.file);
        if (invertedText.trim().length > 15) {
          ocrText = `${ocrText}\n${invertedText}`;
          currentParsed = extractTechnicalFieldsFromText(ocrText);
        }
      } catch {
        // Continuar
      }
    }

    // Si aún faltan campos críticos y no se ha rotado, probar rotación a 90°
    if ((!currentParsed.detectedModel || !currentParsed.detectedSerial) && detectedAngle === 0) {
      if (onStatusUpdate) onStatusUpdate('Probando orientación vertical (90°) para OCR...');
      try {
        const rot90 = await rotateImageBlob(file, 90);
        const { file: enhRot } = await enhanceImageForScanning(rot90.file);
        const rotText = await runClientOcr(enhRot);
        if (rotText.trim().length > 15) {
          ocrText = `${ocrText}\n${rotText}`;
        }
      } catch {
        // Continuar
      }
    }
  } catch (err) {
    console.warn('Error en OCR local:', err);
  }

  // Paso 3: Unificar texto de OCR y código de barras decodificado
  const combinedRawText = [
    ocrText,
    barcode ? `SN: ${barcode}\nBARCODE: ${barcode}\nSERIAL: ${barcode}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Paso 4: Extraer campos estructurados (Marca, Modelo, Serial, Especificaciones Técnicas)
  const parsed = extractTechnicalFieldsFromText(combinedRawText);

  // Si se detectó código de barras directo, priorizarlo como serial y código exacto
  if (barcode) {
    parsed.detectedSerial = barcode;
    if (!parsed.detectedCode) parsed.detectedCode = barcode;
  }

  // Si se detectó serial pero no código de activo, usar el serial como código
  if (!parsed.detectedCode && parsed.detectedSerial) {
    parsed.detectedCode = parsed.detectedSerial;
  }

  let source: 'barcode' | 'ocr' | 'hybrid' = 'ocr';
  if (barcode && (parsed.detectedBrand || parsed.detectedModel || parsed.specsFound)) {
    source = 'hybrid';
  } else if (barcode) {
    source = 'barcode';
  }

  return {
    plateInfo: parsed,
    source,
    barcodeDetected: barcode,
    detectedAngle,
    correctedDataUrl,
  };
}

