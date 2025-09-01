'use client'
import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { 
  LogOut,
  ChevronDown
} from 'lucide-react'

interface HeaderProps {
  mobileMetricsButton?: React.ReactNode
}

export default function Header({ mobileMetricsButton }: HeaderProps) {
  const { data: session } = useSession()
  const user = session?.user

  const handleGoogleAuth = async () => {
    // Perfect solution - one button handles everything
    signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <header className="border-b border-slate-600/50 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-50" role="banner">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <nav className="flex items-center justify-between" role="navigation" aria-label="Main navigation">
          {/* Left Section - Mobile Metrics Button + Logo */}
          <div className="flex items-center space-x-3">
            {/* Mobile Metrics Button */}
            {mobileMetricsButton}
            
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <Image
              src="/logo4.png"
              alt="StudiaHub"
              width={40}
              height={40}
              className="rounded-lg"
            />
              <span className="text-xl font-bold text-white hidden sm:block">
                StudiaHub
              </span>
            </Link>
          </div>

          {/* User Section */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                {/* Welcome Message */}
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-sm text-neutral-300">
                    Welcome back,
                  </span>
                  <span className="text-sm font-medium text-white">
                    {user.name?.split(' ')[0] || user.email}
                  </span>
                </div>

                {/* User Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="flex items-center space-x-2 hover:bg-slate-700/50 border-slate-600/50"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-medium">
                        {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                      </div>
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  
                  <DropdownMenuContent 
                    align="end" 
                    className="w-56 bg-slate-800 border-slate-600"
                  >
                    <div className="px-3 py-2 border-b border-slate-600">
                      <p className="text-sm font-medium text-white">
                        {user.name}
                      </p>
                      <p className="text-xs text-neutral-400 truncate">
                        {user.email}
                      </p>
                    </div>
                    
                    
                  
                    
                    <DropdownMenuItem 
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer"
                      onClick={() => signOut({ callbackUrl: '/' })}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Alternative: Use Clerk's UserButton for more features */}
                {/* <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "w-10 h-10",
                    },
                  }}
                /> */}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button 
                  onClick={handleGoogleAuth}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Sign in with Google
                </Button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
