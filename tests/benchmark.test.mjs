import test from 'node:test';
import assert from 'node:assert/strict';
import { errorRates, normalizeText } from '../src/lib/benchmark/metrics.ts';
test('equivalent whitespace and Unicode normalize without losing case',()=>{
 assert.deepEqual(errorRates('café\nHello','cafe\u0301 Hello'),{cer:0,wer:0});
 assert.notEqual(normalizeText('Hello'),normalizeText('hello'));
});
test('missing reference cannot be scored',()=>assert.equal(errorRates('  ','anything'),null));
test('substitution, omission, and insertion count as errors',()=>{
 assert.deepEqual(errorRates('cat','cut'),{cer:1/3,wer:1});
 assert.deepEqual(errorRates('cat',''),{cer:1,wer:1});
 assert.equal(errorRates('a','a b c').wer,2);
});
test('punctuation matters and very large inputs are not scored',()=>{
 assert.ok(errorRates('Total: 154.06','Total: 15406').cer>0);
 assert.equal(errorRates('x'.repeat(5001),'x'),null);
});
