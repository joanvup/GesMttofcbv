import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';

export const LogoManager: React.FC = () => {
  const [logoData, setLogoData] = useState<{
    hasCustomLogo: boolean;
    logoUrl: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLogo = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/logo');
      if (res.ok) {
        const data = await res.json();
        setLogoData({
          hasCustomLogo: Boolean(data.hasCustomLogo),
          logoUrl: data.logoUrl || null,
        });
      } else {
        // Fallback al escudo predeterminado institucional si no hay logo personalizado
        setLogoData({
          hasCustomLogo: false,
          logoUrl: null,
        });
      }
    } catch (err: any) {
      console.warn('Logo no disponible o predeterminado:', err);
      setLogoData({
        hasCustomLogo: false,
        logoUrl: null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogo();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo es muy grande. El tamaño máximo es 5MB.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const token = localStorage.getItem('fcbv_token');
          
          const res = await fetch('/api/logo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              imageBase64: base64,
              filename: file.name,
              mimeType: file.type,
            }),
          });

          const resData = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(resData.error || 'Error al subir el logo');
          }

          await fetchLogo();
          window.dispatchEvent(new Event('fcbv_logo_updated'));
        } catch (innerErr: any) {
          console.error(innerErr);
          setError(innerErr.message || 'Ocurrió un error al guardar el logo.');
        } finally {
          setUploading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };

      reader.onerror = () => {
        setError('Error al leer el archivo seleccionado.');
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setError('Ocurrió un error al procesar el archivo.');
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar el logo personalizado y restablecer el escudo por defecto?')) {
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const token = localStorage.getItem('fcbv_token');
      const res = await fetch('/api/logo', {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const resData = await res.json().catch(() => ({}));
        throw new Error(resData.error || 'Error al eliminar el logo');
      }
      await fetchLogo();
      window.dispatchEvent(new Event('fcbv_logo_updated'));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocurrió un error al eliminar el logo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-indigo-600" />
        Logo Institucional
      </h3>
      
      {error && (
        <div className="mb-3 p-2 bg-red-50 text-red-700 rounded-lg text-[11px] flex items-start gap-1.5 border border-red-100">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="w-16 h-16 shrink-0 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden p-1">
          {loading ? (
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          ) : logoData?.hasCustomLogo && logoData.logoUrl ? (
            <img src={logoData.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="text-[10px] text-slate-400 text-center font-medium leading-tight">Escudo<br/>FCBV</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-1 space-y-2 text-xs">
          <p className="text-slate-500 text-[11px] leading-tight">
            Sube un logo personalizado (PNG, JPG, SVG) para los reportes oficiales. Tamaño máx. 5MB.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/png, image/jpeg, image/svg+xml, image/webp"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || loading}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg border border-indigo-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Subir Logo
            </button>
            
            {logoData?.hasCustomLogo && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={uploading || loading}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-lg border border-red-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Restablecer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
