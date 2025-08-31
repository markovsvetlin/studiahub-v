'use client'
import { useUser, useClerk, useSignIn } from '@clerk/nextjs'
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

export default function Header() {
  const { isSignedIn, user } = useUser()
  const { signOut } = useClerk()
  const { signIn } = useSignIn()

  const handleGoogleSignIn = async () => {
    if (!signIn) return
    
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/dashboard',
        redirectUrlComplete: '/dashboard',
      })
    } catch (error) {
      console.error('Error signing in with Google:', error)
    }
  }

  return (
    <header className="border-b border-slate-600/50 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
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
                    {user.firstName || user.emailAddresses[0]?.emailAddress}
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
                        {user.firstName?.[0] || user.emailAddresses[0]?.emailAddress[0]?.toUpperCase()}
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
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-neutral-400 truncate">
                        {user.emailAddresses[0]?.emailAddress}
                      </p>
                    </div>
                    
                    
                  
                    
                    <DropdownMenuItem 
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer"
                      onClick={() => signOut({ redirectUrl: '/' })}
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
                  onClick={handleGoogleSignIn}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Sign in with Google
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
