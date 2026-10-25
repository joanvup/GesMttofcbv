import { describe, expect, it } from 'vitest';
import {
  formatLocalDate,
  formatLocalDateTime,
  getDefaultMonthsForFrequency,
  getFirstBusinessDayOfMonth,
  isBusinessDay,
} from '../src/services/storage';

describe('Fechas locales', () => {
  it('formatLocalDate no retrocede ni adelanta el día', () => {
    const lateNight = new Date(2026, 0, 1, 23, 30);
    expect(formatLocalDate(lateNight)).toBe('2026-01-01');
  });

  it('formatLocalDate rellena mes y día con ceros', () => {
    expect(formatLocalDate(new Date(2026, 8, 5))).toBe('2026-09-05');
  });

  it('formatLocalDateTime devuelve el formato YYYY-MM-DD HH:mm', () => {
    expect(formatLocalDateTime(new Date(2026, 11, 31, 8, 5))).toBe('2026-12-31 08:05');
  });
});

describe('Días hábiles', () => {
  it('el primer día hábil de enero 2026 es el jueves 1', () => {
    // 1 de enero de 2026 cae en jueves
    expect(getFirstBusinessDayOfMonth(2026, 1)).toBe('2026-01-01');
  });

  it('salta el fin de semana cuando el mes inicia en sábado', () => {
    // 1 de agosto de 2026 cae en sábado -> primer hábil: lunes 3
    expect(getFirstBusinessDayOfMonth(2026, 8)).toBe('2026-08-03');
  });

  it('identifica correctamente días hábiles y de fin de semana', () => {
    expect(isBusinessDay('2026-01-05')).toBe(true); // lunes
    expect(isBusinessDay('2026-01-03')).toBe(false); // sábado
    expect(isBusinessDay('2026-01-04')).toBe(false); // domingo
  });
});

describe('Frecuencias de mantenimiento', () => {
  it('mensual programa los 12 meses', () => {
    const months = getDefaultMonthsForFrequency('mensual');
    expect(months).toHaveLength(12);
    expect(months.every(Boolean)).toBe(true);
  });

  it('trimestral programa 4 meses', () => {
    const months = getDefaultMonthsForFrequency('trimestral');
    expect(months.filter(Boolean)).toHaveLength(4);
  });

  it('semestral programa 2 meses', () => {
    const months = getDefaultMonthsForFrequency('semestral');
    expect(months.filter(Boolean)).toHaveLength(2);
  });

  it('anual programa 1 mes', () => {
    const months = getDefaultMonthsForFrequency('anual');
    expect(months.filter(Boolean)).toHaveLength(1);
  });

  it('personalizada respeta los meses indicados', () => {
    const months = getDefaultMonthsForFrequency('personalizada', [2, 6, 10]);
    expect(months[1]).toBe(true);
    expect(months[5]).toBe(true);
    expect(months[9]).toBe(true);
    expect(months.filter(Boolean)).toHaveLength(3);
  });
});
