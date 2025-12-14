import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm fixed w-full z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-primary-600">Saassy</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/pricing" className="text-gray-600 hover:text-gray-900">
                Pricing
              </Link>
              <Link href="/docs" className="text-gray-600 hover:text-gray-900">
                Docs
              </Link>
              <Link
                href="/login"
                className="text-gray-600 hover:text-gray-900"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Run Any Workload,
            <br />
            <span className="text-primary-600">Pay Per Use</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Submit Docker-based tasks and pay only for what you use.
            Perfect for batch processing, ML inference, data pipelines, and more.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/register"
              className="bg-primary-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-primary-700 transition"
            >
              Start Free
            </Link>
            <Link
              href="/docs"
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg text-lg font-medium hover:border-gray-400 transition"
            >
              View Docs
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Everything You Need
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              title="Docker Native"
              description="Run any Docker container as a task. Bring your own images or use our templates."
              icon="🐳"
            />
            <FeatureCard
              title="Usage-Based Billing"
              description="Pay for CPU time and memory usage. No idle costs, no wasted resources."
              icon="💰"
            />
            <FeatureCard
              title="Auto-Scaling"
              description="Tasks run on-demand. Scale from zero to thousands without configuration."
              icon="📈"
            />
            <FeatureCard
              title="Real-time Logs"
              description="Stream logs from your running tasks. Debug issues as they happen."
              icon="📝"
            />
            <FeatureCard
              title="API First"
              description="Full REST API for automation. Integrate with your existing workflows."
              icon="🔌"
            />
            <FeatureCard
              title="Secure Isolation"
              description="Each task runs in its own isolated container with resource limits."
              icon="🔒"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-primary-100 mb-8 text-lg">
            Start with 10 free tasks per month. No credit card required.
          </p>
          <Link
            href="/register"
            className="bg-white text-primary-600 px-8 py-3 rounded-lg text-lg font-medium hover:bg-gray-100 transition inline-block"
          >
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <span className="text-xl font-bold text-white">Saassy</span>
            <div className="flex gap-6">
              <Link href="/docs" className="hover:text-white transition">
                Docs
              </Link>
              <Link href="/pricing" className="hover:text-white transition">
                Pricing
              </Link>
              <Link href="/privacy" className="hover:text-white transition">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-white transition">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="p-6 rounded-xl border border-gray-200 hover:border-primary-200 hover:shadow-lg transition">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
