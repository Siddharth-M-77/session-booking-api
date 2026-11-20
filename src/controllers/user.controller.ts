import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import * as userService from '../services/user.service';

export const createUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await userService.createUser(req.body);
  res.status(201).json(new ApiResponse(201, 'User created successfully', user));
});

export const getUserSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const sessions = await userService.getUserSessions(id);
  res.status(200).json(new ApiResponse(200, 'User sessions retrieved successfully', sessions));
});
