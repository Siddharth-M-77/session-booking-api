import { connectDB, disconnectDB } from '../src/config/db';
import { Teacher } from '../src/models/teacher.model';

const sampleTeachers = [
  {
    fullName: 'Dr. Sarah Connor',
    email: 'sarah.connor@example.com',
    specialization: 'Quantum Physics & Mathematics',
    experience: 8,
  },
  {
    fullName: 'Prof. Alan Turing',
    email: 'alan.turing@example.com',
    specialization: 'Computer Science & Cryptography',
    experience: 12,
  },
  {
    fullName: 'Elena Rostova',
    email: 'elena.rostova@example.com',
    specialization: 'Machine Learning & Neural Networks',
    experience: 6,
  },
];

const seedTeachers = async (): Promise<void> => {
  try {
    console.log('🌱 Starting database seed...');
    await connectDB();

    for (const data of sampleTeachers) {
      const existing = await Teacher.findOne({ email: data.email });
      if (!existing) {
        const teacher = await Teacher.create(data);
        console.log(` Created teacher: ${teacher.fullName} (ID: ${teacher._id})`);
      } else {
        console.log(` Teacher already exists: ${existing.fullName} (ID: ${existing._id})`);
      }
    }

    console.log('✅ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
};

seedTeachers();
