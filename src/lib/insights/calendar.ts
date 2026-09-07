import type { CalendarFile, CalendarSuggestion, ReviewedCalendarEvent } from '@/insights-types';

function dateOnly(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Use a complete date in YYYY-MM-DD format.');
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 2199 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Choose a valid calendar date.');
  return value.replace(/-/g, '');
}

function timestamp(value: string): Date {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!m) throw new Error('Timed events require a date, time and explicit timezone offset.');
  dateOnly(m[1]);
  if (+m[2] > 23 || +m[3] > 59 || +(m[4] ?? 0) > 59 || +(m[6] ?? 0) > 14 || +(m[7] ?? 0) > 59 || (+m[6] === 14 && +m[7] !== 0)) throw new Error('Invalid time or timezone offset.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid event time.');
  return date;
}

function utc(date: Date): string { return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}
function fold(line: string): string {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = '', bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) { lines.push(current); current = ' '; bytes = 1; }
    current += character; bytes += length;
  }
  lines.push(current);
  return lines.join('\r\n');
}

export function createCalendarFile(suggestion: CalendarSuggestion, event: ReviewedCalendarEvent, approval: { approved: true }): CalendarFile {
  if (approval?.approved !== true) throw new Error('Explicit approval is required before exporting a calendar event.');
  if (!event || typeof event.title !== 'string') throw new Error('Review the event details before exporting.');
  const title = event.title.trim();
  if ([title, event.description ?? '', event.location ?? ''].some(value => /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value))) throw new Error('Remove unsupported control characters from event details.');
  if (!title) throw new Error('Enter an event title.');
  if (title.length > 300 || (event.description?.length ?? 0) > 4000 || (event.location?.length ?? 0) > 500) throw new Error('Event details are too long. Shorten them before exporting.');
  let dates: string[];
  if (event.allDay) {
    const start = dateOnly(event.startDate), end = dateOnly(event.endDate);
    if (end <= start) throw new Error('All-day end date must be after the start date (exclusive).');
    dates = [`DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`];
  } else {
    const start = timestamp(event.startAt), end = timestamp(event.endAt);
    if (end <= start) throw new Error('Event end must be after its start.');
    dates = [`DTSTART:${utc(start)}`, `DTEND:${utc(end)}`];
  }
  const safeId = suggestion.screenshotId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || 'event';
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SnapSort//Reviewed Event Export//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:snapsort-${safeId}@local.snapsort`, `DTSTAMP:${utc(new Date())}`,
    ...dates, `SUMMARY:${escapeText(title)}`,
    ...(event.location?.trim() ? [`LOCATION:${escapeText(event.location.trim())}`] : []),
    // Deliberately export only the description the user reviewed, never the full OCR text.
    ...(event.description?.trim() ? [`DESCRIPTION:${escapeText(event.description.trim())}`] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return { filename: `snapsort-${safeId}.ics`, mimeType: 'text/calendar;charset=utf-8', content: lines.map(fold).join('\r\n') + '\r\n' };
}

/** Call from the user's explicit Approve & download interaction. No calendar API is contacted. */
export function downloadCalendarFile(file: CalendarFile): void {
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = file.filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
