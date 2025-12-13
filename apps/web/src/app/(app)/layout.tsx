import Link from 'next/link';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b">
            <Link href="/dashboard" className="text-xl font-bold text-primary-600">
              Saassy
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            <NavLink href="/dashboard" icon="📊">
              Dashboard
            </NavLink>
            <NavLink href="/tasks" icon="📋">
              Tasks
            </NavLink>
            <NavLink href="/billing" icon="💳">
              Billing
            </NavLink>
            <NavLink href="/settings" icon="⚙️">
              Settings
            </NavLink>
          </nav>

          {/* User section */}
          <div className="p-4 border-t">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 text-sm font-medium">U</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">User</p>
                <p className="text-xs text-gray-500 truncate">Free Plan</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-lg hover:bg-gray-100 transition"
    >
      <span>{icon}</span>
      <span>{children}</span>
    </Link>
  );
}
