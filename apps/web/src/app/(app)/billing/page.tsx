import Link from 'next/link';

export default function BillingPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Billing</h1>

      {/* Current Plan */}
      <div className="bg-white rounded-xl border p-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
            <p className="text-3xl font-bold text-gray-900 mt-2">Free</p>
            <p className="text-gray-500 mt-1">10 tasks/month included</p>
          </div>
          <Link
            href="/billing/upgrade"
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
          >
            Upgrade Plan
          </Link>
        </div>
      </div>

      {/* Usage This Period */}
      <div className="bg-white rounded-xl border p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Current Period Usage
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500">Tasks Used</p>
            <p className="text-2xl font-bold text-gray-900">0 / 10</p>
            <div className="mt-2 h-2 bg-gray-200 rounded-full">
              <div className="h-2 bg-primary-600 rounded-full w-0" />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500">CPU Time</p>
            <p className="text-2xl font-bold text-gray-900">0s</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Estimated Cost</p>
            <p className="text-2xl font-bold text-gray-900">$0.00</p>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Available Plans
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PlanCard
            name="Free"
            price="$0"
            features={['10 tasks/month', '1 concurrent task', '60s max duration']}
            current
          />
          <PlanCard
            name="Starter"
            price="$19"
            features={[
              '100 tasks/month',
              '3 concurrent tasks',
              '5 min max duration',
              '$0.10/task overage',
            ]}
            highlighted
          />
          <PlanCard
            name="Pro"
            price="$49"
            features={[
              '1,000 tasks/month',
              '10 concurrent tasks',
              '1 hour max duration',
              '$0.05/task overage',
              'Priority support',
            ]}
          />
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-xl border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
        </div>
        <div className="p-6 text-center text-gray-500">
          No invoices yet
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  features,
  current,
  highlighted,
}: {
  name: string;
  price: string;
  features: string[];
  current?: boolean;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        highlighted ? 'border-primary-500 ring-2 ring-primary-100' : ''
      }`}
    >
      <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
      <p className="text-3xl font-bold text-gray-900 mt-2">
        {price}
        <span className="text-sm font-normal text-gray-500">/month</span>
      </p>
      <ul className="mt-4 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-green-500">✓</span>
            {feature}
          </li>
        ))}
      </ul>
      <button
        className={`w-full mt-6 py-2 rounded-lg transition ${
          current
            ? 'bg-gray-100 text-gray-500 cursor-default'
            : highlighted
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'border border-gray-300 text-gray-700 hover:border-gray-400'
        }`}
        disabled={current}
      >
        {current ? 'Current Plan' : 'Upgrade'}
      </button>
    </div>
  );
}
