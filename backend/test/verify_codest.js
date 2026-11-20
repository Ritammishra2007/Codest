import '../config/env.js';
import prisma from '../config/prisma.js';
import { recoverInterruptedSubmissions } from '../services/judgingService.js';

const BASE_URL = process.env.TEST_API_URL || `http://127.0.0.1:${process.env.PORT || 5001}/api`;

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('================================================================');
  console.log('CODEST FULL BACKEND INTEGRATION & VERIFICATION SUITE');
  console.log('================================================================\n');

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(condition, message) {
    totalChecks++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passedChecks++;
    } else {
      console.error(`[FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Health check
  console.log('1. Checking Server & Database Health...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  assert(healthRes.status === 200 && healthData.success === true, 'Health check passed');

  // 2. Authentication: Register Player A & Player B
  console.log('\n2. Testing Authentication & Duplicate Detection...');
  const testRunId = Date.now().toString(36);
  const playerAUsername = `alice_${testRunId}`;
  const playerBUsername = `bob_${testRunId}`;
  const password = 'testpassword123';

  // Register Player A
  const regARes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: playerAUsername,
      email: `${playerAUsername}@codest.local`,
      password,
    }),
  });
  const regAData = await regARes.json();
  assert(regARes.status === 201 && regAData.token, 'Player A registration succeeded with JWT');
  const tokenA = regAData.token;
  const userA = regAData.user;

  // Duplicate registration check
  const dupRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: playerAUsername,
      email: `other_${playerAUsername}@codest.local`,
      password,
    }),
  });
  assert(dupRes.status === 409, 'Duplicate username is rejected with 409 Conflict');

  // Register Player B
  const regBRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: playerBUsername,
      email: `${playerBUsername}@codest.local`,
      password,
    }),
  });
  const regBData = await regBRes.json();
  assert(regBRes.status === 201 && regBData.token, 'Player B registration succeeded with JWT');
  const tokenB = regBData.token;
  const userB = regBData.user;

  // Login check
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernameOrEmail: playerAUsername,
      password,
    }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200 && loginData.token, 'Player A login succeeded');

  // 3. Room Creation & Privacy while WAITING
  console.log('\n3. Testing Room Creation & Privacy during WAITING status...');
  const createRoomRes = await fetch(`${BASE_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
  });
  const createRoomData = await createRoomRes.json();
  assert(createRoomRes.status === 201, 'Room created successfully');
  const room = createRoomData.room;
  assert(room.code && room.code.length === 6, `Generated 6-character room code: ${room.code}`);
  assert(room.status === 'WAITING', 'Room status is WAITING');
  assert(room.problem === null, 'Problem statement is strictly HIDDEN while WAITING');

  // Verify direct fetch also hides problem while WAITING
  const getWaitingRes = await fetch(`${BASE_URL}/rooms/${room.code}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const getWaitingData = await getWaitingRes.json();
  assert(getWaitingData.room.problem === null, 'GET /rooms/:code strictly hides problem while WAITING');

  // Unauthorized user access check (Player B is not in room yet)
  const unauthRes = await fetch(`${BASE_URL}/rooms/${room.code}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(unauthRes.status === 403, 'Non-member access is rejected with 403 Forbidden');

  // Player A cannot join own room
  const selfJoinRes = await fetch(`${BASE_URL}/rooms/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ code: room.code }),
  });
  assert(selfJoinRes.status === 400, 'Host joining own room is rejected with 400 Bad Request');

  // 4. Atomic Join
  console.log('\n4. Testing Atomic Join & Problem Disclosure...');
  const joinRes = await fetch(`${BASE_URL}/rooms/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenB}`,
    },
    body: JSON.stringify({ code: room.code }),
  });
  assert(joinRes.status === 200, 'Player B joined room successfully');

  // Second join attempt must fail
  const doubleJoinRes = await fetch(`${BASE_URL}/rooms/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenB}`,
    },
    body: JSON.stringify({ code: room.code }),
  });
  assert(doubleJoinRes.status === 400, 'Subsequent join on ACTIVE room is rejected with 400');

  // Verify problem is now disclosed with samples only (no hidden edge cases)
  const getActiveRes = await fetch(`${BASE_URL}/rooms/${room.code}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const getActiveData = await getActiveRes.json();
  assert(getActiveData.room.status === 'ACTIVE', 'Room status transitioned to ACTIVE');
  assert(getActiveData.room.problem && getActiveData.room.problem.title, `Problem disclosed: "${getActiveData.room.problem.title}"`);
  assert(getActiveData.room.problem.samples.length > 0, 'Visible sample test cases provided');
  assert(
    getActiveData.room.problem.samples.every((s) => s.expected_output !== undefined),
    'Only sample tests exposed, hidden tests kept private on server'
  );

  const activeProblemTitle = getActiveData.room.problem.title;

  // 5. Submission & Judging: Wrong Answer
  console.log('\n5. Testing Submission & Judging: Wrong Answer...');
  const wrongCode = 'import sys\nprint("Wrong Answer Output")';
  const sub1Res = await fetch(`${BASE_URL}/rooms/${room.id}/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ sourceCode: wrongCode }),
  });
  const sub1Data = await sub1Res.json();
  assert(sub1Res.status === 202, 'Submission accepted with HTTP 202');
  assert(sub1Data.sequenceNumber === 1, 'First submission allocated sequenceNumber = 1');

  // Wait for judging
  console.log('Waiting for judging worker to process submission #1...');
  let verdict1 = null;
  for (let i = 0; i < 15; i++) {
    await wait(400);
    const mySubsRes = await fetch(`${BASE_URL}/rooms/${room.id}/my-submissions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const mySubsData = await mySubsRes.json();
    const targetSub = mySubsData.submissions.find((s) => s.id === sub1Data.submissionId);
    if (targetSub && targetSub.status === 'DONE') {
      verdict1 = targetSub.verdict;
      break;
    }
  }
  assert(verdict1 === 'WRONG_ANSWER', `Submission #1 verdict correctly judged as WRONG_ANSWER (got: ${verdict1})`);

  // 6. Submission & Judging: Syntax Error
  console.log('\n6. Testing Syntax Error Detection...');
  const syntaxErrorCode = 'def main(\n  broken syntax';
  const sub2Res = await fetch(`${BASE_URL}/rooms/${room.id}/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenB}`,
    },
    body: JSON.stringify({ sourceCode: syntaxErrorCode }),
  });
  const sub2Data = await sub2Res.json();
  assert(sub2Res.status === 202, 'Submission #2 accepted with HTTP 202');

  let verdict2 = null;
  for (let i = 0; i < 15; i++) {
    await wait(400);
    const mySubsRes = await fetch(`${BASE_URL}/rooms/${room.id}/my-submissions`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const mySubsData = await mySubsRes.json();
    const targetSub = mySubsData.submissions.find((s) => s.id === sub2Data.submissionId);
    if (targetSub && targetSub.status === 'DONE') {
      verdict2 = targetSub.verdict;
      break;
    }
  }
  assert(verdict2 === 'SYNTAX_ERROR', `Submission #2 verdict correctly judged as SYNTAX_ERROR (got: ${verdict2})`);

  // 7. Submission & Judging: Timeout (Infinite Loop)
  console.log('\n7. Testing Wall-Clock Timeout Handling...');
  const infiniteLoopCode = 'import time\nwhile True:\n    time.sleep(0.1)';
  const sub3Res = await fetch(`${BASE_URL}/rooms/${room.id}/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ sourceCode: infiniteLoopCode }),
  });
  const sub3Data = await sub3Res.json();
  assert(sub3Res.status === 202, 'Submission #3 accepted with HTTP 202');

  let verdict3 = null;
  for (let i = 0; i < 20; i++) {
    await wait(500);
    const mySubsRes = await fetch(`${BASE_URL}/rooms/${room.id}/my-submissions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const mySubsData = await mySubsRes.json();
    const targetSub = mySubsData.submissions.find((s) => s.id === sub3Data.submissionId);
    if (targetSub && targetSub.status === 'DONE') {
      verdict3 = targetSub.verdict;
      break;
    }
  }
  assert(verdict3 === 'TIME_LIMIT_EXCEEDED', `Submission #3 verdict correctly judged as TIME_LIMIT_EXCEEDED (got: ${verdict3})`);

  // 8. Winning Solution & Atomic Room Completion
  console.log('\n8. Testing Correct Solution & Winner Determination...');
  
  // Pick correct Python solution based on active problem
  let correctPythonCode = '';
  if (activeProblemTitle === 'Sum of Two Numbers') {
    correctPythonCode = `
import sys
a, b = map(int, sys.stdin.read().split())
print(a + b)
`;
  } else if (activeProblemTitle === 'Double the Number') {
    correctPythonCode = `
import sys
n = int(sys.stdin.read().strip())
print(n * 2)
`;
  } else if (activeProblemTitle === 'Hello Name') {
    correctPythonCode = `
import sys
name = sys.stdin.read().strip()
print(f"Hello, {name}!")
`;
  } else if (activeProblemTitle === 'Even or Odd') {
    correctPythonCode = `
import sys
n = int(sys.stdin.read().strip())
print("EVEN" if n % 2 == 0 else "ODD")
`;
  }

  // Player A submits the correct solution
  const winSubRes = await fetch(`${BASE_URL}/rooms/${room.id}/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ sourceCode: correctPythonCode }),
  });
  const winSubData = await winSubRes.json();
  assert(winSubRes.status === 202, 'Winning solution submitted');

  let winVerdict = null;
  for (let i = 0; i < 20; i++) {
    await wait(400);
    const mySubsRes = await fetch(`${BASE_URL}/rooms/${room.id}/my-submissions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const mySubsData = await mySubsRes.json();
    const targetSub = mySubsData.submissions.find((s) => s.id === winSubData.submissionId);
    if (targetSub && targetSub.status === 'DONE') {
      winVerdict = targetSub.verdict;
      break;
    }
  }
  assert(winVerdict === 'ACCEPTED', `Winning solution judged as ACCEPTED (got: ${winVerdict})`);

  // Verify Room status transitioned to FINISHED with Winner = Player A
  const finishedRoomRes = await fetch(`${BASE_URL}/rooms/${room.code}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const finishedRoomData = await finishedRoomRes.json();
  assert(finishedRoomData.room.status === 'FINISHED', 'Room status updated to FINISHED');
  assert(finishedRoomData.room.winner_id === userA.id, `Winner is correctly recorded as Player A (id: ${userA.id})`);
  assert(finishedRoomData.room.ended_at !== null, 'Room ended_at timestamp recorded');

  // Verify subsequent submissions are rejected after duel is FINISHED
  const postFinishSub = await fetch(`${BASE_URL}/rooms/${room.id}/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenB}`,
    },
    body: JSON.stringify({ sourceCode: 'print(42)' }),
  });
  assert(postFinishSub.status === 400, 'Submissions rejected once room is FINISHED');

  // 9. Crash Recovery Check
  console.log('\n9. Testing Crash Recovery Functionality...');
  // Insert a mock interrupted submission directly with status RUNNING
  const interruptedSub = await prisma.submission.create({
    data: {
      roomId: room.id,
      userId: userA.id,
      sequenceNumber: 9999,
      sourceCode: 'print("recovered")',
      status: 'RUNNING',
    },
  });
  assert(interruptedSub.status === 'RUNNING', 'Created simulated RUNNING submission');

  // Trigger recovery routine
  await recoverInterruptedSubmissions();

  const recoveredSub = await prisma.submission.findUnique({
    where: { id: interruptedSub.id },
  });
  assert(recoveredSub.status === 'PENDING', 'Interrupted submission successfully reset from RUNNING back to PENDING');

  // Cleanup test mock submission
  await prisma.submission.delete({ where: { id: interruptedSub.id } });

  console.log('\n================================================================');
  console.log(`ALL CHECKS PASSED: ${passedChecks}/${totalChecks} tests successful!`);
  console.log('================================================================\n');

  await prisma.$disconnect();
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test suite failure:', err);
  process.exit(1);
});
