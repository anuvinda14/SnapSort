export function normalizeText(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
}
function distance(a: string[], b: string[]): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const row = [i + 1];
    for (let j = 0; j < b.length; j++) row.push(Math.min(row[j] + 1, previous[j + 1] + 1, previous[j] + Number(a[i] !== b[j])));
    previous = row;
  }
  return previous[b.length];
}
export function errorRates(reference: string, prediction: string) {
  const expected = normalizeText(reference), actual = normalizeText(prediction);
  if (!expected) return null;
  if (expected.length > 5000 || actual.length > 15000) return null;
  const chars = Array.from(expected), words = expected.split(' ');
  return { cer: distance(chars, Array.from(actual)) / chars.length, wer: distance(words, actual ? actual.split(' ') : []) / words.length };
}
