import { NextRequest, NextResponse } from 'next/server';
import { createServerPocketBase, Collections } from '@/lib/pocketbase';
import type { CreateTaskRequest, Task, ApiResponse } from '@saassy/shared';

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

    // Get query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('perPage') || '20');
    const status = searchParams.get('status');

    // Build filter
    let filter = '';
    if (status) {
      filter = `status = "${status}"`;
    }

    const tasks = await pb.collection(Collections.tasks).getList(page, perPage, {
      filter,
      sort: '-created',
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

    const body: CreateTaskRequest = await request.json();

    // Validate input
    if (!body.type || !body.input) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: type, input' },
        { status: 400 }
      );
    }

    // TODO: Check user limits (concurrent tasks, monthly quota)
    // TODO: Queue task to worker-manager

    // Create task record
    const task = await pb.collection(Collections.tasks).create({
      // user: userId, // from auth
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
