import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <h1 className="text-3xl font-semibold text-gray-900">Multi-Tenant Ecommerce Platform</h1>
      <p className="mt-3 max-w-xl text-gray-600">
        Launch your own online store with its own domain, branding, and the exact features your business needs.
      </p>
      <Link href="/admin" className="mt-8 rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700">
        Admin panel
      </Link>
    </main>
  );
}
