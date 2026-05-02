import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0c] text-white">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-4">404 - System Offline</h2>
        <p className="text-slate-400 mb-8">Could not find requested resource</p>
        <Link href="/" className="px-6 py-2 bg-sky-900/50 hover:bg-sky-800/80 rounded-md transition-colors border border-sky-700">
          Return Protocol
        </Link>
      </div>
    </div>
  )
}
