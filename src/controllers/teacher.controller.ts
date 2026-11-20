import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import * as teacherService from '../services/teacher.service';

export const createTeacher = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const teacher = await teacherService.createTeacher(req.body);
  res.status(201).json(new ApiResponse(201, 'Teacher created successfully', teacher));
});

export const getAllTeachers = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const teachers = await teacherService.getAllTeachers();
  res.status(200).json(new ApiResponse(200, 'Teachers retrieved successfully', teachers));
});
