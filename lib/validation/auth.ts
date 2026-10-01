import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const resetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const resetConfirmSchema = z.object({
  token: z.string().min(1),
  // Same floor as signup: a reset must not be a way to set a weaker password
  // than the signup form would have accepted.
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type ResetConfirmInput = z.infer<typeof resetConfirmSchema>;
