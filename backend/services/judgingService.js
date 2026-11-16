import prisma from '../config/prisma.js';
import { judgeSubmission } from './pythonRunner.js';

let isJudging = false;
let pollingInterval = null;

// ==============================================================================
// 1. CRASH RECOVERY
// ==============================================================================
export async function recoverInterruptedSubmissions() {
  try {
    const interrupted = await prisma.submission.updateMany({
      where: { status: 'RUNNING' },
      data: { status: 'PENDING' },
    });

    if (interrupted.count > 0) {
      console.log(`[Recovery] Reset ${interrupted.count} interrupted submission(s) from RUNNING back to PENDING.`);
    }
  } catch (error) {
    console.error('[Recovery Error]: Failed to recover interrupted submissions:', error);
  }
}

// ==============================================================================
// 2. PROCESS NEXT SUBMISSION
// ==============================================================================
async function processNextPendingSubmission() {
  if (isJudging) return;
  isJudging = true;

  try {
    // Find active rooms that have pending submissions
    const activeRooms = await prisma.room.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, problemId: true },
    });

    for (const room of activeRooms) {
      // Find the earliest submission in server sequence order
      const nextSubmission = await prisma.submission.findFirst({
        where: {
          roomId: room.id,
          status: 'PENDING',
        },
        orderBy: { sequenceNumber: 'asc' },
        include: {
          room: {
            include: {
              problem: {
                include: {
                  testCases: {
                    orderBy: { position: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

      if (!nextSubmission) continue;

      // Mark submission as RUNNING
      await prisma.submission.update({
        where: { id: nextSubmission.id },
        data: { status: 'RUNNING' },
      });

      console.log(`[Judge] Room ${room.id}: Running submission #${nextSubmission.sequenceNumber} (User: ${nextSubmission.userId})...`);

      // Run Python execution against problem test cases
      const problem = nextSubmission.room.problem;
      const result = await judgeSubmission(
        nextSubmission.sourceCode,
        problem.testCases,
        problem.timeLimitMs
      );

      // Save verdict and mark DONE
      await prisma.submission.update({
        where: { id: nextSubmission.id },
        data: {
          status: 'DONE',
          verdict: result.verdict,
          judgedAt: new Date(),
        },
      });

      console.log(`[Judge] Room ${room.id}: Submission #${nextSubmission.sequenceNumber} verdict: ${result.verdict}`);

      // If ACCEPTED, this submission is the winner!
      if (result.verdict === 'ACCEPTED') {
        // Atomically record winner and finish room
        const updatedRoom = await prisma.room.updateMany({
          where: {
            id: room.id,
            status: 'ACTIVE',
          },
          data: {
            status: 'FINISHED',
            winnerId: nextSubmission.userId,
            endedAt: new Date(),
          },
        });

        if (updatedRoom.count > 0) {
          console.log(`[Winner] Room ${room.id}: User ${nextSubmission.userId} WON with submission #${nextSubmission.sequenceNumber}!`);

          // Cancel remaining pending submissions in this finished room
          await prisma.submission.updateMany({
            where: {
              roomId: room.id,
              status: 'PENDING',
            },
            data: {
              status: 'CANCELLED',
            },
          });
        }
      }
    }
  } catch (error) {
    console.error('[Judge Error]:', error);
  } finally {
    isJudging = false;
  }
}

// ==============================================================================
// 3. START BACKGROUND JUDGING SERVICE
// ==============================================================================
export function startJudgingService() {
  console.log('[Judge] Starting background judging queue worker...');
  recoverInterruptedSubmissions();

  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(processNextPendingSubmission, 500);
}

export function stopJudgingService() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
