import QRCode from 'qrcode';
import { Equipment } from '../types';

export const QrService = {
  /**
   * Genera un código QR de alta resolución para un equipo institucional
   */
  async generateEquipmentQrDataUrl(equipment: Equipment): Promise<string> {
    const payload = JSON.stringify({
      app: 'FCBV_SGC',
      id: equipment.id,
      code: equipment.code,
      serial: equipment.serial,
      name: equipment.name,
      loc: equipment.location,
    });

    try {
      return await QRCode.toDataURL(payload, {
        width: 300,
        margin: 2,
        color: {
          dark: '#0f172a', // Slate 900
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
    } catch (err) {
      console.error('Error generando QR Code:', err);
      // Fallback a versión simple de solo el código
      return await QRCode.toDataURL(equipment.code, { width: 300, margin: 2 });
    }
  },

  /**
   * Genera QR a partir de texto simple (código o serial)
   */
  async generateTextQrDataUrl(text: string): Promise<string> {
    return await QRCode.toDataURL(text, {
      width: 250,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  },

  /**
   * Parsea el resultado obtenido del escáner (puede ser texto plano, código o JSON estructurado)
   */
  parseScanResult(raw: string): { code?: string; serial?: string; id?: string; rawText: string } {
    const rawTrimmed = raw.trim();

    // Intentar parsear como JSON si fue generado por la misma app
    if (rawTrimmed.startsWith('{') && rawTrimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(rawTrimmed);
        return {
          code: parsed.code || '',
          serial: parsed.serial || '',
          id: parsed.id || '',
          rawText: rawTrimmed,
        };
      } catch (e) {
        // Fallback a texto
      }
    }

    // Prefijos comunes en etiquetas de inventario como "FCBV:SW-01" o "SN:FOC12345"
    if (rawTrimmed.includes(':')) {
      const parts = rawTrimmed.split(':');
      const val = parts[1].trim();
      return {
        code: val,
        serial: val,
        rawText: rawTrimmed,
      };
    }

    return {
      code: rawTrimmed,
      serial: rawTrimmed,
      rawText: rawTrimmed,
    };
  },
};
