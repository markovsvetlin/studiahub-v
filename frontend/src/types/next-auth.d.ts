import 'next-auth'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image: string
    } & DefaultSession['user']
    accessToken: string
    error?: string
  }

  interface User {
    id: string
    email: string
    name: string
    image: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    accessToken: string
    refreshToken?: string
    accessTokenExpires?: number
    error?: string
  }
}
