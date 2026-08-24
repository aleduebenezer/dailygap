import { Check, X } from "lucide-react";
import { evaluatePasswordStrength } from "@/lib/authService";

interface PasswordRequirementsProps {
  password: string;
  showAlways?: boolean;
}

export function PasswordRequirements({ password, showAlways = false }: PasswordRequirementsProps) {
  if (!password && !showAlways) return null;

  const result = evaluatePasswordStrength(password);

  const requirements = [
    { label: "At least 8 characters", met: result.hasMinLength },
    { label: "Uppercase letter (A-Z)", met: result.hasUppercase },
    { label: "Lowercase letter (a-z)", met: result.hasLowercase },
    { label: "Number (0-9)", met: result.hasNumber },
    { label: "Special character (!@#$%^&*)", met: result.hasSpecialChar },
  ];

  return (
    <div className="space-y-2.5 p-3 rounded-xl bg-muted/40 border border-border/60 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground">Password strength:</span>
        <span className={`font-bold ${result.color.split(" ")[1] || "text-muted-foreground"}`}>
          {password ? result.label : "Not entered"}
        </span>
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`rounded-full h-full transition-all duration-300 ${
              result.score >= step
                ? step <= 1
                  ? "bg-rose-500"
                  : step === 2
                  ? "bg-amber-500"
                  : step === 3
                  ? "bg-yellow-500"
                  : "bg-emerald-500"
                : "bg-muted/80"
            }`}
          />
        ))}
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
        {requirements.map((req, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            {req.met ? (
              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            )}
            <span className={req.met ? "text-foreground font-medium" : "text-muted-foreground"}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
