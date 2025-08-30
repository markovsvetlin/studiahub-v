'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  MessageCircle, 
  TrendingUp,
  Calendar,
  AlertTriangle,
  Brain
} from 'lucide-react'
import { UsageData } from '@/hooks/useUsage'

interface UsageCardProps {
  usage: UsageData | null
  isLoading: boolean
  error: string | null
}

interface MetricProps {
  icon: React.ReactNode
  label: string
  current: number
  limit: number
  percentage: number
  unit: string
  showWarning?: boolean
}

function UsageMetric({ icon, label, current, limit, percentage, unit, showWarning }: MetricProps) {
  const isNearLimit = percentage >= 80
  const isAtLimit = percentage >= 100
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-200">
          {icon}
          {label}
        </div>
        {showWarning && isNearLimit && (
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        )}
      </div>
      
      <div className="space-y-1">
        <div className="relative">
          <Progress 
            value={Math.min(percentage, 100)} 
            className={`h-2 ${
              isAtLimit ? 'bg-red-900/20' : 
              isNearLimit ? 'bg-amber-900/20' : 
              'bg-indigo-900/20 border border-indigo-800/30'
            }`}
          />
          {/* Overlay for error states */}
          {(isAtLimit || isNearLimit) && (
            <div 
              className={`absolute top-0 left-0 h-2 rounded-full ${
                isAtLimit ? 'bg-red-500' : 'bg-amber-500'
              } transition-all duration-300 ease-in-out`}
              style={{ 
                width: `${Math.min(percentage, 100)}%` 
              }}
            />
          )}
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className={`font-medium ${
            isAtLimit ? 'text-red-400' : 
            isNearLimit ? 'text-amber-400' : 
            'text-neutral-300'
          }`}>
            {current.toLocaleString()} / {limit.toLocaleString()} {unit}
          </span>
          <span className={`${
            isAtLimit ? 'text-red-400' : 
            isNearLimit ? 'text-amber-400' : 
            'text-neutral-500'
          }`}>
            {percentage}%
          </span>
        </div>
      </div>
    </div>
  )
}

export default function UsageCard({ usage, isLoading, error }: UsageCardProps) {
  if (error) {
    return (
      <Card className="border-slate-600/50 bg-slate-700/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm">Failed to load usage data</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className="border-slate-600/50 bg-slate-700/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-neutral-700 animate-pulse" />
            <div className="w-20 h-5 rounded bg-neutral-700 animate-pulse" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <div className="w-16 h-4 rounded bg-neutral-700 animate-pulse" />
                <div className="w-8 h-4 rounded bg-neutral-700 animate-pulse" />
              </div>
              <div className="w-full h-2 rounded bg-neutral-700 animate-pulse" />
              <div className="flex justify-between">
                <div className="w-24 h-3 rounded bg-neutral-700 animate-pulse" />
                <div className="w-8 h-3 rounded bg-neutral-700 animate-pulse" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!usage) {
    return (
      <Card className="border-slate-600/50 bg-slate-700/30">
        <CardContent className="p-6">
          <div className="text-center text-neutral-400">
            <span className="text-sm">Usage data not available</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasWarnings = usage.percentages.words >= 80 || 
                     usage.percentages.questions >= 80 || 
                     usage.percentages.tokens >= 80

  return (
    <Card className="border-slate-600/50 bg-slate-700/30 hover:bg-slate-600/40 transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
            </div>
            Usage Metrics
          </CardTitle>
          {hasWarnings && (
            <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-400/10">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Warning
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <UsageMetric
          icon={<FileText className="w-4 h-4 text-indigo-400" />}
          label="Words Stored"
          current={usage.current.words}
          limit={usage.limits.words}
          percentage={usage.percentages.words}
          unit="words"
          showWarning={true}
        />
        
        <UsageMetric
          icon={<Brain className="w-4 h-4 text-indigo-400" />}
          label="Quiz Questions"
          current={usage.current.questions}
          limit={usage.limits.questions}
          percentage={usage.percentages.questions}
          unit="questions"
          showWarning={true}
        />
        
        <UsageMetric
          icon={<MessageCircle className="w-4 h-4 text-indigo-400" />}
          label="Chat Tokens"
          current={usage.current.tokens}
          limit={usage.limits.tokens}
          percentage={usage.percentages.tokens}
          unit="tokens"
          showWarning={true}
        />
        
        <div className="pt-2 border-t border-slate-600/30">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Reset</span>
            </div>
            <span className="font-medium text-neutral-300">
              {usage.resetDateFormatted}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}