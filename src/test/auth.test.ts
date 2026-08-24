import { describe, it, expect, beforeEach } from "vitest";
import {
  authService,
  evaluatePasswordStrength,
  isValidEmail,
  generateToken,
} from "@/lib/authService";

describe("Authentication System Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("Utility & Validation Functions", () => {
    it("validates email formats correctly", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("user.name+tag@sub.domain.co")).toBe(true);
      expect(isValidEmail("invalid-email")).toBe(false);
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail("missing@domain")).toBe(false);
      expect(isValidEmail("@domain.com")).toBe(false);
    });

    it("evaluates password strength and feedback accurately", () => {
      const weak = evaluatePasswordStrength("abc");
      expect(weak.score).toBeLessThanOrEqual(1);
      expect(weak.hasMinLength).toBe(false);
      expect(weak.feedback.length).toBeGreaterThan(0);

      const moderate = evaluatePasswordStrength("Abcdef12");
      expect(moderate.hasMinLength).toBe(true);
      expect(moderate.hasUppercase).toBe(true);
      expect(moderate.hasLowercase).toBe(true);
      expect(moderate.hasNumber).toBe(true);
      expect(moderate.hasSpecialChar).toBe(false);

      const strong = evaluatePasswordStrength("P@ssw0rd123!");
      expect(strong.score).toBeGreaterThanOrEqual(3);
      expect(strong.hasMinLength).toBe(true);
      expect(strong.hasUppercase).toBe(true);
      expect(strong.hasLowercase).toBe(true);
      expect(strong.hasNumber).toBe(true);
      expect(strong.hasSpecialChar).toBe(true);
    });

    it("generates random secure tokens of specified length", () => {
      const token1 = generateToken(32);
      const token2 = generateToken(32);
      expect(token1).toHaveLength(32);
      expect(token2).toHaveLength(32);
      expect(token1).not.toEqual(token2);
    });
  });

  describe("Sign Up Flow & Verification Email Dispatch", () => {
    it("rejects signup when required fields are missing", async () => {
      await expect(
        authService.signUp({
          fullName: "",
          email: "john@example.com",
          password: "Password123!",
        })
      ).rejects.toThrow("Please enter your full name.");

      await expect(
        authService.signUp({
          fullName: "John Doe",
          email: "",
          password: "Password123!",
        })
      ).rejects.toThrow("Please enter your email address.");
    });

    it("rejects signup with invalid email format", async () => {
      await expect(
        authService.signUp({
          fullName: "John Doe",
          email: "not-an-email",
          password: "Password123!",
        })
      ).rejects.toThrow("Please enter a valid email address.");
    });

    it("rejects signup with mismatched confirm password", async () => {
      await expect(
        authService.signUp({
          fullName: "John Doe",
          email: "john@example.com",
          password: "Password123!",
          confirmPassword: "DifferentPassword123!",
        })
      ).rejects.toThrow("Passwords do not match.");
    });

    it("rejects weak passwords during signup with specific feedback", async () => {
      await expect(
        authService.signUp({
          fullName: "John Doe",
          email: "john@example.com",
          password: "123",
          confirmPassword: "123",
        })
      ).rejects.toThrow("Password is too weak.");
    });

    it("successfully creates and verifies an account directly with valid email and password", async () => {
      const res = await authService.signUp({
        fullName: "Jane Creator",
        email: "jane@dailygap.com",
        password: "StrongPass123!#",
        confirmPassword: "StrongPass123!#",
      });

      expect(res.user.email).toBe("jane@dailygap.com");
      expect(res.user.full_name).toBe("Jane Creator");
      expect(res.user.email_verified).toBe(true);
      expect(res.requiresVerification).toBe(false);
      expect(res.session).toBeDefined();
      expect(res.session?.user.email).toBe("jane@dailygap.com");
    });

    it("prevents registering with an already taken email", async () => {
      await authService.signUp({
        fullName: "First User",
        email: "taken@example.com",
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      });

      await expect(
        authService.signUp({
          fullName: "Second User",
          email: "taken@example.com",
          password: "StrongPassword123!",
          confirmPassword: "StrongPassword123!",
        })
      ).rejects.toThrow("This email is already registered.");
    });
  });

  describe("Email Verification & Helper Utilities", () => {
    it("generates and verifies account with a valid token when invoked", async () => {
      const signupRes = await authService.signUp({
        fullName: "Verify Tester",
        email: "verify.test@example.com",
        password: "SecurePass123!",
        confirmPassword: "SecurePass123!",
      });

      const emailRecord = await authService.sendVerificationEmail("verify.test@example.com");
      const token = emailRecord.token;
      const verifyRes = await authService.verifyEmailToken(token);
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.user.email_verified).toBe(true);
    });

    it("verifies account with a 6-character short code", async () => {
      await authService.signUp({
        fullName: "Code Tester",
        email: "code.test@example.com",
        password: "SecurePass123!",
        confirmPassword: "SecurePass123!",
      });

      const emailRecord = await authService.sendVerificationEmail("code.test@example.com");
      const token = emailRecord.token;
      const shortCode = token.substring(0, 6).toUpperCase();
      const verifyRes = await authService.verifyEmailToken(shortCode);
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.user.email_verified).toBe(true);
    });

    it("verifies account instantly via direct verification method", async () => {
      await authService.signUp({
        fullName: "Direct Tester",
        email: "direct.test@example.com",
        password: "SecurePass123!",
        confirmPassword: "SecurePass123!",
      });

      const directRes = await authService.verifyEmailDirect("direct.test@example.com");
      expect(directRes.success).toBe(true);
      expect(directRes.user.email_verified).toBe(true);
      expect(directRes.session.token).toBeDefined();
    });

    it("retrieves active verification token and short code", async () => {
      await authService.signUp({
        fullName: "Token Retrieval Tester",
        email: "retrieval@example.com",
        password: "SecurePass123!",
        confirmPassword: "SecurePass123!",
      });

      await authService.sendVerificationEmail("retrieval@example.com");
      const tokenInfo = authService.getActiveVerificationToken("retrieval@example.com");
      expect(tokenInfo).not.toBeNull();
      expect(tokenInfo?.code).toHaveLength(6);
      expect(tokenInfo?.actionUrl).toContain("verify-email");
    });

    it("rejects an invalid or non-existent verification token", async () => {
      await expect(authService.verifyEmailToken("invalid_fake_token_12345")).rejects.toThrow(
        "Invalid verification link or code."
      );
    });

    it("rejects an already-used verification token", async () => {
      await authService.signUp({
        fullName: "Double Verify",
        email: "double@example.com",
        password: "SecurePass123!",
        confirmPassword: "SecurePass123!",
      });

      const emailRecord = await authService.sendVerificationEmail("double@example.com");
      const token = emailRecord.token;
      await authService.verifyEmailToken(token);

      // Second attempt
      await expect(authService.verifyEmailToken(token)).rejects.toThrow(
        "This verification link has already been used."
      );
    });

    it("enforces resend rate limits and cooldowns", async () => {
      const signupRes = await authService.signUp({
        fullName: "Resend Tester",
        email: "resend@example.com",
        password: "SecurePass123!",
        confirmPassword: "SecurePass123!",
      });

      await authService.sendVerificationEmail(signupRes.user.email);

      // Immediate resend should trigger cooldown
      await expect(authService.sendVerificationEmail(signupRes.user.email)).rejects.toThrow(
        "Too many resend attempts"
      );
    });
  });

  describe("Sign In Flow & Authentication Guarding", () => {
    beforeEach(async () => {
      // Create a test user
      await authService.signUp({
        fullName: "Verified User",
        email: "verified@dailygap.com",
        password: "CorrectPassword123!",
        confirmPassword: "CorrectPassword123!",
      });
    });

    it("rejects sign in if email is not found", async () => {
      await expect(
        authService.signIn({
          email: "unknown@example.com",
          password: "SomePassword123!",
        })
      ).rejects.toThrow("Account not found.");
    });

    it("rejects sign in with incorrect password", async () => {
      await expect(
        authService.signIn({
          email: "verified@dailygap.com",
          password: "WrongPassword999!",
        })
      ).rejects.toThrow("Incorrect email or password.");
    });

    it("blocks unverified accounts from signing in and provides unverified signal", async () => {
      // Manually simulate an unverified user in storage
      const users = authService.getAllUsers();
      const existing = users.find(u => u.email === "verified@dailygap.com");
      if (existing) {
        authService.updateUserProfile(existing.id, { email_verified: false });
      }

      try {
        await authService.signIn({
          email: "verified@dailygap.com",
          password: "CorrectPassword123!",
        });
        expect.unreachable("Should have thrown EMAIL_NOT_VERIFIED error");
      } catch (err: any) {
        expect(err.code).toBe("EMAIL_NOT_VERIFIED");
        expect(err.message).toContain("Email not verified");
      }
    });

    it("successfully signs in a verified user and creates an active session", async () => {
      const res = await authService.signIn({
        email: "verified@dailygap.com",
        password: "CorrectPassword123!",
        rememberMe: true,
      });

      expect(res.user.email).toBe("verified@dailygap.com");
      expect(res.session.token).toBeTruthy();

      const current = authService.getCurrentSession();
      expect(current).not.toBeNull();
      expect(current?.user.email).toBe("verified@dailygap.com");
    });

    it("locks account after 5 consecutive failed login attempts", () => {
      const targetEmail = "verified@dailygap.com";

      // 4 failures
      for (let i = 0; i < 4; i++) {
        authService.recordFailedLogin(targetEmail);
      }

      const statusBefore = authService.checkLoginRateLimit(targetEmail);
      expect(statusBefore.isLocked).toBe(false);

      // 5th failure
      const status5th = authService.recordFailedLogin(targetEmail);
      expect(status5th.isLocked).toBe(true);
      expect(status5th.remainingSeconds).toBeGreaterThan(0);
    });
  });

  describe("Forgot Password & Reset Password Flow", () => {
    beforeEach(async () => {
      const signup = await authService.signUp({
        fullName: "Reset Target",
        email: "target@dailygap.com",
        password: "OldPassword123!",
        confirmPassword: "OldPassword123!",
      });
      if (signup.emailRecord) {
        await authService.verifyEmailToken(signup.emailRecord.token);
      }
    });

    it("returns generic success state on forgot password without leaking email existence", async () => {
      const nonExistent = await authService.requestPasswordReset("nonexistent@example.com");
      expect(nonExistent.success).toBe(true);

      const existing = await authService.requestPasswordReset("target@dailygap.com");
      expect(existing.success).toBe(true);
      expect(existing.emailRecord).toBeDefined();
      expect(existing.emailRecord?.type).toBe("password_reset");
    });

    it("validates reset token and successfully resets user password", async () => {
      const req = await authService.requestPasswordReset("target@dailygap.com");
      const token = req.emailRecord!.token;

      // Validate token
      const val = await authService.validateResetToken(token);
      expect(val.valid).toBe(true);
      expect(val.email).toBe("target@dailygap.com");

      // Complete reset
      const resetRes = await authService.completePasswordReset({
        token,
        newPassword: "BrandNewPassword123!",
        confirmPassword: "BrandNewPassword123!",
      });

      expect(resetRes.success).toBe(true);

      // Old password should fail
      await expect(
        authService.signIn({
          email: "target@dailygap.com",
          password: "OldPassword123!",
        })
      ).rejects.toThrow("Incorrect email or password.");

      // New password should succeed
      const signinRes = await authService.signIn({
        email: "target@dailygap.com",
        password: "BrandNewPassword123!",
      });
      expect(signinRes.user.email).toBe("target@dailygap.com");

      // Used token should now fail
      const secondVal = await authService.validateResetToken(token);
      expect(secondVal.valid).toBe(false);
      expect(secondVal.error).toContain("already been used");
    });
  });

  describe("Super Admin Credential Reception & Login Flow", () => {
    it("receives and stores super admin credentials during signup without requiring email verification", async () => {
      const superAdminRes = await authService.signUp({
        fullName: "Ebenezer Aledu",
        email: "ebenezeraledu@gmail.com",
        password: "MySuperAdminPass123!",
        confirmPassword: "MySuperAdminPass123!",
      });

      expect(superAdminRes.user.role).toBe("super_admin");
      expect(superAdminRes.user.email_verified).toBe(true);
      expect(superAdminRes.requiresVerification).toBe(false);
      expect(superAdminRes.session).toBeDefined();

      // Sign in with the newly established super admin password
      const signInRes = await authService.signIn({
        email: "ebenezeraledu@gmail.com",
        password: "MySuperAdminPass123!",
      });

      expect(signInRes.user.role).toBe("super_admin");
      expect(signInRes.user.email).toBe("ebenezeraledu@gmail.com");
      expect(signInRes.session.token).toBeDefined();
    });

    it("allows super admin to sign in directly with credentials", async () => {
      const signInRes = await authService.signIn({
        email: "ebenezeraledu@gmail.com",
        password: "Password123!",
      });

      expect(signInRes.user.role).toBe("super_admin");
      expect(signInRes.user.email).toBe("ebenezeraledu@gmail.com");
      expect(signInRes.user.email_verified).toBe(true);
    });
  });

  describe("Complete Database Sweep (Wipe All Users Except Super Admin)", () => {
    it("sweeps all non-admin users, passwords, and tokens while preserving super admin", async () => {
      // 1. Setup custom super admin password
      await authService.signUp({
        fullName: "Ebenezer Aledu",
        email: "ebenezeraledu@gmail.com",
        password: "AdminCustomPass123!",
        confirmPassword: "AdminCustomPass123!",
      });

      // 2. Create regular user 1
      const user1 = await authService.signUp({
        fullName: "Alice Wonderland",
        email: "alice@example.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });
      if (user1.emailRecord) {
        await authService.verifyEmailToken(user1.emailRecord.token);
      }

      // 3. Create regular user 2
      const user2 = await authService.signUp({
        fullName: "Bob Builder",
        email: "bob@example.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      // Store local user data
      localStorage.setItem(`dailygap_profile_${user1.user.id}`, JSON.stringify({ bio: "Alice Bio" }));
      localStorage.setItem(`dailygap_local_cals_${user1.user.id}`, JSON.stringify([{ id: "cal_1" }]));
      localStorage.setItem(`dailygap_ai_credits_${user1.user.id}`, "50");

      expect(authService.getAllUsers().length).toBeGreaterThanOrEqual(3);

      // 4. Perform complete database sweep
      const wipeResult = authService.wipeDatabaseExceptSuperAdmin();
      expect(wipeResult.wipedCount).toBeGreaterThanOrEqual(2);
      expect(wipeResult.superAdmin.email).toBe("ebenezeraledu@gmail.com");

      // 5. Verify non-admin accounts are completely gone
      const remainingUsers = authService.getAllUsers();
      expect(remainingUsers.length).toBe(1);
      expect(remainingUsers[0].email).toBe("ebenezeraledu@gmail.com");
      expect(remainingUsers[0].role).toBe("super_admin");

      // Attempting to sign in with wiped user throws user not found
      await expect(
        authService.signIn({
          email: "alice@example.com",
          password: "Password123!",
        })
      ).rejects.toThrow(/Account not found|Incorrect email/i);

      // Local storage items for alice are purged
      expect(localStorage.getItem(`dailygap_profile_${user1.user.id}`)).toBeNull();
      expect(localStorage.getItem(`dailygap_local_cals_${user1.user.id}`)).toBeNull();
      expect(localStorage.getItem(`dailygap_ai_credits_${user1.user.id}`)).toBeNull();

      // 6. Super Admin can still sign in directly with established credentials
      const adminSignIn = await authService.signIn({
        email: "ebenezeraledu@gmail.com",
        password: "AdminCustomPass123!",
      });
      expect(adminSignIn.user.role).toBe("super_admin");
      expect(adminSignIn.user.email_verified).toBe(true);

      // 7. Wiped user can now sign up afresh and logs in directly
      const freshSignup = await authService.signUp({
        fullName: "Alice Wonderland",
        email: "alice@example.com",
        password: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      });
      expect(freshSignup.requiresVerification).toBe(false);
      expect(freshSignup.user.email_verified).toBe(true);
    });

    it("prevents deleting the super admin account individually", () => {
      expect(() => {
        authService.deleteUser("ebenezeraledu@gmail.com");
      }).toThrow(/Super Admin/);
    });

    it("deletes single non-admin user completely", async () => {
      const user = await authService.signUp({
        fullName: "Charlie Brown",
        email: "charlie@example.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      expect(authService.getAllUsers().some(u => u.email === "charlie@example.com")).toBe(true);

      authService.deleteUser(user.user.id);

      expect(authService.getAllUsers().some(u => u.email === "charlie@example.com")).toBe(false);

      await expect(
        authService.signIn({
          email: "charlie@example.com",
          password: "Password123!",
        })
      ).rejects.toThrow(/Account not found|Incorrect email/i);
    });
  });
});
