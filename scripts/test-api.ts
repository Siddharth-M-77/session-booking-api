import { createApp } from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { Server } from 'http';
import { env } from '../src/config/env';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown[];
}

const runTests = async () => {
  await connectDB();
  const app = createApp();
  const server: Server = app.listen(env.PORT + 10);
  const baseUrl = `http://127.0.0.1:${env.PORT + 10}`;

  console.log(`\n🧪 Running End-to-End API Test Suite against ${baseUrl}...\n`);

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string, detail?: unknown) => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error('     Detail:', JSON.stringify(detail, null, 2));
      failed++;
    }
  };

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    assert(healthRes.status === 200, 'GET /health returns 200');

    // 2. Extra: POST /teachers
    const teacherEmail = `test.teacher.${Date.now()}@example.com`;
    const createTeacherRes = await fetch(`${baseUrl}/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Prof. Richard Feynman',
        email: teacherEmail,
        specialization: 'Quantum Electrodynamics',
        experience: 15,
      }),
    });
    const teacherData = (await createTeacherRes.json()) as ApiResponse<{ _id: string }>;
    assert(createTeacherRes.status === 201, 'POST /teachers creates teacher (201)');
    const teacherId = teacherData.data?._id as string;
    assert(!!teacherId, 'Teacher ID returned in response');

    // 2b. Conflict on duplicate teacher email
    const duplicateTeacherRes = await fetch(`${baseUrl}/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Prof. Feynman Duplicate',
        email: teacherEmail,
        specialization: 'Quantum Electrodynamics',
        experience: 15,
      }),
    });
    assert(duplicateTeacherRes.status === 409, 'POST /teachers returns 409 on duplicate email');

    // 3. API 1: POST /users
    const userEmail = `test.user.${Date.now()}@example.com`;
    const createUserRes = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Alice Johnson',
        email: userEmail,
        phone: '+1-555-1234',
      }),
    });
    const userData = (await createUserRes.json()) as ApiResponse<{ _id: string }>;
    assert(createUserRes.status === 201, 'POST /users creates user (201)');
    const userId = userData.data?._id as string;
    assert(!!userId, 'User ID returned in response');

    // 3b. Conflict on duplicate user email
    const duplicateUserRes = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Alice Duplicate',
        email: userEmail,
        phone: '+1-555-9999',
      }),
    });
    assert(duplicateUserRes.status === 409, 'POST /users returns 409 on duplicate email');

    // 4. API 2: POST /sessions
    const now = new Date();
    // Target time today in UTC
    const session1Start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 0, 0),
    );
    const session1End = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 11, 0, 0),
    );

    const createSessionRes = await fetch(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId,
        startTime: session1Start.toISOString(),
        endTime: session1End.toISOString(),
      }),
    });
    const sessionData = (await createSessionRes.json()) as ApiResponse<{
      _id: string;
      status: string;
    }>;
    assert(createSessionRes.status === 201, 'POST /sessions creates session (201)');
    const sessionId = sessionData.data?._id as string;
    assert(sessionData.data?.status === 'AVAILABLE', 'New session status is AVAILABLE');

    // 4b. Fail on endTime <= startTime
    const invalidSessionRes = await fetch(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId,
        startTime: session1End.toISOString(),
        endTime: session1Start.toISOString(),
      }),
    });
    assert(
      invalidSessionRes.status === 400,
      'POST /sessions returns 400 when endTime <= startTime',
    );

    // 4c. Create session with epoch ms
    const session2Start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 14, 0, 0),
    );
    const session2End = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0),
    );
    const createSession2Res = await fetch(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId,
        startTime: session2Start.getTime(),
        endTime: session2End.getTime(),
      }),
    });
    const session2Data = (await createSession2Res.json()) as ApiResponse<{ _id: string }>;
    assert(createSession2Res.status === 201, 'POST /sessions accepts epoch ms (201)');
    const session2Id = session2Data.data?._id as string;

    // 5. API 3: GET /sessions/available?dateTimestamp={timestamp}
    const queryTimestamp = session1Start.getTime();
    const availableRes = await fetch(
      `${baseUrl}/sessions/available?dateTimestamp=${queryTimestamp}`,
    );
    const availableData = (await availableRes.json()) as ApiResponse<{
      count: number;
      sessions: Array<{ sessionId: string }>;
    }>;
    assert(availableRes.status === 200, 'GET /sessions/available returns 200 with aggregation');
    assert(
      (availableData.data?.count || 0) >= 2,
      'Available sessions count includes created sessions',
      availableData.data,
    );

    // 6. API 4: POST /sessions/:id/book
    const bookRes = await fetch(`${baseUrl}/sessions/${sessionId}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const bookData = (await bookRes.json()) as ApiResponse<{ status: string; userId: string }>;
    assert(bookRes.status === 200, 'POST /sessions/:id/book returns 200');
    assert(bookData.data?.status === 'BOOKED', 'Session status is now BOOKED');
    assert(bookData.data?.userId === userId, 'Session userId matches booking user');

    // 6b. Prevent race condition / double booking
    const doubleBookRes = await fetch(`${baseUrl}/sessions/${sessionId}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    assert(doubleBookRes.status === 409, 'POST /sessions/:id/book returns 409 on double booking');

    // 7. API 5: PATCH /sessions/:id/complete
    const completeRes = await fetch(`${baseUrl}/sessions/${sessionId}/complete`, {
      method: 'PATCH',
    });
    const completeData = (await completeRes.json()) as ApiResponse<{
      status: string;
      completedAt: string;
    }>;
    assert(completeRes.status === 200, 'PATCH /sessions/:id/complete returns 200');
    assert(completeData.data?.status === 'COMPLETED', 'Session status is now COMPLETED');
    assert(!!completeData.data?.completedAt, 'completedAt timestamp is populated');

    // 7b. Cannot complete an AVAILABLE session
    const completeAvailableRes = await fetch(`${baseUrl}/sessions/${session2Id}/complete`, {
      method: 'PATCH',
    });
    assert(
      completeAvailableRes.status === 409,
      'PATCH /sessions/:id/complete on AVAILABLE session returns 409',
    );

    // 8. Book second session for the user so user has 1 upcoming and 1 completed
    const book2Res = await fetch(`${baseUrl}/sessions/${session2Id}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    assert(book2Res.status === 200, 'Book second session returns 200');

    // 9. API 6: GET /users/:id/sessions (aggregation with facet)
    const userSessionsRes = await fetch(`${baseUrl}/users/${userId}/sessions`);
    const userSessionsData = (await userSessionsRes.json()) as ApiResponse<{
      userId: string;
      upcomingSessions: unknown[];
      completedSessions: unknown[];
      counts: { upcoming: number; completed: number };
    }>;
    assert(
      userSessionsRes.status === 200,
      'GET /users/:id/sessions returns 200 with facet pipeline',
    );
    assert(userSessionsData.data?.counts.upcoming === 1, 'Upcoming count is 1');
    assert(userSessionsData.data?.counts.completed === 1, 'Completed count is 1');

    // 10. Negative tests: Invalid ObjectId
    const invalidIdRes = await fetch(`${baseUrl}/users/123invalid/sessions`);
    assert(invalidIdRes.status === 400, 'Invalid ObjectId returns 400');

    // 11. Negative tests: 404 for unknown route
    const notFoundRes = await fetch(`${baseUrl}/api/non-existent`);
    assert(notFoundRes.status === 404, 'Unknown route returns 404');

    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    server.close();
    await disconnectDB();
  }
};

runTests();
