import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeScreenshot, extractDates, groupCategories } from '../src/lib/insights/analyze.ts';
import { createCalendarFile } from '../src/lib/insights/calendar.ts';

const screenshot = (text, extra = {}) => ({ id: 'sample-1', name: 'example.png', status: 'ready', text, ...extra });
const event = () => analyzeScreenshot(screenshot('Design workshop\nSeptember 12, 2026\nTime: 3:30 PM\nVenue: Main Hall')).suggestions[0];
const reviewed = { title: 'Design workshop', allDay: false, startAt: '2026-09-12T15:30:00+05:30', endAt: '2026-09-12T16:30:00+05:30' };

test('only ready OCR records get classified; empty OCR becomes Other', () => {
  assert.equal(analyzeScreenshot(screenshot('workshop', { status: 'processing' })).state, 'waiting-for-ocr');
  assert.deepEqual(analyzeScreenshot(screenshot('')).categories.map(c => c.id), ['other']);
});
test('multi-label categories and counts refer to real screenshot IDs', () => {
  const insights = [analyzeScreenshot(screenshot('Flight itinerary\nReceipt\nSubtotal: 100')), analyzeScreenshot(screenshot('Python programming lecture', { id: 'sample-2' }))];
  const groups = groupCategories(insights);
  assert.equal(groups.find(c => c.id === 'travel').count, 1);
  assert.deepEqual(groups.find(c => c.id === 'study').screenshotIds, ['sample-2']);
  assert.equal(groups.some(c => c.id === 'health'), false);
});
test('event draft includes source evidence and requires review', () => {
  const suggestion = event();
  assert.equal(suggestion.requiresReview, true);
  assert.equal(suggestion.method, 'local-ocr-rules');
  assert.equal(suggestion.draft.date, '2026-09-12');
  assert.equal(suggestion.draft.time, '15:30');
  assert.equal(suggestion.draft.location, 'Main Hall');
  assert.ok(suggestion.evidence.includes('Design workshop'));
});
test('ambiguous numeric dates and missing years are not guessed', () => {
  assert.equal(extractDates('03/04/2026')[0].date, null);
  assert.equal(extractDates('September 12')[0].date, null);
  assert.equal(extractDates('12 September 2026')[0].date, '2026-09-12');
  assert.equal(extractDates('23/09/2026')[0].date, '2026-09-23');
});
test('invalid dates are rejected rather than rolled into another month', () => {
  assert.equal(extractDates('2026-02-30')[0].date, null);
  assert.equal(extractDates('February 29, 2026')[0].date, null);
  assert.equal(extractDates('February 29, 2028')[0].date, '2028-02-29');
});
test('multiple dates are not silently reduced to the first date', () => {
  const s = analyzeScreenshot(screenshot('Conference\n2026-09-12\n2026-09-14')).suggestions[0];
  assert.equal(s.draft.date, null);
  assert.ok(s.warnings.some(w => w.includes('Several dates')));
});
test('relative dates need manual entry and event-free text makes no action', () => {
  const s = analyzeScreenshot(screenshot('Workshop tomorrow at 3 PM')).suggestions[0];
  assert.equal(s.draft.date, null);
  assert.equal(s.draft.time, '15:00');
  assert.equal(analyzeScreenshot(screenshot('Python programming notes 2026-09-12')).suggestions.length, 0);
});
test('credential screenshots do not generate calendar actions', () => {
  assert.equal(analyzeScreenshot(screenshot('Workshop\nPassword: secret\n2026-09-12')).suggestions.length, 0);
});
test('approval is mandatory and timed events require an explicit offset', () => {
  assert.throws(() => createCalendarFile(event(), reviewed, { approved: false }), /approval/i);
  assert.throws(() => createCalendarFile(event(), { ...reviewed, startAt: '2026-09-12T15:30' }, { approved: true }), /timezone/i);
  assert.throws(() => createCalendarFile(event(), { ...reviewed, endAt: reviewed.startAt }, { approved: true }), /after/);
});
test('timezone offsets convert to UTC; full OCR content is not exported', () => {
  const file = createCalendarFile(event(), reviewed, { approved: true });
  assert.match(file.content, /DTSTART:20260912T100000Z/);
  assert.match(file.content, /DTEND:20260912T110000Z/);
  assert.equal(file.content.includes('Venue: Main Hall'), false);
  assert.equal(file.content.includes('DESCRIPTION:'), false);
});
test('all-day events use exclusive end dates and reject bad dates', () => {
  const file = createCalendarFile(event(), { title: 'Workshop', allDay: true, startDate: '2026-09-12', endDate: '2026-09-13' }, { approved: true });
  assert.match(file.content, /DTSTART;VALUE=DATE:20260912/);
  assert.match(file.content, /DTEND;VALUE=DATE:20260913/);
  assert.throws(() => createCalendarFile(event(), { title: 'Workshop', allDay: true, startDate: '2026-02-30', endDate: '2026-03-02' }, { approved: true }), /valid/);
});
test('calendar text cannot inject properties and UTF-8 lines stay within 75 bytes', () => {
  const file = createCalendarFile(event(), { ...reviewed, title: 'Hello\r\nATTENDEE:evil', description: 'A,b;c\\d\n' + '🌸'.repeat(80) }, { approved: true });
  assert.equal(file.content.includes('\r\nATTENDEE:'), false);
  assert.ok(file.content.includes('A\\,b\\;c\\\\d\\n'));
  for (const line of file.content.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
});

const { reviewedEventFromForm } = await import('../src/lib/insights/review.ts');
const reviewForm = { title: 'Workshop', mode: 'timed', startDate: '2026-09-12', endDate: '2026-09-12', startTime: '15:30', endTime: '16:30', startOffset: '+05:30', endOffset: '+05:30', location: '', description: '', confirmed: true };
test('review form requires confirmation and explicit event type', () => {
  assert.throws(() => reviewedEventFromForm({ ...reviewForm, confirmed: false }), /Confirm/);
  assert.throws(() => reviewedEventFromForm({ ...reviewForm, mode: '' }), /Choose/);
});
test('review form keeps reviewed times and offsets', () => {
  const event = reviewedEventFromForm(reviewForm);
  assert.equal(event.startAt, '2026-09-12T15:30:00+05:30');
  assert.equal(event.endAt, '2026-09-12T16:30:00+05:30');
});
test('inclusive all-day review end rolls correctly into next month', () => {
  const event = reviewedEventFromForm({ ...reviewForm, mode: 'all-day', startDate: '2026-09-30', endDate: '2026-09-30' });
  assert.equal(event.endDate, '2026-10-01');
  assert.throws(() => reviewedEventFromForm({ ...reviewForm, mode: 'all-day', endDate: '2026-02-30' }), /valid/);
});
