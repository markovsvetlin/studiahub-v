import Header from '@/components/Header'
import Footer from '@/components/Footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms and Conditions - Service Agreement',
  description: 'Read our terms of service and user agreement for StudiaHub. Understand your rights and responsibilities when using our AI-powered learning platform.',
  openGraph: {
    title: 'Terms and Conditions - Service Agreement | StudiaHub',
    description: 'Read our terms of service and user agreement for StudiaHub AI learning platform.',
    url: 'https://studiahub.io/terms-and-conditions',
  },
  twitter: {
    title: 'Terms and Conditions - Service Agreement | StudiaHub',
    description: 'Read our terms of service and user agreement for StudiaHub AI learning platform.',
  },
  alternates: {
    canonical: '/terms-and-conditions',
  },
}

export default function TermsAndConditions() {
  return (
    <>
      <Header />
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-white">Terms and Conditions</h1>
            <p className="text-neutral-400">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="prose prose-invert max-w-none space-y-6">
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h2 className="text-2xl font-semibold text-white mb-4">Acceptance of Terms</h2>
              <p className="text-neutral-300">
                By accessing and using StudiaHub, you accept and agree to be bound by the terms and provision of this agreement. 
                If you do not agree to abide by the above, please do not use this service.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h2 className="text-2xl font-semibold text-white mb-4">Use License</h2>
              <p className="text-neutral-300 mb-4">
                Permission is granted to temporarily use StudiaHub for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="space-y-2 text-neutral-300">
                <li>• Modify or copy the materials</li>
                <li>• Use the materials for any commercial purpose or for any public display</li>
                <li>• Attempt to reverse engineer any software contained on the website</li>
                <li>• Remove any copyright or other proprietary notations</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h2 className="text-2xl font-semibold text-white mb-4">User Content</h2>
              <p className="text-neutral-300">
                You retain ownership of any content you upload to StudiaHub. However, by uploading content, you grant us permission to process, analyze, and generate quizzes from your materials for the purpose of providing our services.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h2 className="text-2xl font-semibold text-white mb-4">Subscription Terms</h2>
              <p className="text-neutral-300 mb-4">
                StudiaHub offers both free and paid subscription plans:
              </p>
              <ul className="space-y-2 text-neutral-300">
                <li>• Free plans have usage limitations</li>
                <li>• Paid subscriptions are billed monthly</li>
                <li>• You can cancel your subscription at any time</li>
                <li>• Refunds are handled on a case-by-case basis</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h2 className="text-2xl font-semibold text-white mb-4">Disclaimer</h2>
              <p className="text-neutral-300">
                The materials on StudiaHub are provided on an &apos;as is&apos; basis. StudiaHub makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h2 className="text-2xl font-semibold text-white mb-4">Contact Information</h2>
              <p className="text-neutral-300">
                If you have any questions about these Terms and Conditions, please contact us at:{' '}
                <a href="mailto:hi@studiahub.io" className="text-indigo-400 hover:text-indigo-300">
                  hi@studiahub.io
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
