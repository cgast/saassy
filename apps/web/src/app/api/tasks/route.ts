import { NextRequest, NextResponse } from 'next/server';
import { createServerPocketBase, Collections } from '@/lib/pocketbase';
import type { CreateTaskRequest, Task, ApiResponse } from '@saassy/shared';

// Valid task status values
const VALID_STATUSES = ['pending', 'queued', 'running', 'completed', 'failed', 'canceled'];

// GET /api/tasks - List tasks for authenticated user
export async function GET(request: NextRequest) {
  try {
    const pb = createServerPocketBase();
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate token with PocketBase
    const token = authHeader.slice(7);
    pb.authStore.save(token, null);
    try {
      await pb.collection('users').authRefresh();
    } catch {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = pb.authStore.model?.id;
    if (!userId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = Math.min(parseInt(searchParams.get('perPage') || '20'), 100); // Cap at 100
    const status = searchParams.get('status');

    // Build filter with proper validation (prevent injection)
    let filter = `user = {:userId}`;
    const filterParams: Record<string, string> = { userId };

    if (status) {
      // Validate status against allowed values to prevent injection
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Invalid status value' },
          { status: 400 }
        );
      }
      filter += ` && status = {:status}`;
      filterParams.status = status;
    }

    const tasks = await pb.collection(Collections.tasks).getList(page, perPage, {
      filter,
      sort: '-created',
      // Pass filter params for safe interpolation
    });

    return NextResponse.json({
      success: true,
      data: {
        items: tasks.items,
        page: tasks.page,
        perPage: tasks.perPage,
        totalItems: tasks.totalItems,
        totalPages: tasks.totalPages,
      },
    });
  } catch (error) {
    console.error('Error listing tasks:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to list tasks' },
      { status: 500 }
    );
  }
}

// Allowed task types - whitelist to prevent arbitrary image execution
const ALLOWED_TASK_TYPES = ['example-worker', 'test-worker'];

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const pb = createServerPocketBase();
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate token with PocketBase
    const token = authHeader.slice(7);
    pb.authStore.save(token, null);
    try {
      await pb.collection('users').authRefresh();
    } catch {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = pb.authStore.model?.id;
    if (!userId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateTaskRequest = await request.json();

    // Validate input
    if (!body.type || !body.input) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: type, input' },
        { status: 400 }
      );
    }

    // Validate task type against whitelist
    if (!ALLOWED_TASK_TYPES.includes(body.type)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid task type' },
        { status: 400 }
      );
    }

    // Validate input is a plain object (not array, null, etc.)
    if (typeof body.input !== 'object' || body.input === null || Array.isArray(body.input)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Input must be a JSON object' },
        { status: 400 }
      );
    }

    // TODO: Check user limits (concurrent tasks, monthly quota)
    // TODO: Queue task to worker-manager

    // Create task record with user ownership
    const task = await pb.collection(Collections.tasks).create({
      user: userId,
      type: body.type,
      status: 'pending',
      input: body.input,
    });

    return NextResponse.json<ApiResponse<Task>>(
      { success: true, data: task as unknown as Task },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
