export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard title="Tasks This Month" value="0" subtitle="of 10 included" />
        <StatCard title="Running Tasks" value="0" subtitle="of 1 max concurrent" />
        <StatCard title="Usage Cost" value="$0.00" subtitle="this billing period" />
        <StatCard title="Success Rate" value="--" subtitle="no tasks yet" />
      </div>

      {/* Recent Tasks */}
      <div className="bg-white rounded-xl border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Tasks</h2>
        </div>
        <div className="p-6">
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-4">📋</p>
            <p>No tasks yet</p>
            <p className="text-sm mt-2">
              Create your first task to get started
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-6">
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}
