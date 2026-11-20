import '../config/env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeSubmission } from '../services/pythonRunner.js';

const cases = [{ input: '3 5', expectedOutput: '8' }];
test('Python runner executes and compares output', async () => {
  assert.equal((await judgeSubmission('a,b=map(int,input().split()); print(a+b)', cases)).verdict, 'ACCEPTED');
  assert.equal((await judgeSubmission('print(0)', cases)).verdict, 'WRONG_ANSWER');
});
test('Python runner reports syntax errors and timeouts', async () => {
  assert.equal((await judgeSubmission('def main(', cases)).verdict, 'SYNTAX_ERROR');
  assert.equal((await judgeSubmission('while True: pass', cases, 200)).verdict, 'TIME_LIMIT_EXCEEDED');
});
test('Python runner handles programs that exit without reading large input', async () => {
  const result = await judgeSubmission('print(8)', [{ input: 'x'.repeat(1024 * 1024), expectedOutput: '8' }]);
  assert.equal(result.verdict, 'ACCEPTED');
});
