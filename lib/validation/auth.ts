import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
