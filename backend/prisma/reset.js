import prisma from '../config/prisma.js';

async function resetDatabase() {
  console.log('Cleaning Codest database (wiping past duels, submissions, and users)...');

  // Delete records in foreign key dependency order
  await prisma.submission.deleteMany();
  console.log('✓ Cleared submissions');

  await prisma.room.deleteMany();
  console.log('✓ Cleared rooms');

  await prisma.testCase.deleteMany();
  console.log('✓ Cleared test cases');

  await prisma.problem.deleteMany();
  console.log('✓ Cleared problems');

  await prisma.user.deleteMany();
  console.log('✓ Cleared test users');

  console.log('Database successfully reset to a clean slate!');
  console.log('Run "node prisma/seed.js" if you need to reload the problem catalog.');
}

resetDatabase()
  .catch((err) => {
    console.error('Reset error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
