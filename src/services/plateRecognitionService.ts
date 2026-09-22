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
 * Aplica un filtro de enfoque por convolución (Unsharp Masking 3x3) sobre el canvas
 * para realzar bordes tipográficos en etiquetas con fuentes pequeñas o desenfoque leve.
 */
function applySharpenFilter(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const buff = new Uint8ClampedArray(data);
    // Kernel 3x3: centro 5, cruz -1
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const val =
            buff[idx + c] * 5 -
            buff[((y - 1) * width + x) * 4 + c] -
            buff[((y + 1) * width + x) * 4 + c] -
            buff[(y * width + (x - 1)) * 4 + c] -
            buff[(y * width + (x + 1)) * 4 + c];
          data[idx + c] = Math.min(255, Math.max(0, val));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Si canvas tiene restricciones de origen, continuar sin alterar
  }
}

/**
 * Genera una versión con contraste mejorado, escala de grises y enfoque para facilitar OCR de Tesseract.js.
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

      // Escala de grises + alto contraste + realce leve de brillo
      ctx.filter = 'contrast(180%) grayscale(100%) brightness(106%)';
      ctx.drawImage(img, 0, 0, width, height);

      // Aplicar filtro de nitidez convolucional
      applySharpenFilter(ctx, width, height);

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
 * Genera una versión con colores invertidos (negativo) y alto contraste con enfoque.
 * Crucial para etiquetas con texto blanco o metálico sobre fondo negro/oscuro (Beelink, Cisco, Dell, HP).
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

      ctx.filter = 'invert(100%) contrast(190%) grayscale(100%) brightness(105%)';
      ctx.drawImage(img, 0, 0, width, height);

      // Aplicar filtro de nitidez convolucional
      applySharpenFilter(ctx, width, height);

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
 * Limpia estrictamente un valor extraído tras una etiqueta ('Modelo:', 'Marca:', 'Serial:').
 * Elimina signos de puntuación espurios, caracteres de inicio/fin, etiquetas adyacentes y palabras de ruido,
 * retornando únicamente los valores alfanuméricos válidos.
 */
export function cleanAlphanumericValue(
  rawVal: string,
  options: {
    allowHyphens?: boolean;
    allowDots?: boolean;
    allowSlashes?: boolean;
    allowSpaces?: boolean;
    maxWords?: number;
    preserveCase?: boolean;
    minLen?: number;
  } = {}
): string {
  if (!rawVal) return '';

  const {
    allowHyphens = true,
    allowDots = false,
    allowSlashes = false,
    allowSpaces = false,
    maxWords = 1,
    preserveCase = true,
    minLen = 2,
  } = options;

  let text = rawVal.trim();

  // 1. Quitar caracteres iniciales residuales (: ; = - _ ~ | · • # / \ [ ] )
  text = text.replace(/^[:;=\-_~|·•#/\\[\](){}\s]+/, '').trim();

  // 2. Cortar si en la misma línea aparece otra etiqueta o término de corte
  const stopDelimiterPattern = /\b(?:input|output|rating|voltage|power|mac|lan|wifi|fcc|ce|rohs|made\s*in|date|fecha|p\/n|pn|batch|lote|service|support|designed|assembled|sn|s\/n|serial|model|modelo|brand|marca|item|product|part)\b.*$/i;
  text = text.replace(stopDelimiterPattern, '').trim();

  // 3. Cortar por salto de línea
  text = text.split(/[\r\n]+/)[0].trim();

  // Palabras comunes de relleno en placas que NO corresponden a un código válido
  const noiseWordRegex = /^(made|in|china|taiwan|mexico|usa|vietnam|input|output|rating|voltage|power|hz|volt|amp|ce|rohs|fcc|weee|ukca|nom|ul|eac|model|modelo|brand|marca|serial|serie|number|numero|code|item|part|sn|sn:|s\/n|mac|date|type|tipo)$/i;

  if (allowSpaces && maxWords > 1) {
    const rawWords = text.split(/\s+/).filter(Boolean);
    const validWords: string[] = [];

    for (const w of rawWords.slice(0, maxWords)) {
      // Limpiar bordes no alfanuméricos
      let clean = w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      if (allowHyphens) {
        clean = clean.replace(/[^a-zA-Z0-9\-_]/g, '');
      } else {
        clean = clean.replace(/[^a-zA-Z0-9]/g, '');
      }

      if (clean && !noiseWordRegex.test(clean)) {
        validWords.push(clean);
      }
    }

    if (validWords.length > 0) {
      return validWords.join(' ');
    }
  }

  // Extracción de token alfanumérico unitario
  let charRegex: RegExp;
  if (allowHyphens && allowDots && allowSlashes) {
    charRegex = /[A-Za-z0-9\-._/]+/g;
  } else if (allowHyphens && allowDots) {
    charRegex = /[A-Za-z0-9\-._]+/g;
  } else if (allowHyphens && allowSlashes) {
    charRegex = /[A-Za-z0-9\-_/]+/g;
  } else if (allowHyphens) {
    charRegex = /[A-Za-z0-9\-_]+/g;
  } else {
    charRegex = /[A-Za-z0-9]+/g;
  }

  const matches = text.match(charRegex);
  if (!matches || matches.length === 0) return '';

  for (const m of matches) {
    const cleaned = m.replace(/^[\-_./]+|[\-_./]+$/g, '');
    if (cleaned.length >= minLen && !noiseWordRegex.test(cleaned)) {
      return preserveCase ? cleaned : cleaned.toUpperCase();
    }
  }

  return matches[0].replace(/^[\-_./]+|[\-_./]+$/g, '');
}

/**
 * Extrae y limpia específicamente el campo 'Marca:' a partir del texto OCR.
 */
export function extractBrandFromLabelText(text: string, rawText: string): string {
  // 1. Patrones directos de etiqueta "Marca:" / "Brand:"
  const directPatterns = [
    /(?:^|\s|\b)(?:marca|brand|fabricante|make|mfg|manufacturer)\s*[:=;\-.]+\s*([A-Za-z0-9\-_\s]{2,40})/i,
    /(?:^|\s|\b)(?:marca|brand|fabricante)\s+([A-Za-z0-9\-]{2,25})/i,
  ];

  for (const p of directPatterns) {
    const match = text.match(p);
    if (match) {
      const clean = cleanAlphanumericValue(match[1], {
        allowHyphens: true,
        allowSpaces: true,
        maxWords: 2,
        minLen: 2,
      });
      if (clean && clean.length >= 2) {
        return clean;
      }
    }
  }

  // 2. Búsqueda en catálogo de marcas conocidas
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
    if (b.regex.test(text) || b.regex.test(rawText)) {
      return b.name;
    }
  }

  // 3. Buscar en las 3 primeras líneas de la placa
  const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 2);
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    for (const b of brands) {
      if (b.regex.test(lines[i])) {
        return b.name;
      }
    }
  }

  return '';
}

/**
 * Extrae y limpia específicamente el campo 'Modelo:' a partir del texto OCR.
 */
export function extractModelFromLabelText(text: string, rawText: string): string {
  // 1. Patrones directos de etiqueta "Modelo:" / "Model:" / "M/N:" / "Mod:" / "Model No:"
  const directPatterns = [
    /(?:^|\s|\b)(?:modelo|model|m\/n|model\s*no\.?|modelo\s*no\.?|model#|modelo#|mod\.?|item\s*no\.?|product\s*no\.?|p\/n\s*model|regulatory\s*model|rmn)\s*[:=;\-.]+\s*([A-Za-z0-9\-._/\s]{2,60})/i,
    /(?:^|\s|\b)(?:modelo|model|m\/n)\s+([A-Za-z0-9\-._/]{2,40})/i,
  ];

  for (const p of directPatterns) {
    const match = text.match(p);
    if (match) {
      const clean = cleanAlphanumericValue(match[1], {
        allowHyphens: true,
        allowDots: true,
        allowSlashes: true,
        allowSpaces: true,
        maxWords: 3,
        minLen: 2,
      });

      if (clean && clean.length >= 2) {
        // Si el modelo capturado es solo "SER" pero en el texto está SER5 o SER5 Pro
        if (/^SER$/i.test(clean)) {
          if (/SER5\s*PRO/i.test(rawText) || /SER5\s*PRO/i.test(text)) return 'SER5 Pro';
          if (/SER5/i.test(rawText) || /SER5/i.test(text)) return 'SER5';
        }
        return clean;
      }
    }
  }

  // 2. Detección de subfamilias conocidas sin etiqueta directa
  const serMatch = text.match(/\b(SER\s*\d*(?:\s*(?:PRO|MAX|PLUS))?(?:-[A-Za-z0-9\-_/]+)?)\b/i);
  if (serMatch) {
    if (/SER5\s*PRO/i.test(rawText) || /SER5\s*PRO/i.test(text)) return 'SER5 Pro';
    return cleanAlphanumericValue(serMatch[1], { allowHyphens: true, allowSpaces: true, maxWords: 2 });
  }

  // Mini PCs / NUCs
  const miniPcMatch = text.match(/\b(EQ\d+|SEi\d+|Mini\s*S\d*|GK\d+|U59|NAB\d+|UM\d+|EM\d+|NPB\d+|NUC\d+[A-Za-z0-9\-]*)\b/i);
  if (miniPcMatch) {
    return cleanAlphanumericValue(miniPcMatch[1], { allowHyphens: true });
  }

  // Cisco Catalyst / Switches / Routers
  const wsMatch = text.match(/\b(WS-C\d+[A-Za-z0-9\-]+|C9\d{3}[A-Za-z0-9\-]*|SG\d{3}-[A-Za-z0-9\-]+|CBS\d{3}-[A-Za-z0-9\-]+|ISR\d{4}|AIR-[A-Za-z0-9\-]+)\b/i);
  if (wsMatch) {
    return cleanAlphanumericValue(wsMatch[1], { allowHyphens: true });
  }

  // D-Link
  const dirMatch = text.match(/\b(DIR-\d+[A-Za-z0-9]*|DES-\d+[A-Za-z0-9]*|DGS-\d+[A-Za-z0-9]*|DAP-\d+[A-Za-z0-9]*|DWR-\d+[A-Za-z0-9]*)\b/i);
  if (dirMatch) {
    return cleanAlphanumericValue(dirMatch[1], { allowHyphens: true });
  }

  // TP-Link
  const tplinkMatch = text.match(/\b(Archer\s+[A-Za-z0-9]+|TL-[A-Za-z0-9\-]+|Deco\s+[A-Za-z0-9]+|EAP\d+[A-Za-z0-9\-]*|Omada\s+[A-Za-z0-9]+)\b/i);
  if (tplinkMatch) {
    return cleanAlphanumericValue(tplinkMatch[1], { allowHyphens: true, allowSpaces: true, maxWords: 2 });
  }

  // Ubiquiti
  const u6Match = text.match(/\b(U6-(?:Pro|Lite|LR|Mesh|Enterprise|Plus)|UAP-[A-Za-z0-9\-]+|USW-[A-Za-z0-9\-]+|ER-[A-Za-z0-9\-]+|UDM-[A-Za-z0-9\-]+|NanoStation\s*[A-Za-z0-9\-]+|Rocket\s*[A-Za-z0-9\-]+)\b/i);
  if (u6Match) {
    return cleanAlphanumericValue(u6Match[1], { allowHyphens: true });
  }

  // Dell
  const optiMatch = text.match(/\b(OptiPlex\s*\d+[A-Za-z0-9]*|PowerEdge\s*[A-Za-z0-9]+|Latitude\s*\d+[A-Za-z0-9]*|Precision\s*\d+[A-Za-z0-9]*|Wyse\s*\d+[A-Za-z0-9]*)\b/i);
  if (optiMatch) {
    return cleanAlphanumericValue(optiMatch[1], { allowHyphens: true, allowSpaces: true, maxWords: 2 });
  }

  // HP
  const hpMatch = text.match(/\b(ProDesk\s*\d+[A-Za-z0-9]*|EliteDesk\s*\d+[A-Za-z0-9]*|ProLiant\s*[A-Za-z0-9\-]+|LaserJet\s*[A-Za-z0-9\-]+|ZBook\s*[A-Za-z0-9\-]+|ProBook\s*[A-Za-z0-9\-]+)\b/i);
  if (hpMatch) {
    return cleanAlphanumericValue(hpMatch[1], { allowHyphens: true, allowSpaces: true, maxWords: 2 });
  }

  // Lenovo
  const lenovoMatch = text.match(/\b(ThinkCentre\s*[A-Za-z0-9\-]+|ThinkSystem\s*[A-Za-z0-9\-]+|ThinkPad\s*[A-Za-z0-9\-]+|IdeaCentre\s*[A-Za-z0-9\-]+)\b/i);
  if (lenovoMatch) {
    return cleanAlphanumericValue(lenovoMatch[1], { allowHyphens: true, allowSpaces: true, maxWords: 2 });
  }

  // APC
  const smartUpsMatch = text.match(/\b(Smart-?UPS\s*[A-Za-z0-9\-]+|Back-?UPS\s*[A-Za-z0-9\-]+|SURT\d+[A-Za-z0-9\-]*|SMT\d+[A-Za-z0-9\-]*)\b/i);
  if (smartUpsMatch) {
    return cleanAlphanumericValue(smartUpsMatch[1], { allowHyphens: true, allowSpaces: true, maxWords: 2 });
  }

  return '';
}

/**
 * Extrae y limpia específicamente el campo 'Serial:' / 'S/N:' a partir del texto OCR.
 * Extrae estrictamente la secuencia alfanumérica sin espacios ni ruido.
 */
export function extractSerialFromLabelText(text: string, rawText: string): string {
  // 1. Patrones directos de etiqueta "Serial:" / "S/N:" / "SN:" / "Serie:" / "No. Serie:"
  const directPatterns = [
    /(?:^|\s|\b)(?:serial(?:\s*no\.?|\s*number|\s*#)?|s[\/.]?n|sn|serie|no\.?\s*serie|n\/s|service\s*tag|st|serial\s*num)\s*[:=;\-.]+\s*([A-Za-z0-9\-._/]{4,45})/i,
    /(?:^|\s|\b)(?:serial|s[\/.]?n|sn|serie)\s+([A-Za-z0-9\-]{5,35})/i,
  ];

  for (const p of directPatterns) {
    const match = text.match(p);
    if (match) {
      const clean = cleanAlphanumericValue(match[1], {
        allowHyphens: true,
        allowDots: false,
        allowSlashes: false,
        allowSpaces: false,
        maxWords: 1,
        minLen: 4,
      });

      if (clean && clean.length >= 4) {
        return clean.toUpperCase();
      }
    }
  }

  // 2. Detección Dell Service Tag (7 caracteres alfanuméricos)
  const dellStMatch = text.match(/(?:service\s*tag|st)[:\s=]*([A-Z0-9]{7})\b/i);
  if (dellStMatch) {
    return dellStMatch[1].toUpperCase();
  }

  // 3. Detección Cisco Serial Number (11 caracteres alfanuméricos con prefijo de planta)
  const ciscoSnMatch = text.match(/\b((?:FCW|FOC|FDO|JMX|SAL|QAK|FXS|FDZ|CAT|REF|DCA)[A-Z0-9]{8})\b/i);
  if (ciscoSnMatch) {
    return ciscoSnMatch[1].toUpperCase();
  }

  // 4. Detección etiqueta Lenovo / IBM con prefijo (S) o (1S)
  const lenovoBarcodeTag = text.match(/(?:\(S\)|\[S\]|\(1S\)|1S)\s*([A-Za-z0-9\-]{8,24})/i);
  if (lenovoBarcodeTag) {
    const clean = cleanAlphanumericValue(lenovoBarcodeTag[1], { allowHyphens: true });
    if (clean) return clean.toUpperCase();
  }

  // 5. Fallback heurístico: buscar token alfanumérico largo (10-22 caracteres con letras y dígitos)
  const candidateTokens = text.match(/\b([A-Z0-9]{10,22})\b/g);
  if (candidateTokens) {
    for (const token of candidateTokens) {
      if (
        !token.includes('MADEIN') &&
        !token.includes('CHINA') &&
        !token.includes('PRODUCT') &&
        !token.includes('ETHERNET') &&
        !token.includes('SPECIFICATION') &&
        /\d/.test(token) &&
        /[A-Za-z]/.test(token)
      ) {
        return token;
      }
    }
  }

  return '';
}

/**
 * Normaliza y extrae campos técnicos de cómputo, red e infraestructura a partir de texto OCR o transcripción.
 */
export function extractTechnicalFieldsFromText(rawText: string): PlateOcrResult {
  const originalText = rawText || '';
  const text = normalizeOcrText(originalText);

  // Extracciones específicas con limpieza estricta de valores alfanuméricos
  let detectedBrand = extractBrandFromLabelText(text, originalText);
  let detectedModel = extractModelFromLabelText(text, originalText);
  let detectedSerial = extractSerialFromLabelText(text, originalText);
  let detectedMac = '';
  let detectedCode = '';
  let deviceType = '';
  const specs: string[] = [];

  // Detección de Código de Activo Fijo / Placa Institucional si está en el texto
  const assetCodeMatch = text.match(/(?:activo(?:\s*fijo)?|c[oó]digo|placa|id\s*equipo)[:\s]*([A-Za-z0-9\-]+)/i);
  if (assetCodeMatch) {
    detectedCode = cleanAlphanumericValue(assetCodeMatch[1], { allowHyphens: true });
  }

  // Detección de MAC Address
  const macMatch = text.match(/(?:mac(?:\s*id|\s*address)?|lan\s*mac)[:\s]*([0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}|[0-9A-Fa-f]{12})/i);
  if (macMatch) {
    detectedMac = macMatch[1].trim();
    specs.push(`MAC: ${detectedMac}`);
  }

  // Detección de Part Number (P/N)
  const pnMatch = text.match(/(?:p\/n|part(?:\s*no|\s*number)?|pn)[:\s]*([A-Za-z0-9\-._/]+)/i);
  if (pnMatch) {
    const cleanPn = cleanAlphanumericValue(pnMatch[1], { allowHyphens: true, allowDots: true, allowSlashes: true });
    if (cleanPn) specs.push(`P/N: ${cleanPn}`);
  }

  // Código de configuración completa (ej: SER5 PRO-E-16500EJ0W64PRO-DP/XB)
  const partFullMatch = originalText.match(/\b(SER\d+\s*PRO-[A-Za-z0-9\-/_]+)\b/i) || text.match(/\b(SER\d+\s*PRO-[A-Za-z0-9\-/_]+)\b/i);
  if (partFullMatch) {
    specs.push(`P/N Config: ${partFullMatch[1].trim()}`);
    if (!detectedModel || detectedModel === 'SER') {
      detectedModel = 'SER5 Pro';
    }
    if (!detectedBrand) detectedBrand = 'Beelink';
    if (!deviceType) deviceType = 'Mini PC / Computador Compacto';
  }

  // Especificaciones Eléctricas (Input / Entrada / Rating)
  const inputMatch = text.match(/(?:input|entrada|rating|alimentaci[oó]n|power)[:\s]*([0-9\.\-]+\s*(?:V|VAC|VDC|V~)?\s*(?:(?:={1,3}|[~⎓\/\-]|x|\b(?:AC|DC)\b)\s*)?[0-9\.\-]+\s*(?:A|mA|W|VA|Hz|V)?(?:\s*,?\s*[0-9\.\-]+\s*Hz)?(?:\s*,?\s*[0-9\.\-]+\s*W)?)/i);
  if (inputMatch) {
    specs.push(`Alimentación: ${inputMatch[1].trim()}`);
  }

  // Versiones de Hardware / Firmware / Lote / SKU
  const hwMatch = text.match(/(?:h\/w\s*ver\.?|hw\s*ver\.?)[:\s]*([A-Za-z0-9\-_.]+)/i);
  if (hwMatch) {
    const cleanHw = cleanAlphanumericValue(hwMatch[1], { allowHyphens: true, allowDots: true });
    if (cleanHw) specs.push(`H/W: ${cleanHw}`);
  }
  const fwMatch = text.match(/(?:f\/w\s*ver\.?|fw\s*ver\.?)[:\s]*([A-Za-z0-9\-_.]+)/i);
  if (fwMatch) {
    const cleanFw = cleanAlphanumericValue(fwMatch[1], { allowHyphens: true, allowDots: true });
    if (cleanFw) specs.push(`F/W: ${cleanFw}`);
  }
  const batchMatch = originalText.match(/\b(\d{2}\.\d{8,14}[A-Za-z0-9]+)\b/) || text.match(/\b(\d{2}\.\d{8,14}[A-Za-z0-9]+)\b/);
  if (batchMatch) {
    specs.push(`Lote/Rev: ${batchMatch[1].trim()}`);
  }

  // Tipo de Equipo según Marca y Modelo detectados
  const lowerText = text.toLowerCase();
  const lowerBrand = (detectedBrand || '').toLowerCase();
  const lowerModel = (detectedModel || '').toLowerCase();

  if (
    lowerModel.includes('ser') ||
    lowerModel.includes('mini pc') ||
    lowerBrand.includes('beelink') ||
    lowerBrand.includes('minisforum') ||
    lowerModel.includes('nuc')
  ) {
    deviceType = 'Mini PC / Computador Compacto';
  } else if (
    lowerBrand.includes('dell') && (lowerModel.includes('optiplex') || lowerModel.includes('precision') || lowerModel.includes('latitude')) ||
    lowerBrand.includes('hp') && (lowerModel.includes('prodesk') || lowerModel.includes('elitedesk')) ||
    lowerBrand.includes('lenovo') && (lowerModel.includes('thinkcentre') || lowerModel.includes('thinkpad'))
  ) {
    deviceType = 'Computador de Escritorio';
  } else if (lowerModel.includes('dir-') || lowerBrand.includes('mikrotik') || lowerText.includes('router') || lowerText.includes('broadband')) {
    deviceType = 'Router Inalámbrico / Enrutador de Red';
  } else if (lowerModel.includes('catalyst') || lowerModel.includes('ws-c') || lowerModel.includes('des-') || lowerModel.includes('dgs-') || lowerText.includes('switch')) {
    deviceType = 'Switch de Red Administrable';
  } else if (lowerModel.includes('u6-') || lowerModel.includes('unifi') || lowerText.includes('access point') || lowerText.includes('ap')) {
    deviceType = 'Punto de Acceso Wi-Fi';
  } else if (lowerBrand.includes('apc') || lowerBrand.includes('tripp lite') || lowerBrand.includes('forza') || lowerText.includes('ups')) {
    deviceType = 'Sistema de Respaldo UPS';
  } else if (lowerModel.includes('poweredge') || lowerModel.includes('proliant') || lowerText.includes('server')) {
    deviceType = 'Servidor Central de Datos';
  } else if (lowerText.includes('nvr') || lowerText.includes('dvr') || lowerBrand.includes('hikvision') || lowerBrand.includes('dahua')) {
    deviceType = 'Grabador NVR / Cámara CCTV';
  } else if (lowerBrand.includes('epson') || lowerBrand.includes('canon') || lowerBrand.includes('kyocera') || lowerBrand.includes('brother') || lowerText.includes('printer')) {
    deviceType = 'Impresora / Multifuncional';
  } else if (lowerBrand.includes('benq') || lowerBrand.includes('viewsonic') || lowerBrand.includes('optoma') || lowerText.includes('projector')) {
    deviceType = 'Video Proyector Multimedia';
  } else {
    deviceType = 'Equipo Tecnológico / Infraestructura';
  }

  // Código sugerido si no hay código de activo explícito
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
 * Realiza OCR en el navegador usando Tesseract.js con soporte multi-idioma (Español + Inglés)
 * para capturar correctamente patrones técnicos como 'Modelo:', 'Marca:', 'Serial:', 'S/N:'.
 */
export async function runClientOcr(
  imageSource: File | Blob | string,
  onProgress?: (progress: number, status: string) => void,
  lang = 'spa+eng'
): Promise<string> {
  try {
    const result = await Tesseract.recognize(imageSource, lang, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          const pct = Math.round((m.progress || 0) * 100);
          onProgress(pct, `Reconociendo texto con Tesseract (${pct}%)...`);
        }
      },
    });
    return result.data.text || '';
  } catch (err) {
    console.warn('[Tesseract OCR] Reintento con modelo estándar en inglés:', err);
    try {
      const fallbackResult = await Tesseract.recognize(imageSource, 'eng');
      return fallbackResult.data.text || '';
    } catch (e2) {
      console.warn('[Tesseract OCR] Falló reconocimiento cliente:', e2);
      return '';
    }
  }
}

/**
 * Orquestador completo de reconocimiento OCR de placas y etiquetas traseras:
 * Puede operar en modo 'local_ocr' (100% privado en navegador, sin enviar datos a la nube)
 * o en modo 'ai_hybrid' (asistido con IA Gemini Vision si está disponible).
 */
export async function processPlateRecognition(
  file: File,
  base64: string,
  onStatusUpdate?: (status: string) => void,
  engineMode: 'local_ocr' | 'ai_hybrid' = 'local_ocr'
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

  // Paso 2: Si el usuario seleccionó modo IA Híbrido, intentar primero Gemini Vision
  if (engineMode === 'ai_hybrid') {
    if (onStatusUpdate) onStatusUpdate('Analizando etiqueta con IA Vision...');
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
      // Si falla o no está disponible la IA, continuar inmediatamente con Tesseract.js local
    }
  }

  // Paso 3: Motor OCR Local Tesseract.js (Privado y en dispositivo)
  // Generar versión con contraste mejorado y filtro de enfoque
  if (onStatusUpdate) onStatusUpdate('Optimizando contraste y nitidez para OCR local...');
  try {
    const enhanced = await enhanceImageForScanning(effectiveFile);
    effectiveFile = enhanced.file;
    correctedDataUrl = enhanced.dataUrl;
  } catch {
    // Continuar con original si falla canvas
  }

  if (onStatusUpdate) onStatusUpdate('Iniciando lectura OCR local con Tesseract.js...');
  try {
    ocrText = await runClientOcr(effectiveFile, (progress, status) => {
      if (onStatusUpdate) onStatusUpdate(`${status} (${progress}%)`);
    });

    // Evaluar campos encontrados en la primera pasada
    let currentParsed = extractTechnicalFieldsFromText(ocrText);

    // Si falta marca, modelo o serial, o el texto extraído es corto:
    // Probar pasada con filtro inverso (negativo: letras blancas o plateadas sobre chasis negro/gris oscuro)
    if (!currentParsed.detectedBrand || !currentParsed.detectedModel || !currentParsed.detectedSerial || ocrText.trim().length < 30) {
      if (onStatusUpdate) onStatusUpdate('Aplicando filtro inverso para etiquetas de fondo oscuro...');
      try {
        const inverted = await createInvertedContrastImage(file);
        const invertedText = await runClientOcr(inverted.file);
        if (invertedText.trim().length > 10) {
          ocrText = `${ocrText}\n${invertedText}`;
          currentParsed = extractTechnicalFieldsFromText(ocrText);
        }
      } catch {
        // Continuar
      }
    }

    // Si aún faltan campos críticos y la foto original no se rotó, probar orientación a 90°
    if ((!currentParsed.detectedModel || !currentParsed.detectedSerial) && detectedAngle === 0) {
      if (onStatusUpdate) onStatusUpdate('Probando orientación vertical (90°) para OCR local...');
      try {
        const rot90 = await rotateImageBlob(file, 90);
        const { file: enhRot } = await enhanceImageForScanning(rot90.file);
        const rotText = await runClientOcr(enhRot);
        if (rotText.trim().length > 10) {
          ocrText = `${ocrText}\n${rotText}`;
        }
      } catch {
        // Continuar
      }
    }
  } catch (err) {
    console.warn('Error en OCR local Tesseract:', err);
  }

  // Paso 4: Unificar texto de OCR y código de barras decodificado
  const combinedRawText = [
    ocrText,
    barcode ? `SN: ${barcode}\nBARCODE: ${barcode}\nSERIAL: ${barcode}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Paso 5: Extraer campos técnicos con limpieza estricta de valores alfanuméricos
  const parsed = extractTechnicalFieldsFromText(combinedRawText);

  // Si se detectó código de barras directo, priorizarlo como serial exacto
  if (barcode) {
    parsed.detectedSerial = barcode;
    if (!parsed.detectedCode) parsed.detectedCode = barcode;
  }

  // Si se detectó serial pero no código de activo, asignar el serial como código
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

