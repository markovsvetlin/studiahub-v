'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Crown, 
  Calendar,
  Check,
  Zap,
  FileText,
  Brain,
  MessageCircle,
  ExternalLink
} from 'lucide-react'

export interface SubscriptionData {
  plan: 'free' | 'pro'
  status?: 'active' | 'cancelled' | 'past_due'
  nextBillingDate?: string
  cancelAtPeriodEnd?: boolean
}

interface SubscriptionCardProps {
  subscription: SubscriptionData | null
  isLoading: boolean
  error: string | null
  onUpgrade?: () => void
  onCancel?: () => void
  onRenew?: () => void
}

const ProBenefits = [
  {
    icon: <FileText className="w-4 h-4 text-indigo-400" />,
    text: "1M words storage",
  },
  {
    icon: <Brain className="w-4 h-4 text-indigo-400" />,
    text: "500 quiz questions",
  },
  {
    icon: <MessageCircle className="w-4 h-4 text-indigo-400" />,
    text: "1M chat tokens",
  }
]

export default function SubscriptionCard({ 
  subscription, 
  isLoading, 
  error, 
  onUpgrade,
  onCancel,
  onRenew 
}: SubscriptionCardProps) {
  // Early error return
  if (error) {
    return (
      <Card className="border-slate-600/50 bg-slate-700/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-400">
            <Crown className="w-5 h-5" />
            <span className="text-sm">Failed to load subscription</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (isLoading && !subscription) {
    return (
      <Card className="border-slate-600/50 bg-slate-700/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-neutral-700 animate-pulse" />
            <div className="w-24 h-5 rounded bg-neutral-700 animate-pulse" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="w-full h-4 rounded bg-neutral-700 animate-pulse" />
            <div className="w-3/4 h-4 rounded bg-neutral-700 animate-pulse" />
          </div>
          <div className="w-full h-10 rounded bg-neutral-700 animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  // Default to free plan if no subscription data
  const plan = subscription?.plan || 'free'
  const isPro = plan === 'pro'

  return (
    <Card className="border-slate-600/50 bg-slate-700/30 hover:bg-slate-600/40 transition-all duration-300 relative">
      {/* Loading overlay that preserves layout */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-700/70 backdrop-blur-sm rounded-lg flex items-center justify-center z-10 transition-all duration-200">
          <div className="flex items-center gap-2 text-white">
            <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
            <span className="text-sm font-medium">Updating...</span>
          </div>
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg ${
              isPro 
                ? 'bg-amber-500/20 border border-amber-500/30' 
                : 'bg-slate-500/20 border border-slate-500/30'
            } flex items-center justify-center`}>
              <Crown className={`w-4 h-4 ${
                isPro ? 'text-amber-400' : 'text-slate-400'
              }`} />
            </div>
            Subscription
          </CardTitle>
          <Badge 
            variant="outline" 
            className={`${
              isPro 
                ? 'text-amber-400 border-amber-400/30 bg-amber-400/10' 
                : 'text-slate-400 border-slate-400/30 bg-slate-400/10'
            }`}
          >
            {isPro ? 'PRO' : 'FREE'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isPro ? (
          // Pro Plan Content
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-400">
                <Zap className="w-4 h-4" />
                <span className="font-semibold">Pro Plan Active</span>
              </div>
              <p className="text-sm text-neutral-300">
                Enjoy unlimited access to all premium features
              </p>
            </div>

            {subscription?.nextBillingDate && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-600/30 border border-slate-600/50">
                <div className="flex items-center gap-2 text-sm text-neutral-300">
                  <Calendar className="w-4 h-4" />
                  <span>Next billing</span>
                </div>
                <span className="text-sm font-medium text-white">
                  {subscription.nextBillingDate}
                </span>
              </div>
            )}

            {subscription?.cancelAtPeriodEnd ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm text-amber-300 font-medium">
                    ⚠️ Subscription Cancelled
                  </p>
                  <p className="text-xs text-amber-300/80 mt-1">
                    You&apos;ll keep Pro access until {subscription.nextBillingDate}
                  </p>
                </div>
                <Button 
                  onClick={onRenew}
                  className="w-full bg-green-600 hover:bg-green-700 text-white border-0"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Renew Subscription
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onCancel}
                className="w-full text-neutral-300 border-slate-500/50 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-300 transition-colors"
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        ) : (
          // Free Plan Content
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="font-semibold">Free Plan</span>
              </div>
              <p className="text-sm text-neutral-400">
                Upgrade to Pro for unlimited access
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-white">Pro Benefits:</div>
              {ProBenefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3 p-2 rounded-lg bg-slate-600/20">
                  <div className="flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      {benefit.icon}
                      <span className="text-neutral-200">{benefit.text}</span>
                    </div>
                
                  </div>
                </div>
              ))}
            </div>

            <Button 
              onClick={onUpgrade}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
