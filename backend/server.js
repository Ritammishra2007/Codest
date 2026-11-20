import './config/env.js';
import { getPythonCommand } from './config/python.js';
import express from 'express';
import cors from 'cors';
import prisma from './config/prisma.js';
import authRoutes from './routes/authRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import { startJudgingService, stopJudgingService } from './services/judgingService.js';

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

const PORT = Number(process.env.PORT || 5001);
const HOST = process.env.HOST || '127.0.0.1';

async function start() {
  if (!process.env.JWT_SECRET || /replace_with|your_.*secret/i.test(process.env.JWT_SECRET)) {
    throw new Error('Set a unique JWT_SECRET in backend/.env. See the README for the command to generate one.');
  }
  getPythonCommand();
  await prisma.$connect();
  const server = app.listen(PORT, HOST, () => {
    console.log(`Codest backend running on http://${HOST}:${PORT}`);
    startJudgingService();
  });
  server.on('error', error => {
    console.error(`Server failed: ${error.message}`);
    process.exit(1);
  });
  async function shutdown() {
    stopJudgingService();
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
start().catch(async error => {
  console.error(`Startup failed: ${error.message}`);
  console.error('Check backend/.env and run npm run db:setup with PostgreSQL running.');
  await prisma.$disconnect();
  process.exitCode = 1;
});
