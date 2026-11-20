import { spawn } from 'child_process';
import { getPythonCommand } from '../config/python.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Compare outputs by whitespace-separated tokens (standard competitive programming judging)
function compareTokens(actualOutput, expectedOutput) {
  const actualTokens = actualOutput.trim().split(/\s+/).filter(Boolean);
  const expectedTokens = expectedOutput.trim().split(/\s+/).filter(Boolean);

  if (actualTokens.length !== expectedTokens.length) {
    return false;
  }

  for (let i = 0; i < actualTokens.length; i++) {
    if (actualTokens[i] !== expectedTokens[i]) {
      return false;
    }
  }

  return true;
}

// Execute a single test case in a child Python process
function executeSingleTest(pythonFilePath, inputData, timeLimitMs) {
  return new Promise((resolve) => {
    const MAX_OUTPUT_BYTES = 256 * 1024; // 256 KB limit to prevent output flooding

    let stdoutData = '';
    let stderrData = '';
    let isTerminated = false;
    let isTimedOut = false;
    let isOutputExceeded = false;

    // Spawn child Python process
    const python = getPythonCommand();
    const child = spawn(python.command, [...python.args, pythonFilePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
        PYTHONIOENCODING: 'utf-8',
        PYTHONUNBUFFERED: '1',
      },
    });

    // Enforce per-test wall-clock timeout
    const timer = setTimeout(() => {
      isTimedOut = true;
      isTerminated = true;
      child.kill('SIGKILL');
    }, timeLimitMs);

    // A program may exit before consuming stdin; do not crash the server on EPIPE.
    child.stdin.on('error', () => {});

    // Feed input data through stdin
    try {
      child.stdin.write(inputData);
      child.stdin.end();
    } catch (err) {
      clearTimeout(timer);
      return resolve({ verdict: 'JUDGE_ERROR' });
    }

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
      if (Buffer.byteLength(stdoutData, 'utf8') > MAX_OUTPUT_BYTES) {
        isOutputExceeded = true;
        isTerminated = true;
        clearTimeout(timer);
        child.kill('SIGKILL');
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
      if (Buffer.byteLength(stderrData, 'utf8') > MAX_OUTPUT_BYTES) {
        isOutputExceeded = true;
        isTerminated = true;
        clearTimeout(timer);
        child.kill('SIGKILL');
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      console.error('Child process error:', err);
      resolve({ verdict: 'JUDGE_ERROR' });
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);

      if (isTimedOut) {
        return resolve({ verdict: 'TIME_LIMIT_EXCEEDED' });
      }

      if (isOutputExceeded) {
        return resolve({ verdict: 'OUTPUT_LIMIT_EXCEEDED' });
      }

      if (exitCode !== 0) {
        if (stderrData.includes('SyntaxError')) {
          return resolve({ verdict: 'SYNTAX_ERROR' });
        }
        return resolve({ verdict: 'RUNTIME_ERROR' });
      }

      resolve({
        verdict: 'COMPLETED',
        stdout: stdoutData,
      });
    });
  });
}

// Judge an entire submission against all test cases in position order
export async function judgeSubmission(sourceCode, testCases, timeLimitMs = 2000) {
  // Create an isolated temporary directory for this run
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codest_run_'));
  const pythonFilePath = path.join(tempDir, 'solution.py');

  try {
    // Write player's code to solution.py
    fs.writeFileSync(pythonFilePath, sourceCode, 'utf8');

    // Run test cases sequentially in position order
    for (const testCase of testCases) {
      const result = await executeSingleTest(
        pythonFilePath,
        testCase.input,
        timeLimitMs
      );

      // If execution did not complete normally, return verdict immediately
      if (result.verdict !== 'COMPLETED') {
        return { verdict: result.verdict };
      }

      // Check if output tokens match expected output
      const isCorrect = compareTokens(result.stdout, testCase.expectedOutput);
      if (!isCorrect) {
        return { verdict: 'WRONG_ANSWER' };
      }
    }

    // All test cases passed!
    return { verdict: 'ACCEPTED' };
  } catch (error) {
    console.error('Judge execution failure:', error);
    return { verdict: 'JUDGE_ERROR' };
  } finally {
    // Clean up temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error('Temp cleanup error:', cleanupErr);
    }
  }
}
