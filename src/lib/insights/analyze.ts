import type { Screenshot } from '@/types';
import type { CategoryId, CategoryGroup, DateCandidate, ScreenshotInsight } from '@/insights-types';

export const CATEGORY_DEFINITIONS: { id: CategoryId; label: string; patterns: RegExp[] }[] = [
  { id: 'events', label: 'Events & appointments', patterns: [/\b(?:concert|conference|workshop|webinar|seminar|meetup|festival|hackathon|appointment|rsvp|wedding|birthday|event|meeting)\b/i] },
  { id: 'travel', label: 'Travel & tickets', patterns: [/\b(?:flight|boarding|itinerary|airport|airline|e-ticket|hotel|check-in|train|departure|arriv(?:al|e))\b/i] },
  { id: 'receipts', label: 'Receipts & bills', patterns: [/\b(?:receipt|invoice|subtotal|sales tax|bill to|amount due|payment due)\b/i] },
  { id: 'study', label: 'Study & learning', patterns: [/\b(?:lecture|syllabus|course|programming|quantum|theorem|homework|assignment|tutorial|study notes|exam)\b/i] },
  { id: 'health', label: 'Health & medical', patterns: [/\b(?:prescription|patient|diagnosis|medical|clinic|medication|treatment|dosage)\b/i] },
  { id: 'credentials', label: 'Passwords & access', patterns: [/\b(?:password|passcode|recovery code|backup (?:key|code)|2fa|wi-fi|wifi|verification code|secret key)\b/i] },
  { id: 'other', label: 'Other', patterns: [] },
];

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function validDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2199) return null;
  const test = new Date(Date.UTC(year, month - 1, day));
  if (test.getUTCFullYear() !== year || test.getUTCMonth() !== month - 1 || test.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function extractDates(text: string): DateCandidate[] {
  const candidates: DateCandidate[] = [];
  const seen = new Set<string>();
  const add = (raw: string, date: string | null, evidence: string, warning?: string) => {
    const key = `${raw}:${date}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ raw, date, evidence, ...(warning ? { warning } : {}) });
  };
  const monthPattern = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
  for (const line of text.split(/\r?\n/)) {
    for (const m of line.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
      const date = validDate(+m[1], +m[2], +m[3]);
      add(m[0], date, line, date ? undefined : 'Invalid date; correct it before exporting.');
    }
    for (const m of line.matchAll(new RegExp(`\\b${monthPattern}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'gi'))) {
      const date = m[3] ? validDate(+m[3], months.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2]) : null;
      add(m[0], date, line, !m[3] ? 'Year missing; choose the year.' : !date ? 'Invalid date; correct it before exporting.' : undefined);
    }
    for (const m of line.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${monthPattern}\\.?(?:,?\\s+(\\d{4}))?\\b`, 'gi'))) {
      const date = m[3] ? validDate(+m[3], months.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1]) : null;
      add(m[0], date, line, !m[3] ? 'Year missing; choose the year.' : !date ? 'Invalid date; correct it before exporting.' : undefined);
    }
    for (const m of line.matchAll(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/g)) {
      const a = +m[1], b = +m[2];
      if (a <= 12 && b <= 12 && a !== b) add(m[0], null, line, 'Ambiguous day/month order; select the intended date.');
      else {
        const date = a > 12 ? validDate(+m[3], b, a) : validDate(+m[3], a, b);
        add(m[0], date, line, date ? undefined : 'Invalid date; correct it before exporting.');
      }
    }
  }
  return candidates;
}

function times(text: string): string[] {
  const values = new Set<string>();
  for (const m of text.matchAll(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/gi)) {
    const hour = (+m[1] % 12) + (/p/i.test(m[3]) ? 12 : 0);
    values.add(`${String(hour).padStart(2, '0')}:${m[2] ?? '00'}`);
  }
  for (const m of text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]\.?m)/gi)) values.add(`${m[1].padStart(2, '0')}:${m[2]}`);
  return [...values];
}

export function analyzeScreenshot(screenshot: Screenshot): ScreenshotInsight {
  if (screenshot.status !== 'ready') return { screenshotId: screenshot.id, categories: [], suggestions: [], state: 'waiting-for-ocr' };
  const text = screenshot.text.trim();
  if (!text) return { screenshotId: screenshot.id, categories: [{ id: 'other', label: 'Other', evidence: [] }], suggestions: [], state: 'no-text' };
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const categories = CATEGORY_DEFINITIONS.filter(c => c.id !== 'other').flatMap(c => {
    const evidence = lines.filter(line => c.patterns.some(pattern => pattern.test(line))).slice(0, 3);
    return evidence.length ? [{ id: c.id, label: c.label, evidence }] : [];
  });
  if (!categories.length) categories.push({ id: 'other', label: 'Other', evidence: [] });
  const result: ScreenshotInsight = { screenshotId: screenshot.id, categories, suggestions: [], state: 'ready' };
  // Never copy credential-bearing documents into an external calendar file.
  if (categories.some(c => c.id === 'credentials')) return result;
  const eventLines = lines.filter(line => /\b(?:concert|conference|workshop|webinar|seminar|meetup|festival|hackathon|appointment|rsvp|wedding|birthday|meeting|event date|exam|assignment due|payment due|due date|departure|departs)\b/i.test(line));
  if (!eventLines.length) return result;
  const dates = extractDates(text);
  const timeCandidates = times(eventLines.join('\n') + '\n' + lines.filter(l => /\b(?:time|starts?|begins?|at)\b/i.test(l)).join('\n'));
  const titleLine = eventLines.find(l => !/^(?:date|time|departure|departs|payment due|due date)\b/i.test(l)) ?? eventLines[0];
  const title = titleLine.slice(0, 120);
  const location = lines.find(l => /^(?:venue|location)\s*:/i.test(l))?.replace(/^(?:venue|location)\s*:\s*/i, '').slice(0, 200) ?? '';
  const uniqueDates = [...new Set(dates.flatMap(d => d.date ? [d.date] : []))];
  const warnings = ['Review the title, date, time and timezone against the screenshot before approving.'];
  if (!dates.length) warnings.push('No supported explicit date found. Enter the event date yourself. Relative dates are not resolved.');
  if (dates.length > 1) warnings.push('Several dates appear in this screenshot. They may refer to different events; choose the correct one.');
  warnings.push(...dates.flatMap(d => d.warning ? [d.warning] : []));
  if (timeCandidates.length !== 1) warnings.push(timeCandidates.length ? 'Multiple possible times found. Select the correct start and end times.' : 'No explicit time found. Enter times or choose an all-day event.');
  if (categories.some(c => c.id === 'health')) warnings.push('This may contain medical information. Only include details you want in your calendar.');
  result.suggestions.push({
    id: `calendar-v1:${screenshot.id}`, screenshotId: screenshot.id, screenshotName: screenshot.name,
    type: 'calendar', title: 'Review for calendar', reason: 'The extracted text contains an event, appointment, departure or deadline cue.',
    method: 'local-ocr-rules', sourceText: text, evidence: eventLines.slice(0, 3), dateCandidates: dates, timeCandidates,
    warnings: [...new Set(warnings)], requiresReview: true,
    draft: { title, date: uniqueDates.length === 1 && dates.every(d => !!d.date) ? uniqueDates[0] : null, time: timeCandidates.length === 1 ? timeCandidates[0] : null, location },
  });
  return result;
}

export function groupCategories(insights: ScreenshotInsight[]): CategoryGroup[] {
  return CATEGORY_DEFINITIONS.map(({ id, label }) => {
    const screenshotIds = insights.filter(s => s.categories.some(c => c.id === id)).map(s => s.screenshotId);
    return { id, label, count: screenshotIds.length, screenshotIds };
  }).filter(c => c.count > 0);
}
