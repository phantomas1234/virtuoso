import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Google from "next-auth/providers/google"
import Apple from "next-auth/providers/apple"
import GitHub from "next-auth/providers/github"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    // Apple requires a pre-generated JWT as clientSecret.
    // Generate it with: node -e "require('./src/lib/apple-secret').generateAppleSecret().then(console.log)"
    // Then store the result in APPLE_CLIENT_SECRET env var (valid for up to 6 months).
    Apple({
      clientId: process.env.APPLE_ID ?? "",
      clientSecret: process.env.APPLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "database",
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
