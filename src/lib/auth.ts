import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { dash } from "@better-auth/infra"
import { db } from "./db"
import { accounts, sessions, users, verifications } from "@/db/schema"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 30,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      const { sendEmail } = await import("./email")
      await sendEmail({
        to: user.email,
        subject: "Đặt lại mật khẩu — NovelHub",
        html: `
          <p>Chào ${user.name ?? user.email},</p>
          <p>Bạn đã yêu cầu đặt lại mật khẩu. Nhấn nút bên dưới để tiếp tục:</p>
          <p><a href="${url}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;border-radius:6px;text-decoration:none;">Đặt lại mật khẩu</a></p>
          <p>Liên kết hết hạn sau 1 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
        `,
      })
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [dash()],
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "READER",
      },
      status: {
        type: "string",
        defaultValue: "ACTIVE",
      },
      coinBalance: {
        type: "number",
        defaultValue: 0,
      },
      bio: {
        type: "string",
        required: false,
      },
    },
  },
})
