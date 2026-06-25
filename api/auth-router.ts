import { z } from "zod";
import { nanoid } from "nanoid";
import * as cookie from "cookie";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { signSessionToken } from "./kimi/session";
import { hashPassword, verifyPassword } from "./auth/password";
import {
  findUserByEmail,
  createUser,
  countUsers,
} from "./queries/users";
import type { User } from "@db/schema";

// Never send the password hash to the browser.
function toPublicUser(user: User) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

const credentials = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  name: z.string().max(255).optional(),
});

function setSessionCookie(
  reqHeaders: Headers,
  resHeaders: Headers,
  token: string,
) {
  const opts = getSessionCookieOptions(reqHeaders);
  resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: Session.maxAgeMs / 1000,
    }),
  );
}

export const authRouter = createRouter({
  me: authedQuery.query((opts) => toPublicUser(opts.ctx.user)),

  register: publicQuery
    .input(credentials)
    .mutation(async ({ input, ctx }) => {
      const email = input.email.trim().toLowerCase();

      const existing = await findUserByEmail(email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists.",
        });
      }

      // The very first account to register becomes the admin.
      const isFirstUser = (await countUsers()) === 0;

      const user = await createUser({
        unionId: nanoid(),
        email,
        passwordHash: await hashPassword(input.password),
        name: input.name?.trim() || email.split("@")[0],
        role: isFirstUser ? "admin" : "user",
      });

      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create account.",
        });
      }

      const token = await signSessionToken({
        unionId: user.unionId,
        clientId: "password",
      });
      setSessionCookie(ctx.req.headers, ctx.resHeaders, token);

      return toPublicUser(user);
    }),

  login: publicQuery
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.trim().toLowerCase();
      const user = await findUserByEmail(email);

      const ok =
        user && (await verifyPassword(input.password, user.passwordHash));
      if (!user || !ok) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      const token = await signSessionToken({
        unionId: user.unionId,
        clientId: "password",
      });
      setSessionCookie(ctx.req.headers, ctx.resHeaders, token);

      return toPublicUser(user);
    }),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});
