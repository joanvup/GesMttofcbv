import React, { useState, useEffect } from 'react';

interface FcbvLogoProps {
  className?: string;
  size?: number;
}

export const FcbvLogo: React.FC<FcbvLogoProps> = ({ className = '', size = 76 }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const res = await fetch('/api/logo');
        if (res.ok) {
          const data = await res.json();
          if (data.hasCustomLogo && data.logoUrl) {
            setLogoUrl(`${data.logoUrl}?t=${Date.now()}`);
          } else {
            setLogoUrl(null);
          }
        } else {
          setLogoUrl(null);
        }
      } catch (error) {
        console.warn('Escudo predeterminado en uso:', error);
        setLogoUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLogo();

    const handleUpdate = () => {
      fetchLogo();
    };

    window.addEventListener('fcbv_logo_updated', handleUpdate);
    return () => {
      window.removeEventListener('fcbv_logo_updated', handleUpdate);
    };
  }, []);

  if (loading) {
    return <div style={{ width: size, height: size }} className={`shrink-0 ${className} animate-pulse bg-slate-100 rounded-full`} />;
  }

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Logo FCBV"
        width={size}
        height={size}
        className={`shrink-0 object-contain ${className}`}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={`shrink-0 select-none ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Curvas para el texto circular */}
        <path
          id="fcbv-top-arc"
          d="M 16,60 A 44,44 0 1,1 104,60"
          fill="none"
        />
        <path
          id="fcbv-bottom-arc"
          d="M 104,60 A 44,44 0 0,1 16,60"
          fill="none"
        />
      </defs>

      {/* Círculo exterior azul institucional */}
      <circle cx="60" cy="60" r="58" fill="#1b2a56" stroke="#0a1226" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="55" fill="none" stroke="#d4af37" strokeWidth="1" />

      {/* Anillo de texto */}
      <circle cx="60" cy="60" r="45" fill="#1b2a56" stroke="#ffffff" strokeWidth="0.8" />
      
      {/* Texto circular superior */}
      <text
        fill="#ffffff"
        fontSize="7.4"
        fontWeight="bold"
        letterSpacing="0.6"
        fontFamily="sans-serif"
      >
        <textPath href="#fcbv-top-arc" startOffset="50%" textAnchor="middle">
          FUNDACION COLEGIO BILINGUE
        </textPath>
      </text>

      {/* Texto circular inferior */}
      <text
        fill="#ffffff"
        fontSize="6.8"
        fontWeight="bold"
        letterSpacing="1"
        fontFamily="sans-serif"
      >
        <textPath href="#fcbv-bottom-arc" startOffset="50%" textAnchor="middle">
          • FOUNDED 1980 •
        </textPath>
      </text>

      {/* Círculo central blanco */}
      <circle cx="60" cy="60" r="35" fill="#ffffff" stroke="#1b2a56" strokeWidth="1.2" />

      {/* Escudo heráldico central */}
      <g transform="translate(37, 36) scale(0.77)">
        {/* Contorno del escudo */}
        <path
          d="M 5,5 L 55,5 L 55,36 C 55,54 30,62 30,62 C 30,62 5,54 5,36 Z"
          fill="#ffffff"
          stroke="#1b2a56"
          strokeWidth="2.5"
        />

        {/* División en cuadrantes con cruz azul */}
        <line x1="30" y1="5" x2="30" y2="60" stroke="#1b2a56" strokeWidth="2" />
        <line x1="5" y1="28" x2="55" y2="28" stroke="#1b2a56" strokeWidth="2" />

        {/* Cuadrante 1: Libro abierto del saber */}
        <path
          d="M 11,18 Q 18,15 25,18 L 25,23 Q 18,20 11,23 Z"
          fill="#1b2a56"
        />
        <path
          d="M 25,18 Q 21,15 15,17"
          stroke="#ffffff"
          strokeWidth="0.8"
          fill="none"
        />
        <line x1="18" y1="17" x2="18" y2="22" stroke="#ffffff" strokeWidth="0.8" />

        {/* Cuadrante 2: Pluma / Antorcha del conocimiento */}
        <path
          d="M 46,12 L 35,23 L 38,24 L 49,13 Z"
          fill="#d4af37"
          stroke="#1b2a56"
          strokeWidth="0.8"
        />
        <circle cx="48" cy="11" r="2.5" fill="#e11d48" />

        {/* Cuadrante 3: Camino hacia el horizonte / Olas */}
        <path
          d="M 10,40 Q 20,36 26,42"
          stroke="#1b2a56"
          strokeWidth="1.8"
          fill="none"
        />
        <path
          d="M 12,46 Q 20,42 26,48"
          stroke="#1b2a56"
          strokeWidth="1.8"
          fill="none"
        />

        {/* Cuadrante 4: Laurel / Estrella de excelencia */}
        <polygon
          points="42,35 44,40 49,40 45,43 47,48 42,45 37,48 39,43 35,40 40,40"
          fill="#d4af37"
          stroke="#1b2a56"
          strokeWidth="0.6"
        />
      </g>
    </svg>
  );
};
