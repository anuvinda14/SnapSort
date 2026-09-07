import type { ReviewedCalendarEvent } from '@/insights-types';

export interface ReviewForm {
  title: string; mode: '' | 'timed' | 'all-day'; startDate: string; endDate: string;
  startTime: string; endTime: string; startOffset: string; endOffset: string;
  location: string; description: string; confirmed: boolean;
}

export function offsetFor(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  const offset = -(Number.isFinite(parsed.getTime()) ? parsed : new Date()).getTimezoneOffset();
  return `${offset >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
}

export function reviewedEventFromForm(form: ReviewForm): ReviewedCalendarEvent {
  if (!form.confirmed) throw new Error('Confirm that you reviewed the event details.');
  if (!form.mode) throw new Error('Choose a timed or all-day event.');
  if (!form.startDate || !form.endDate) throw new Error('Choose the start and end dates.');
  const common = { title: form.title, location: form.location, description: form.description };
  if (form.mode === 'all-day') {
    const date = new Date(`${form.endDate}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== form.endDate || form.endDate < form.startDate) throw new Error('Choose a valid last day on or after the start date.');
    date.setUTCDate(date.getUTCDate() + 1);
    return { ...common, allDay: true, startDate: form.startDate, endDate: date.toISOString().slice(0, 10) };
  }
  if (!/^\d{2}:\d{2}$/.test(form.startTime) || !/^\d{2}:\d{2}$/.test(form.endTime)) throw new Error('Choose both start and end times.');
  if (![form.startOffset, form.endOffset].every(value => /^(?:Z|[+-]\d{2}:\d{2})$/.test(value))) throw new Error('Use a UTC offset such as +05:30, -04:00, or Z.');
  return { ...common, allDay: false, startAt: `${form.startDate}T${form.startTime}:00${form.startOffset}`, endAt: `${form.endDate}T${form.endTime}:00${form.endOffset}` };
}
