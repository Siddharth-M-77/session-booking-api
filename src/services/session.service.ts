import mongoose from 'mongoose';
import { Session, ISession } from '../models/session.model';
import { SessionStatus } from '../constants/sessionStatus';
import { ApiError } from '../utils/ApiError';
import { getTeacherById } from './teacher.service';
import { getUserById } from './user.service';
import { CreateSessionInput } from '../validators/session.validator';

export interface AvailableSessionItem {
  sessionId: mongoose.Types.ObjectId;
  startTime: Date;
  endTime: Date;
  status: SessionStatus;
  teacher: {
    _id: mongoose.Types.ObjectId;
    fullName: string;
    specialization: string;
    experience: number;
  };
}

export interface AvailableSessionsResult {
  date: string;
  count: number;
  sessions: AvailableSessionItem[];
}

export const createSession = async (input: CreateSessionInput): Promise<ISession> => {
  // Validate teacher exists
  await getTeacherById(input.teacherId);

  const session = await Session.create({
    teacherId: new mongoose.Types.ObjectId(input.teacherId),
    userId: null,
    startTime: input.startTime,
    endTime: input.endTime,
    status: SessionStatus.AVAILABLE,
    completedAt: null,
  });

  return session;
};

export const getAvailableSessions = async (
  dateTimestamp: number,
): Promise<AvailableSessionsResult> => {
  const targetDate = new Date(dateTimestamp);

  // Calculate start of day (00:00:00.000) and end of day (23:59:59.999) in UTC
  const dayStart = new Date(
    Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const dayEnd = new Date(
    Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  const sessions = await Session.aggregate<AvailableSessionItem>([
    {
      $match: {
        status: SessionStatus.AVAILABLE,
        startTime: {
          $gte: dayStart,
          $lte: dayEnd,
        },
      },
    },
    {
      $lookup: {
        from: 'teachers',
        localField: 'teacherId',
        foreignField: '_id',
        as: 'teacher',
      },
    },
    {
      $unwind: '$teacher',
    },
    {
      $project: {
        _id: 0,
        sessionId: '$_id',
        startTime: 1,
        endTime: 1,
        status: 1,
        teacher: {
          _id: '$teacher._id',
          fullName: '$teacher.fullName',
          specialization: '$teacher.specialization',
          experience: '$teacher.experience',
        },
      },
    },
    {
      $sort: {
        startTime: 1,
      },
    },
  ]);

  const dateString = dayStart.toISOString().split('T')[0];

  return {
    date: dateString,
    count: sessions.length,
    sessions,
  };
};

export const bookSession = async (sessionId: string, userId: string): Promise<ISession> => {
  // 1. Verify user exists
  await getUserById(userId);

  // 2. Atomic findOneAndUpdate with condition status = AVAILABLE to prevent race conditions / double bookings
  const updatedSession = await Session.findOneAndUpdate(
    {
      _id: sessionId,
      status: SessionStatus.AVAILABLE,
    },
    {
      $set: {
        status: SessionStatus.BOOKED,
        userId: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  // 3. Handle conflict or non-existent session
  if (!updatedSession) {
    const existingSession = await Session.findById(sessionId);
    if (!existingSession) {
      throw new ApiError(404, 'Session not found');
    }

    throw new ApiError(409, `Session is already ${existingSession.status.toLowerCase()}`);
  }

  return updatedSession;
};

export const completeSession = async (sessionId: string): Promise<ISession> => {
  // Atomic findOneAndUpdate with condition status = BOOKED
  const completedSession = await Session.findOneAndUpdate(
    {
      _id: sessionId,
      status: SessionStatus.BOOKED,
    },
    {
      $set: {
        status: SessionStatus.COMPLETED,
        completedAt: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!completedSession) {
    const existingSession = await Session.findById(sessionId);
    if (!existingSession) {
      throw new ApiError(404, 'Session not found');
    }

    throw new ApiError(
      409,
      `Session cannot be marked as completed because current status is ${existingSession.status}`,
    );
  }

  return completedSession;
};
