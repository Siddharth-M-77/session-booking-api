import { Teacher, ITeacher } from '../models/teacher.model';
import { ApiError } from '../utils/ApiError';
import { CreateTeacherInput } from '../validators/teacher.validator';

export const createTeacher = async (input: CreateTeacherInput): Promise<ITeacher> => {
  const existingTeacher = await Teacher.findOne({
    email: input.email.toLowerCase(),
  });

  if (existingTeacher) {
    throw new ApiError(409, 'A teacher with this email already exists');
  }

  const teacher = await Teacher.create({
    fullName: input.fullName,
    email: input.email.toLowerCase(),
    specialization: input.specialization,
    experience: input.experience,
  });

  return teacher;
};

export const getAllTeachers = async (): Promise<ITeacher[]> => {
  return Teacher.find().sort({ createdAt: -1 });
};

export const getTeacherById = async (id: string): Promise<ITeacher> => {
  const teacher = await Teacher.findById(id);
  if (!teacher) {
    throw new ApiError(404, 'Teacher not found');
  }
  return teacher;
};
