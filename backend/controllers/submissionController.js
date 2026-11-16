import prisma from '../config/prisma.js';

// ==============================================================================
// 1. CREATE SUBMISSION
// ==============================================================================
export async function createSubmission(req, res) {
  try {
    const { roomId } = req.params;
    const { sourceCode } = req.body;
    const parsedRoomId = parseInt(roomId, 10);

    if (isNaN(parsedRoomId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room identifier.',
      });
    }

    if (!sourceCode || !sourceCode.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Source code cannot be empty.',
      });
    }

    // Limit source code size to 64 KB
    if (Buffer.byteLength(sourceCode, 'utf8') > 64 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'Source code exceeds maximum allowed size (64 KB).',
      });
    }

    // Execute atomic transaction for sequence allocation and submission insertion
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch room and verify state
      const room = await tx.room.findUnique({
        where: { id: parsedRoomId },
        select: {
          id: true,
          status: true,
          player1Id: true,
          player2Id: true,
          nextSubmissionSequence: true,
        },
      });

      if (!room) {
        throw new Error('ROOM_NOT_FOUND');
      }

      // Check participation
      const isParticipant =
        room.player1Id === req.user.id || room.player2Id === req.user.id;
      if (!isParticipant) {
        throw new Error('NOT_PARTICIPANT');
      }

      // Check room is active
      if (room.status !== 'ACTIVE') {
        throw new Error('ROOM_NOT_ACTIVE');
      }

      // Check if user already has an in-flight submission in this room
      const existingInFlight = await tx.submission.findFirst({
        where: {
          roomId: parsedRoomId,
          userId: req.user.id,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      });

      if (existingInFlight) {
        throw new Error('SUBMISSION_IN_PROGRESS');
      }

      // 2. Allocate the server order sequence number
      const sequenceNumber = room.nextSubmissionSequence;

      // 3. Increment room's next_submission_sequence
      await tx.room.update({
        where: { id: parsedRoomId },
        data: { nextSubmissionSequence: sequenceNumber + 1 },
      });

      // 4. Insert the submission into the queue
      const newSubmission = await tx.submission.create({
        data: {
          roomId: parsedRoomId,
          userId: req.user.id,
          sequenceNumber,
          sourceCode,
          status: 'PENDING',
          verdict: null,
        },
        select: {
          id: true,
          sequenceNumber: true,
          status: true,
          submittedAt: true,
        },
      });

      return newSubmission;
    });

    // Return HTTP 202 Accepted immediately
    return res.status(202).json({
      success: true,
      message: 'Submission received and queued for judging.',
      submissionId: result.id,
      sequenceNumber: result.sequenceNumber,
    });
  } catch (error) {
    if (error.message === 'ROOM_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }
    if (error.message === 'NOT_PARTICIPANT') {
      return res.status(403).json({ success: false, message: 'You are not a participant in this room.' });
    }
    if (error.message === 'ROOM_NOT_ACTIVE') {
      return res.status(400).json({ success: false, message: 'Submissions are only accepted while the duel is ACTIVE.' });
    }
    if (error.message === 'SUBMISSION_IN_PROGRESS') {
      return res.status(400).json({ success: false, message: 'You already have a submission being judged. Please wait.' });
    }

    console.error('Submission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while processing submission.',
    });
  }
}

// ==============================================================================
// 2. GET MY SUBMISSIONS FOR ROOM
// ==============================================================================
export async function getMySubmissions(req, res) {
  try {
    const { roomId } = req.params;
    const parsedRoomId = parseInt(roomId, 10);

    if (isNaN(parsedRoomId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room identifier.',
      });
    }

    // Only return the requesting user's submissions (privacy rule)
    const submissions = await prisma.submission.findMany({
      where: {
        roomId: parsedRoomId,
        userId: req.user.id,
      },
      orderBy: { sequenceNumber: 'desc' },
      select: {
        id: true,
        sequenceNumber: true,
        status: true,
        verdict: true,
        submittedAt: true,
        judgedAt: true,
      },
    });

    const formattedSubmissions = submissions.map((s) => ({
      id: s.id,
      sequence_number: s.sequenceNumber,
      status: s.status,
      verdict: s.verdict,
      submitted_at: s.submittedAt,
      judged_at: s.judgedAt,
    }));

    return res.status(200).json({
      success: true,
      submissions: formattedSubmissions,
    });
  } catch (error) {
    console.error('Get submissions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching submissions.',
    });
  }
}
