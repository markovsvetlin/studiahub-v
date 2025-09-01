'use client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSignIn, useSignUp, useUser } from '@clerk/nextjs'
import { 
  Brain, 
  Zap, 
  Target, 
  Sparkles,
  Play,
  Clock
} from 'lucide-react'
import { useState } from 'react'

export default function Home() {
  const { signIn } = useSignIn()
  const { signUp } = useSignUp()
  const { isSignedIn, user } = useUser()
  const [isLoading, setIsLoading] = useState(false)
  // Let environment variables handle the redirect - no useEffect needed



  const handleGoogleAuth = async () => {
    if (isLoading) return
    
    setIsLoading(true)
    console.log('🔄 Starting Google OAuth flow...')
    
    try {
      // For OAuth flows, Clerk can auto-determine sign-in vs sign-up
      // Use signUp.authenticateWithRedirect as it handles both cases better
      if (signUp) {
        console.log('🔑 Using signUp OAuth flow (handles both new and existing users)...')
        await signUp.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: '/dashboard',
          redirectUrlComplete: '/dashboard',
        })
      } else if (signIn) {
        // Fallback to signIn if signUp not available
        console.log('🔄 Fallback to signIn OAuth flow...')
        await signIn.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: '/dashboard',
          redirectUrlComplete: '/dashboard',
        })
      } else {
        throw new Error('Neither signUp nor signIn available')
      }
    } catch (error: any) {
      console.error('❌ OAuth authentication failed:', error)
      alert('Authentication failed. Please try again.')
    } finally {
      // Note: This might not execute due to redirect, but good practice
      setIsLoading(false)
    }
  }
  return (
    <div className="min-h-screen relative">
      {/* Beautiful Unified Background Gradient */}
      <div 
        className="absolute inset-0 w-full h-full"
        style={{
          background: `
            linear-gradient(135deg, 
              rgb(15, 23, 42) 0%,
              rgb(30, 41, 59) 25%,
              rgb(51, 65, 85) 50%,
              rgb(30, 41, 59) 75%,
              rgb(15, 23, 42) 100%
            )
          `
        }}
      />
      
      {/* Subtle overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/10 via-transparent to-purple-950/10" />
      
      <main className="relative z-10" id="main-content">
        {/* Hero & Welcome Section - Side by Side */}
        <section className="py-20 px-8" aria-label="Hero section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left Side - Hero Content */}
              <div className="text-center lg:text-left space-y-8">
                <Badge variant="outline" className="mx-auto lg:mx-0 w-fit border-indigo-400/30 bg-indigo-400/10 text-indigo-300">
                  <Sparkles className="w-3 h-3 mr-2" />
                  AI-Powered Learning Revolution
                </Badge>
                
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white">
                  Learn <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">10x Faster</span>
                  <br />with AI Quizzes
                </h1>
                
                <p className="text-xl text-slate-300 leading-relaxed">
                  Transform your study materials into personalized, intelligent quizzes. Upload PDFs, documents, or images and let AI create the perfect learning experience tailored just for you.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center pt-4">
                  {/* <Button 
                    size="lg" 
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-xl shadow-indigo-600/25"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Try Demo
                  </Button>
                   */}

                </div>
              </div>

              {/* Right Side - Welcome Back */}
              <aside className="flex justify-center lg:justify-end" aria-label="User authentication">
                <div className="w-full max-w-sm">
                  <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-600/50 rounded-2xl p-8 space-y-6 shadow-2xl shadow-black/20">
                    <div className="text-center space-y-2">
                      <h2 className="text-2xl font-semibold text-white">Welcome Back</h2>
                      <p className="text-slate-300">Continue your learning journey</p>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="lg"
                      onClick={isSignedIn ? () => window.location.href = '/dashboard' : handleGoogleAuth}
                      className="w-full border-slate-500/50 hover:bg-slate-700/50 py-6 text-lg rounded-xl bg-slate-700/30 text-white"
                    >
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
{isSignedIn ? `Go to Dashboard (${user?.firstName || 'User'})` : 'Sign Up with Google'}
                    </Button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-8" aria-label="Product features">
          <div className="max-w-6xl mx-auto space-y-16">
            <header className="text-center space-y-4">
              <h2 className="text-4xl font-bold text-white">Why StudiaHub Accelerates Learning</h2>
              <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                Our AI doesn&apos;t just process your content—it understands it and creates the most effective learning experience possible.
              </p>
            </header>
            
            <div className="grid md:grid-cols-3 gap-8" role="list" aria-label="Key features">
              <article className="border-slate-600/50 bg-slate-700/30 hover:bg-slate-600/40 transition-all duration-300 backdrop-blur-sm rounded-lg" role="listitem">
                <div className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-4">
                    <Brain className="w-6 h-6 text-indigo-400" />
                  </div>
                  <h3 className="text-white text-xl font-semibold mb-4">AI Quiz Generation</h3>
                  <div className="space-y-2">
                    <p className="text-slate-300">
                      Advanced AI analyzes your content and generates personalized quizzes that target your knowledge gaps.
                    </p>
                    <div className="pt-2">
                      <Badge variant="secondary" className="text-xs bg-indigo-500/20 text-indigo-300">Powered by OpenAI</Badge>
                    </div>
                  </div>
                </div>
              </article>

              <article className="border-slate-600/50 bg-slate-700/30 hover:bg-slate-600/40 transition-all duration-300 backdrop-blur-sm rounded-lg" role="listitem">
                <div className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-4">
                    <Target className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-white text-xl font-semibold mb-4">Smart Focus Areas</h3>
                  <div className="space-y-2">
                    <p className="text-slate-300">
                      Set specific topics or subjects for targeted learning. The AI adapts quiz difficulty and focus accordingly.
                    </p>
                    <div className="pt-2">
                      <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-300">Adaptive Learning</Badge>
                    </div>
                  </div>
                </div>
              </article>

              <article className="border-slate-600/50 bg-slate-700/30 hover:bg-slate-600/40 transition-all duration-300 backdrop-blur-sm rounded-lg" role="listitem">
                <div className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-white text-xl font-semibold mb-4">10x Learning Speed</h3>
                  <div className="space-y-2">
                    <p className="text-slate-300">
                      Scientifically optimized quiz formats designed for maximum retention and accelerated learning.
                    </p>
                    <div className="pt-2">
                      <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-300">Evidence-Based</Badge>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

       

        {/* CTA Section */}
        <section className="py-20 px-8" aria-label="Call to action">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-4xl font-bold text-white">Ready to Transform Your Learning?</h2>
            <p className="text-xl text-slate-300">
              Join thousands of learners who are already studying smarter, not harder.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-xl shadow-indigo-600/25"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Learning Now
              </Button>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Clock className="w-4 h-4" />
                No credit card required
              </div>
            </div>
                    </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-8 border-t border-slate-700/30" role="contentinfo" aria-label="Site footer">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 items-start">
              {/* Left - Brand & Contact */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white">StudiaHub</span>
                </div>
                <p className="text-slate-400 text-sm">
                  AI-powered learning acceleration platform
                </p>
                <div className="space-y-2">
                  <a 
                    href="mailto:hello@studiahub.com" 
                    className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                    </svg>
                    hello@studiahub.com
                  </a>
                </div>
              </div>

              {/* Middle - Social Links */}
              <div className="space-y-4">
                <h4 className="text-white font-semibold">Follow Us</h4>
                <div className="flex gap-4">
                  <a 
                    href="https://instagram.com/studiahub" 
                    className="text-slate-400 hover:text-white transition-colors"
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                  <a 
                    href="https://tiktok.com/@studiahub" 
                    className="text-slate-400 hover:text-white transition-colors"
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-.88-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                    </svg>
                  </a>
                </div>
              </div>

              {/* Right - Legal Links */}
              <div className="space-y-4">
                <h4 className="text-white font-semibold">Legal</h4>
                <div className="space-y-2">
                  <a 
                    href="/privacy" 
                    className="text-slate-400 hover:text-white transition-colors text-sm block"
                  >
                    Privacy Policy
                  </a>
                  <a 
                    href="/terms" 
                    className="text-slate-400 hover:text-white transition-colors text-sm block"
                  >
                    Terms of Service
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-slate-700/30 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-slate-500 text-sm">
                © 2024 StudiaHub. All rights reserved.
              </p>
              <p className="text-slate-500 text-sm">
                Made with ❤️ for learners everywhere
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
