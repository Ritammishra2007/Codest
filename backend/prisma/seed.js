import '../config/env.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const problemsData = [
  {
    title: 'Sum of Two Numbers',
    description: 'Given two space-separated integers A and B, calculate and print their sum (A + B).',
    inputFormat: 'A single line containing two space-separated integers A and B.',
    outputFormat: 'Print the sum of A and B.',
    constraintsText: '-1000 <= A, B <= 1000',
    difficulty: 'EASY',
    timeLimitMs: 2000,
    testCases: [
      { position: 1, isSample: true, input: '3 5', expectedOutput: '8' },
      { position: 2, isSample: true, input: '10 -4', expectedOutput: '6' },
      { position: 3, isSample: false, input: '0 0', expectedOutput: '0' },
      { position: 4, isSample: false, input: '-50 -25', expectedOutput: '-75' },
      { position: 5, isSample: false, input: '999 1', expectedOutput: '1000' },
    ],
  },
  {
    title: 'Double the Number',
    description: 'Given a single integer N, multiply it by 2 and print the result.',
    inputFormat: 'A single line containing an integer N.',
    outputFormat: 'Print the value of N * 2.',
    constraintsText: '-10^4 <= N <= 10^4',
    difficulty: 'EASY',
    timeLimitMs: 2000,
    testCases: [
      { position: 1, isSample: true, input: '7', expectedOutput: '14' },
      { position: 2, isSample: true, input: '-3', expectedOutput: '-6' },
      { position: 3, isSample: false, input: '0', expectedOutput: '0' },
      { position: 4, isSample: false, input: '50', expectedOutput: '100' },
      { position: 5, isSample: false, input: '1000', expectedOutput: '2000' },
    ],
  },
  {
    title: 'Hello Name',
    description: "Given a person's name S, print a greeting in the format: Hello, <S>!",
    inputFormat: 'A single line containing a single word representing the name S.',
    outputFormat: 'Print Hello, <S>!',
    constraintsText: '1 <= length(S) <= 50, containing only letters.',
    difficulty: 'EASY',
    timeLimitMs: 2000,
    testCases: [
      { position: 1, isSample: true, input: 'Alice', expectedOutput: 'Hello, Alice!' },
      { position: 2, isSample: true, input: 'Bob', expectedOutput: 'Hello, Bob!' },
      { position: 3, isSample: false, input: 'World', expectedOutput: 'Hello, World!' },
      { position: 4, isSample: false, input: 'Codest', expectedOutput: 'Hello, Codest!' },
      { position: 5, isSample: false, input: 'Sam', expectedOutput: 'Hello, Sam!' },
    ],
  },
  {
    title: 'Even or Odd',
    description: 'Given an integer N, determine if it is even or odd. Print EVEN if the number is even, otherwise print ODD.',
    inputFormat: 'A single line containing an integer N.',
    outputFormat: 'Print EVEN or ODD.',
    constraintsText: '-10^5 <= N <= 10^5',
    difficulty: 'EASY',
    timeLimitMs: 2000,
    testCases: [
      { position: 1, isSample: true, input: '4', expectedOutput: 'EVEN' },
      { position: 2, isSample: true, input: '7', expectedOutput: 'ODD' },
      { position: 3, isSample: false, input: '0', expectedOutput: 'EVEN' },
      { position: 4, isSample: false, input: '-8', expectedOutput: 'EVEN' },
      { position: 5, isSample: false, input: '-3', expectedOutput: 'ODD' },
    ],
  },
];

async function main() {
  console.log('Seeding basic testing problem catalog into codest_db...');

  for (const prob of problemsData) {
    const existing = await prisma.problem.findFirst({
      where: { title: prob.title },
    });

    if (existing) {
      console.log(`Problem "${prob.title}" already exists, skipping.`);
      continue;
    }

    const created = await prisma.problem.create({
      data: {
        title: prob.title,
        description: prob.description,
        inputFormat: prob.inputFormat,
        outputFormat: prob.outputFormat,
        constraintsText: prob.constraintsText,
        difficulty: prob.difficulty,
        timeLimitMs: prob.timeLimitMs,
        testCases: {
          create: prob.testCases.map((tc) => ({
            position: tc.position,
            isSample: tc.isSample,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
          })),
        },
      },
    });

    console.log(`Created problem: "${created.title}" with ${prob.testCases.length} test cases.`);
  }

  console.log('Problem seeding complete!');
}

main()
  .catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
