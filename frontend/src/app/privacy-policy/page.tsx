import Header from '@/components/Header'
import Footer from '@/components/Footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy - Your Data Protection',
  description: 'Learn how StudiaHub protects your privacy and handles your data. We are committed to keeping your study materials and personal information secure.',
  openGraph: {
    title: 'Privacy Policy - Your Data Protection | StudiaHub',
    description: 'Learn how StudiaHub protects your privacy and handles your data securely.',
    url: 'https://studiahub.io/privacy-policy',
  },
  twitter: {
    title: 'Privacy Policy - Your Data Protection | StudiaHub',
    description: 'Learn how StudiaHub protects your privacy and handles your data securely.',
  },
  alternates: {
    canonical: '/privacy-policy',
  },
}

export default function PrivacyPolicy() {
  return (
    <>
      <Header />
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-white">Privacy Policy</h1>
            <p className="text-neutral-400">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="prose prose-invert max-w-none space-y-6">
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h2 className="text-2xl font-semibold text-white mb-4">Information We Collect</h2>
              <p className="text-neutral-300 mb-4">
                At StudiaHub, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our AI-powered learning platform.
              </p>
              <ul className="space-y-2 text-neutral-300">
                <li>• Account information (name, email address)</li>
                <li>• Documents and files you upload for processing</li>
                <li>• Usage data and analytics</li>
                <li>• Payment information (processed securely through Stripe)</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h2 className="text-2xl font-semibold text-white mb-4">How We Use Your Information</h2>
              <ul className="space-y-2 text-neutral-300">
                <li>• To provide and improve our AI-powered learning services</li>
                <li>• To process your documents and generate quizzes</li>
                <li>• To communicate with you about your account and services</li>
                <li>• To ensure the security and integrity of our platform</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h2 className="text-2xl font-semibold text-white mb-4">Data Security</h2>
              <p className="text-neutral-300">
                We implement industry-standard security measures to protect your personal information and uploaded documents. All data is encrypted in transit and at rest.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h2 className="text-2xl font-semibold text-white mb-4">Contact Us</h2>
              <p className="text-neutral-300">
                If you have any questions about this Privacy Policy, please contact us at:{' '}
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
