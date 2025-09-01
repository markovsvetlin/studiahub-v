'use client'
import { useState } from 'react'
import UploadDropzone from '../components/UploadDropzone'
import FilesList from '../components/FilesList'
import MobileMetricsSidebar, { MetricsTriggerButton } from '../components/MobileMetricsSidebar'
import UsageCard from '@/components/usage/UsageCard'
import SubscriptionCard from '@/components/usage/SubscriptionCard'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { UsageProvider } from '@/contexts/UsageContext'
import { useFiles } from '@/hooks/useFiles'
import { useUsage } from '@/hooks/useUsage'
import { useSubscription } from '@/hooks/useSubscription'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  return (
    <>
      <DashboardContent />
      <Footer />
    </>
  )
}

function DashboardContent() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  return (
    <>
      <Header 
        mobileMetricsButton={
          <MetricsTriggerButton 
            onClick={() => setIsMobileSidebarOpen(true)} 
          />
        }
      />
      <main className="min-h-screen lg:p-8 p-4 pt-6 space-y-10" id="main-content">
        <section className="space-y-8">
          <MainContent 
            isMobileSidebarOpen={isMobileSidebarOpen} 
            setIsMobileSidebarOpen={setIsMobileSidebarOpen} 
          />
        </section>
      </main>
    </>
  )
}

interface MainContentProps {
  isMobileSidebarOpen: boolean
  setIsMobileSidebarOpen: (open: boolean) => void
}

function MainContent({ isMobileSidebarOpen, setIsMobileSidebarOpen }: MainContentProps) {
  const { user, isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  
  // Debug: Let's see what's happening with auth state
  console.log('🔍 Auth State Check:', { isLoaded, isSignedIn, hasUser: !!user, userId: user?.id })

  const { usage, isLoading: usageLoading, error: usageError, refreshUsage } = useUsage(user?.id)
  const { files, isLoading, error, toggleFileEnabled, deleteFile, refreshFiles } = useFiles(user?.id, refreshUsage)
  const { 
    subscription, 
    isLoading: subscriptionLoading, 
    error: subscriptionError, 
    handleUpgrade, 
    handleCancel,
    handleRenew 
  } = useSubscription(user?.id)

  const handleUploadComplete = () => {
    refreshFiles()
    refreshUsage() // Refresh usage after file upload
  }

  const handleCancelSubscription = async () => {
    try {
      await handleCancel()

    } catch (error) {
      console.error('Failed to cancel subscription:', error)
    }
  }

  const handleRenewSubscription = async () => {
    try {
      await handleRenew()

    } catch (error) {
      console.error('Failed to renew subscription:', error)
    }
  }

  // Show loading spinner while authentication state is being determined
  if (!isLoaded) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // Show sign-in message only after we've confirmed user is not authenticated
  if (isLoaded && (!user || !isSignedIn)) {
    // Use Next.js router for better redirect handling
    // router.push('/')
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm">Redirecting to sign in...</p>
        </div>
      </div>
    )
  }

  return (
    <UsageProvider refreshUsage={refreshUsage}>
      {/* Mobile Sidebar */}
      <MobileMetricsSidebar
        usage={usage}
        usageLoading={usageLoading}
        usageError={usageError}
        subscription={subscription}
        subscriptionLoading={subscriptionLoading}
        subscriptionError={subscriptionError}
        onUpgrade={handleUpgrade}
        onCancel={handleCancelSubscription}
        onRenew={handleRenewSubscription}
        isOpen={isMobileSidebarOpen}
        onOpenChange={setIsMobileSidebarOpen}
      />

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Desktop Left Sidebar - Hidden on Mobile */}
          <div className="hidden lg:block lg:w-80 flex-shrink-0 space-y-6">
            <UsageCard usage={usage} isLoading={usageLoading} error={usageError} />
            <SubscriptionCard 
              subscription={subscription}
              isLoading={subscriptionLoading}
              error={subscriptionError}
              onUpgrade={handleUpgrade}
              onCancel={handleCancelSubscription}
              onRenew={handleRenewSubscription}
            />
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col items-center space-y-6 lg:space-y-8 w-full lg:max-w-4xl mx-auto lg:mt-0 mt-4">
            {error ? (
              <div className="w-full p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-center">
                Error loading files: {error}
              </div>
            ) : (
              <>
                <UploadDropzone onUploadComplete={handleUploadComplete} />
                <FilesList
                  files={files}
                  onToggleEnabled={toggleFileEnabled}
                  onDeleteFile={deleteFile}
                  isLoading={isLoading}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </UsageProvider>
  )
}

