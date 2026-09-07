export type CategoryId = 'events' | 'travel' | 'receipts' | 'study' | 'health' | 'credentials' | 'other';
export interface CategoryMatch { id: CategoryId; label: string; evidence: string[] }
export interface CategoryGroup { id: CategoryId; label: string; count: number; screenshotIds: string[] }
export interface DateCandidate {
  raw: string;
  date: string | null;
  evidence: string;
  warning?: string;
}
export interface CalendarSuggestion {
  id: string;
  screenshotId: string;
  screenshotName: string;
  type: 'calendar';
  title: string;
  reason: string;
  method: 'local-ocr-rules';
  sourceText: string;
  evidence: string[];
  dateCandidates: DateCandidate[];
  timeCandidates: string[];
  warnings: string[];
  draft: { title: string; date: string | null; time: string | null; location: string };
  requiresReview: true;
}
export interface ScreenshotInsight {
  screenshotId: string;
  categories: CategoryMatch[];
  suggestions: CalendarSuggestion[];
  state: 'waiting-for-ocr' | 'ready' | 'no-text';
}
export type ReviewedCalendarEvent = {
  title: string;
  description?: string;
  location?: string;
} & (
  // All-day endDate is exclusive, as required by iCalendar.
  { allDay: true; startDate: string; endDate: string }
  // Timed dates must include Z or an explicit UTC offset. No guessed timezone.
  | { allDay: false; startAt: string; endAt: string }
);
export interface SuggestionDecision {
  id: string;
  screenshotId: string;
  sourceText: string;
  status: 'dismissed' | 'exported';
  updatedAt: number;
}
export interface CalendarFile { filename: string; content: string; mimeType: 'text/calendar;charset=utf-8' }
