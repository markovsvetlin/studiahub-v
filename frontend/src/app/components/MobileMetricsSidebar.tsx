'use client'
import { forwardRef } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from '@/components/ui/sheet'
import UsageCard from '@/components/usage/UsageCard'
import SubscriptionCard from '@/components/usage/SubscriptionCard'
import { UsageData } from '@/hooks/useUsage'
import { SubscriptionData } from '@/components/usage/SubscriptionCard'

interface MobileMetricsSidebarProps {
  usage: UsageData | null
  usageLoading: boolean
  usageError: string | null
  subscription: SubscriptionData | null
  subscriptionLoading: boolean
  subscriptionError: string | null
  onUpgrade?: () => void
  onCancel?: () => void
  onRenew?: () => void
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  triggerButton?: React.ReactNode
}

// Export trigger button component for use in header
export const MetricsTriggerButton = forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentPropsWithoutRef<typeof Button>
>(({ ...props }, ref) => (
  <Button 
    ref={ref}
    variant="ghost" 
    size="sm" 
    className="lg:hidden text-white hover:bg-slate-700/50 hover:text-white p-2"
    {...props}
  >
    <Menu className="w-5 h-5" />
    <span className="sr-only">Open metrics sidebar</span>
  </Button>
))
MetricsTriggerButton.displayName = "MetricsTriggerButton"

export default function MobileMetricsSidebar({
  usage,
  usageLoading,
  usageError,
  subscription,
  subscriptionLoading,
  subscriptionError,
  onUpgrade,
  onCancel,
  onRenew,
  isOpen = false,
  onOpenChange,
  triggerButton
}: MobileMetricsSidebarProps) {
  return (
    <div className="lg:hidden">
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        {triggerButton && (
          <SheetTrigger asChild>
            {triggerButton}
          </SheetTrigger>
        )}
        
        <SheetContent 
          side="left" 
          className="w-[85vw] sm:w-[400px] bg-slate-800 border-slate-700 overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-white text-lg">
              Metrics & Subscription
            </SheetTitle>
          </SheetHeader>
          
          <div className="flex flex-col gap-6 mt-6 pb-6">
            <UsageCard 
              usage={usage} 
              isLoading={usageLoading} 
              error={usageError} 
            />
            
            <SubscriptionCard 
              subscription={subscription}
              isLoading={subscriptionLoading}
              error={subscriptionError}
              onUpgrade={onUpgrade}
              onCancel={onCancel}
              onRenew={onRenew}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
