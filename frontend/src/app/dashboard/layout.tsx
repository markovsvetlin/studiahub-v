import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard - Your Learning Hub',
  description: 'Manage your study materials, generate AI quizzes, and track your learning progress. Upload PDFs, documents, or images to create personalized learning experiences.',
  openGraph: {
    title: 'Dashboard - Your Learning Hub | StudiaHub',
    description: 'Manage your study materials, generate AI quizzes, and track your learning progress.',
    url: 'https://studiahub.io/dashboard',
  },
  twitter: {
    title: 'Dashboard - Your Learning Hub | StudiaHub',
    description: 'Manage your study materials, generate AI quizzes, and track your learning progress.',
  },
  alternates: {
    canonical: '/dashboard',
  },
  robots: {
    index: false, // Dashboard should not be indexed as it requires authentication
    follow: false,
  },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
