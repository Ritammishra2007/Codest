import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import prisma from './config/prisma.js';
import authRoutes from './routes/authRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import { startJudgingService } from './services/judgingService.js';

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: 'Codest backend and PostgreSQL database are healthy.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed.',
    });
  }
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Codest 1v1 Python Duels API is running.',
  });
});

const PORT = process.env.PORT || 5001;

// Start background judging queue
startJudgingService();

// Start HTTP server on loopback
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Codest backend running on http://127.0.0.1:${PORT}`);
});
