import crypto from 'crypto';
import prisma from '../config/prisma.js';

// Generate a random 6-character uppercase alphanumeric room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid visually ambiguous chars (O, 0, I, 1)
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// ==============================================================================
// 1. CREATE ROOM
// ==============================================================================
export async function createRoom(req, res) {
  try {
    // Select a random problem from the seeded problem catalog
    const problemCount = await prisma.problem.count();
    if (problemCount === 0) {
      return res.status(500).json({
        success: false,
        message: 'No seeded problems found in database.',
      });
    }

    const randomSkip = Math.floor(Math.random() * problemCount);
    const chosenProblem = await prisma.problem.findFirst({
      skip: randomSkip,
      select: { id: true },
    });

    // Generate unique 6-character room code
    let roomCode = generateRoomCode();
    let collisionCheck = await prisma.room.findUnique({ where: { code: roomCode } });
    while (collisionCheck) {
      roomCode = generateRoomCode();
      collisionCheck = await prisma.room.findUnique({ where: { code: roomCode } });
    }

    // Insert room in WAITING state
    const newRoom = await prisma.room.create({
      data: {
        code: roomCode,
        problemId: chosenProblem.id,
        player1Id: req.user.id,
        status: 'WAITING',
        nextSubmissionSequence: 1,
      },
      select: {
        id: true,
        code: true,
        player1Id: true,
        player2Id: true,
        status: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Room created successfully.',
      room: {
        ...newRoom,
        player1_id: newRoom.player1Id,
        player2_id: newRoom.player2Id,
        problem: null, // Problem is strictly hidden during WAITING
      },
    });
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating room.',
    });
  }
}

// ==============================================================================
// 2. JOIN ROOM (ATOMIC OCCUPATION OF PLAYER 2)
// ==============================================================================
export async function joinRoom(req, res) {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a 6-character room code.',
      });
    }

    const cleanCode = code.trim().toUpperCase();

    // Find the room first to verify existence and participant rules
    const targetRoom = await prisma.room.findUnique({
      where: { code: cleanCode },
    });

    if (!targetRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found. Please check the code.',
      });
    }

    if (targetRoom.player1Id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You are already Player 1 in this room. You cannot duel against yourself.',
      });
    }

    if (targetRoom.status !== 'WAITING') {
      return res.status(400).json({
        success: false,
        message: `This room is already ${targetRoom.status.toLowerCase()}. You cannot join.`,
      });
    }

    // Atomic update to occupy player2 slot and transition room to ACTIVE
    const updateResult = await prisma.room.updateMany({
      where: {
        code: cleanCode,
        status: 'WAITING',
        player2Id: null,
      },
      data: {
        player2Id: req.user.id,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      return res.status(409).json({
        success: false,
        message: 'Could not join room. Another player may have just joined.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Joined room successfully. The duel is now ACTIVE!',
      room: {
        code: cleanCode,
        status: 'ACTIVE',
      },
    });
  } catch (error) {
    console.error('Join room error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while joining room.',
    });
  }
}

// ==============================================================================
// 3. GET ROOM STATE (POLLING ENDPOINT)
// ==============================================================================
export async function getRoom(req, res) {
  try {
    const { code } = req.params;
    const cleanCode = code.trim().toUpperCase();

    const room = await prisma.room.findUnique({
      where: { code: cleanCode },
      include: {
        player1: { select: { id: true, username: true } },
        player2: { select: { id: true, username: true } },
        winner: { select: { id: true, username: true } },
        problem: {
          include: {
            testCases: {
              where: { isSample: true },
              orderBy: { position: 'asc' },
              select: {
                id: true,
                position: true,
                isSample: true,
                input: true,
                expectedOutput: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found.',
      });
    }

    // Authorization check: only room participants can access private room data
    const isParticipant =
      room.player1Id === req.user.id || room.player2Id === req.user.id;

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a participant in this private room.',
      });
    }

    // Format response
    const formattedRoom = {
      id: room.id,
      code: room.code,
      status: room.status,
      player1_id: room.player1Id,
      player2_id: room.player2Id,
      player1_username: room.player1?.username || null,
      player2_username: room.player2?.username || null,
      winner_id: room.winnerId,
      winner_username: room.winner?.username || null,
      started_at: room.startedAt,
      ended_at: room.endedAt,
      created_at: room.createdAt,
    };

    // Problem details remain hidden while waiting for opponent
    if (room.status === 'WAITING') {
      formattedRoom.problem = null;
    } else {
      // Return problem statement and sample test cases only
      formattedRoom.problem = {
        id: room.problem.id,
        title: room.problem.title,
        description: room.problem.description,
        input_format: room.problem.inputFormat,
        output_format: room.problem.outputFormat,
        constraints_text: room.problem.constraintsText,
        difficulty: room.problem.difficulty,
        time_limit_ms: room.problem.timeLimitMs,
        samples: room.problem.testCases.map((tc) => ({
          position: tc.position,
          input: tc.input,
          expected_output: tc.expectedOutput,
        })),
      };
    }

    return res.status(200).json({
      success: true,
      room: formattedRoom,
    });
  } catch (error) {
    console.error('Get room error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching room details.',
    });
  }
}

// ==============================================================================
// 4. GET MY ROOMS
// ==============================================================================
export async function getMyRooms(req, res) {
  try {
    const rooms = await prisma.room.findMany({
      where: {
        OR: [{ player1Id: req.user.id }, { player2Id: req.user.id }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        player1: { select: { username: true } },
        player2: { select: { username: true } },
        winner: { select: { username: true } },
      },
    });

    const formattedRooms = rooms.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      player1_id: r.player1Id,
      player2_id: r.player2Id,
      player1_username: r.player1?.username || 'Host',
      player2_username: r.player2?.username || null,
      winner_id: r.winnerId,
      winner_username: r.winner?.username || null,
      created_at: r.createdAt,
    }));

    return res.status(200).json({
      success: true,
      rooms: formattedRooms,
    });
  } catch (error) {
    console.error('Get my rooms error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching rooms.',
    });
  }
}
