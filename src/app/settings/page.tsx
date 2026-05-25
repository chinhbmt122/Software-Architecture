import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { users } from "@/db/schema/auth"
import { eq } from "drizzle-orm"
import { ProfileForm } from "./_components/profile-form"
import { PasswordForm } from "./_components/password-form"
import { SignOutButton } from "./_components/sign-out-button"
import { Separator } from "@/components/ui/separator"

export const metadata = { title: "Cài đặt tài khoản" }

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
  if (!user) redirect("/sign-in")

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-xl font-bold mb-8">Cài đặt tài khoản</h1>

      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
          Thông tin cá nhân
        </h2>
        <ProfileForm name={user.name} bio={user.bio ?? ""} email={user.email} />
      </section>

      <Separator className="my-8" />

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
          Đổi mật khẩu
        </h2>
        <PasswordForm />
      </section>

      <Separator className="my-8" />

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
          Phiên đăng nhập
        </h2>
        <SignOutButton />
      </section>
    </main>
  )
}
