import { z } from "zod";

export const accountEmailSchema = z.string().trim().email("Email inválido").max(255).transform(email => email.toLowerCase());
export const accountPasswordSchema = z.string().min(10, "Usá al menos 10 caracteres").max(128, "Usá como máximo 128 caracteres");
export const accountLinkPurposeSchema = z.enum(["invitation", "password_reset"]);
export const accountLinkSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, "El enlace no es válido"),
  purpose: accountLinkPurposeSchema,
});
export const completeAccountLinkSchema = accountLinkSchema.extend({
  password: accountPasswordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden", path: ["confirmPassword"],
});
export type AccountLinkPurpose = z.infer<typeof accountLinkPurposeSchema>;

export type InvitationStatus = {
  status: "none" | "pending" | "accepted" | "expired" | "failed" | "unconfirmed" | "revoked";
  sentAt?: string;
  expiresAt?: string;
};
