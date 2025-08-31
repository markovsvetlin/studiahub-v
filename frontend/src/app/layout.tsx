import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from "@/components/ui/sonner";
import StructuredData from "./components/StructuredData";
import Script from 'next/script';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap', // Improve font loading performance
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap', // Improve font loading performance
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "StudiaHub - AI-Powered Learning Platform | Transform Study Materials into Smart Quizzes",
    template: "%s | StudiaHub"
  },
  description: "Transform your study materials into personalized AI quizzes. Upload PDFs, documents, or images and accelerate your learning with intelligent, adaptive quizzes powered by OpenAI.",
  keywords: [
    "AI learning",
    "quiz generator", 
    "study platform",
    "educational technology",
    "PDF quiz maker",
    "AI-powered education",
    "personalized learning",
    "study materials",
    "adaptive quizzes",
    "OpenAI education",
    "learning acceleration",
    "smart study tools"
  ],
  authors: [{ name: "StudiaHub Team" }],
  creator: "StudiaHub",
  publisher: "StudiaHub",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://studiahub.io'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "StudiaHub - AI-Powered Learning Platform | Transform Study Materials into Smart Quizzes",
    description: "Transform your study materials into personalized AI quizzes. Upload PDFs, documents, or images and accelerate your learning with intelligent, adaptive quizzes powered by OpenAI.",
    url: 'https://studiahub.io',
    siteName: 'StudiaHub',
    images: [
      {
        url: '/logo4.png',
        width: 1200,
        height: 630,
        alt: 'StudiaHub - AI-Powered Learning Platform',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "StudiaHub - AI-Powered Learning Platform",
    description: "Transform your study materials into personalized AI quizzes. Accelerate your learning with AI.",
    images: ['/logo4.png'],
    creator: '@studiahub',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
    yahoo: 'your-yahoo-verification-code',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      <html lang="en" className="dark">
        <head>
          {/* DNS Prefetch and Preconnect for performance */}
          <link rel="dns-prefetch" href="//fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="preconnect" href="https://api.clerk.com" crossOrigin="" />
          
          {/* Viewport optimization for mobile */}
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          
          {/* Theme color for mobile browsers */}
          <meta name="theme-color" content="#0f172a" />
          <meta name="msapplication-TileColor" content="#0f172a" />
          
          {/* Apple touch icons and manifest */}
          <link rel="apple-touch-icon" sizes="180x180" href="/logo4.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/logo4.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/logo4.png" />
          <link rel="manifest" href="/manifest.json" />
          
          <StructuredData type="organization" />
          <StructuredData type="website" />
          <StructuredData type="software" />
          
          {/* Google Analytics */}
          <Script
            src="https://www.googletagmanager.com/gtag/js?id=G-DDQXZ2P2L6"
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-DDQXZ2P2L6');
            `}
          </Script>

          {/* Meta Pixel Code */}
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '600122232901963');
              fbq('track', 'PageView');
            `}
          </Script>
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {/* Skip link for accessibility and SEO */}
          <a 
            href="#main-content" 
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:bg-indigo-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:no-underline"
          >
            Skip to main content
          </a>
          {children}
          <Toaster position="top-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}
