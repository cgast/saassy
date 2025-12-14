'use client';

import { useState } from 'react';

export default function TasksPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
        >
          + New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select className="border rounded-lg px-3 py-2 text-sm">
          <option>All Status</option>
          <option>Pending</option>
          <option>Running</option>
          <option>Completed</option>
          <option>Failed</option>
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm">
          <option>All Types</option>
          <option>example-worker</option>
        </select>
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Task ID
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Duration
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Created
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                No tasks found. Create your first task to get started.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTaskModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

function CreateTaskModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg mx-4">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Create New Task</h2>
        </div>
        <form className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Type
            </label>
            <select className="w-full border rounded-lg px-3 py-2">
              <option value="example-worker">Example Worker</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Input (JSON)
            </label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
              rows={6}
              defaultValue={JSON.stringify({ message: 'Hello, World!' }, null, 2)}
            />
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
