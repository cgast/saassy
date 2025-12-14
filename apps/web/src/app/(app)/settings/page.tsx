'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('sk_********************************');
  const [showKey, setShowKey] = useState(false);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

      {/* Profile */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
        <form className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
          >
            Save Changes
          </button>
        </form>
      </div>

      {/* API Key */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">API Key</h2>
        <p className="text-sm text-gray-500 mb-4">
          Use this key to authenticate API requests. Keep it secret!
        </p>
        <div className="flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            readOnly
            value={apiKey}
            className="flex-1 border rounded-lg px-3 py-2 font-mono text-sm bg-gray-50"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(apiKey)}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Copy
          </button>
        </div>
        <button className="mt-4 text-sm text-red-600 hover:text-red-700">
          Regenerate API Key
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h2>
        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium text-gray-900">Delete Account</p>
            <p className="text-sm text-gray-500">
              Permanently delete your account and all data
            </p>
          </div>
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
