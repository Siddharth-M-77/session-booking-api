import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import * as sessionService from '../services/session.service';

export const createSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const session = await sessionService.createSession(req.body);
  res.status(201).json(new ApiResponse(201, 'Session created successfully', session));
});

export const getAvailableSessions = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const dateTimestamp = Number(req.query.dateTimestamp);
    const result = await sessionService.getAvailableSessions(dateTimestamp);
    res.status(200).json(new ApiResponse(200, 'Available sessions retrieved successfully', result));
  },
);

export const bookSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { userId } = req.body;
  const session = await sessionService.bookSession(id, userId);
  res.status(200).json(new ApiResponse(200, 'Session booked successfully', session));
});

export const completeSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const session = await sessionService.completeSession(id);
  res.status(200).json(new ApiResponse(200, 'Session marked as completed successfully', session));
});
