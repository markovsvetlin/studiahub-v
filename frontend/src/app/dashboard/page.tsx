'use client'
import UploadDropzone from '../components/UploadDropzone'
import FilesList from '../components/FilesList'
import UsageCard from '@/components/usage/UsageCard'
import SubscriptionCard from '@/components/usage/SubscriptionCard'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { UsageProvider } from '@/contexts/UsageContext'
import { useFiles } from '@/hooks/useFiles'
import { useUsage } from '@/hooks/useUsage'
import { useSubscription } from '@/hooks/useSubscription'
import { useUser } from '@clerk/nextjs'

export default function Dashboard() {
  return (
    <>
      <Header />
      <main className="min-h-screen p-8 space-y-10">
        <section className="space-y-8">
          <MainContent />
        </section>
      </main>
      <Footer />
    </>
  )
}

function MainContent() {
  const { user, isLoaded, isSignedIn } = useUser()
  
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
    // Force redirect to home page
    window.location.href = '/'
    return (
      <div className="max-w-4xl mx-auto p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-center">
        <p className="mb-4">Redirecting to sign in...</p>
      </div>
    )
  }

  return (
    <UsageProvider refreshUsage={refreshUsage}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left side - Usage & Subscription Cards */}
          <div className="lg:w-80 w-full flex-shrink-0 space-y-6">
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
          
          {/* Center - Main Content */}
          <div className="flex-1 flex flex-col items-center space-y-8 max-w-4xl mx-auto">
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

