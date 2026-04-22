import { auth } from "@/auth"
import { signOut } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

export default async function SettingsPage() {
  const session = await auth()
  const userId = session!.user!.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { accounts: true },
  })

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const PROVIDER_LABELS: Record<string, string> = {
    google: "Google",
    github: "GitHub",
    apple: "Apple",
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.image ?? undefined} />
              <AvatarFallback className="text-lg">{initials ?? "?"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user?.name ?? "Unknown"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected accounts</CardTitle>
          <CardDescription>OAuth providers linked to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {user?.accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
              <span className="text-sm font-medium">{PROVIDER_LABELS[account.provider] ?? account.provider}</span>
              <Badge variant="secondary">Connected</Badge>
            </div>
          ))}
          {user?.accounts.length === 0 && (
            <p className="text-sm text-muted-foreground">No connected accounts</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <Button type="submit" variant="destructive">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
