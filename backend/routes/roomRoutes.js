import express from 'express';
import {
  createRoom,
  joinRoom,
  getRoom,
  getMyRooms,
} from '../controllers/roomController.js';
import {
  createSubmission,
  getMySubmissions,
} from '../controllers/submissionController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// All room routes require authentication
router.use(authMiddleware);

// Room management
router.post('/', createRoom);
router.post('/join', joinRoom);
router.get('/my-rooms', getMyRooms);
router.get('/:code', getRoom);

// Submissions within room
router.post('/:roomId/submissions', createSubmission);
router.get('/:roomId/my-submissions', getMySubmissions);

export default router;
