import '../config/env.js';
import { getPythonCommand } from '../config/python.js';
try {
  const python = getPythonCommand();
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in backend/.env.');
  if (!process.env.JWT_SECRET || /replace_with|your_.*secret/i.test(process.env.JWT_SECRET)) {
    throw new Error('Set a unique JWT_SECRET in backend/.env.');
  }
  console.log(`Node ${process.versions.node}; Python: ${python.command} ${python.args.join(' ')}`);
  console.log('Environment configuration present. Database connectivity is checked at server startup.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
