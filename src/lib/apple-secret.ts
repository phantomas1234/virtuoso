import { SignJWT, importPKCS8 } from "jose"

export async function generateAppleSecret(): Promise<string> {
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!privateKey || !process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID || !process.env.APPLE_ID) {
    throw new Error("Missing Apple OAuth environment variables")
  }

  const key = await importPKCS8(privateKey, "ES256")

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID })
    .setIssuer(process.env.APPLE_TEAM_ID)
    .setIssuedAt()
    .setExpirationTime("6m") // max 6 months, but rotate often
    .setAudience("https://appleid.apple.com")
    .setSubject(process.env.APPLE_ID)
    .sign(key)
}
