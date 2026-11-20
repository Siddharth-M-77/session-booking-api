import mongoose from 'mongoose';
import { User, IUser } from '../models/user.model';
import { Session } from '../models/session.model';
import { SessionStatus } from '../constants/sessionStatus';
import { ApiError } from '../utils/ApiError';
import { CreateUserInput } from '../validators/user.validator';

export interface UserSessionsResult {
  userId: string;
  upcomingSessions: Array<{
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
  }>;
  completedSessions: Array<{
    sessionId: mongoose.Types.ObjectId;
    startTime: Date;
    endTime: Date;
    status: SessionStatus;
    completedAt: Date;
    teacher: {
      _id: mongoose.Types.ObjectId;
      fullName: string;
      specialization: string;
      experience: number;
    };
  }>;
  counts: {
    upcoming: number;
    completed: number;
  };
}

export const createUser = async (input: CreateUserInput): Promise<IUser> => {
  const existingUser = await User.findOne({ email: input.email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(409, 'A user with this email already exists');
  }

  const user = await User.create({
    fullName: input.fullName,
    email: input.email.toLowerCase(),
    phone: input.phone,
  });

  return user;
};

export const getUserById = async (id: string): Promise<IUser> => {
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return user;
};

export const getUserSessions = async (userId: string): Promise<UserSessionsResult> => {
  // Ensure the user exists before running aggregation
  await getUserById(userId);

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [facetResult] = await Session.aggregate<{
    upcoming: UserSessionsResult['upcomingSessions'];
    completed: UserSessionsResult['completedSessions'];
  }>([
    {
      $match: {
        userId: userObjectId,
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
      $facet: {
        upcoming: [
          {
            $match: {
              status: SessionStatus.BOOKED,
            },
          },
          {
            $sort: {
              startTime: 1,
            },
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
        ],
        completed: [
          {
            $match: {
              status: SessionStatus.COMPLETED,
            },
          },
          {
            $sort: {
              completedAt: -1,
            },
          },
          {
            $project: {
              _id: 0,
              sessionId: '$_id',
              startTime: 1,
              endTime: 1,
              status: 1,
              completedAt: 1,
              teacher: {
                _id: '$teacher._id',
                fullName: '$teacher.fullName',
                specialization: '$teacher.specialization',
                experience: '$teacher.experience',
              },
            },
          },
        ],
      },
    },
  ]);

  const upcomingSessions = facetResult?.upcoming || [];
  const completedSessions = facetResult?.completed || [];

  return {
    userId,
    upcomingSessions,
    completedSessions,
    counts: {
      upcoming: upcomingSessions.length,
      completed: completedSessions.length,
    },
  };
};
