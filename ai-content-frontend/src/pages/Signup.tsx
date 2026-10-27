import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, RotateCw, Mail, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { authAPI } from "@/services/api";

type Step = "form" | "otp";

const Signup = () => {
  const navigate = useNavigate();

  // Step tracking
  const [step, setStep] = useState<Step>("form");

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP step
  const [otp, setOtp] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  // Loading
  const [isLoading, setIsLoading] = useState(false);

  const isValidEmail = (value: string) => {
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/.test(value);
  };

  // Step 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!strongPasswordRegex.test(password)) {
      toast.error("Password must be at least 8 chars and include uppercase, lowercase, number and symbol");
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.sendOtp(name, email, password);
      setMaskedEmail(response.maskedEmail || email);
      setStep("otp");
      toast.success("Verification code sent! Check your inbox.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to send OTP";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP and create account
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp || otp.trim().length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.verifyOtp(email, otp.trim());
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("authToken", response.token);
      localStorage.setItem("userName", response.user.name);
      toast.success("Account created successfully! Welcome to VibeCraft 🎉");
      navigate("/dashboard", { state: { from: "signup" } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Verification failed";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setIsResending(true);
    setOtp("");
    try {
      const response = await authAPI.sendOtp(name, email, password);
      setMaskedEmail(response.maskedEmail || email);
      toast.success("New verification code sent!");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to resend OTP";
      toast.error(msg);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <Card className="w-full max-w-md animate-fade-in shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>

          {step === "form" ? (
            <>
              <CardTitle className="text-2xl">Create Account</CardTitle>
              <CardDescription>Start generating amazing content today</CardDescription>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mx-auto mb-2">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Check your email</CardTitle>
              <CardDescription className="leading-relaxed">
                We sent a 6-digit code to{" "}
                <span className="font-semibold text-foreground">{maskedEmail}</span>
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent>
          {/* ── Step 1: Signup form ── */}
          {step === "form" && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="text-sm text-primary hover:underline px-2 shrink-0"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  8+ characters with uppercase, lowercase, number and symbol.
                </p>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" /> Sending code...
                  </>
                ) : (
                  <>
                    Continue <Mail className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* ── Step 2: OTP verification ── */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-2xl font-bold tracking-[0.5em] h-14"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  This code expires in 10 minutes
                </p>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" /> Verify & Create Account
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => { setStep("form"); setOtp(""); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResending}
                  className="text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? "Sending..." : "Resend code"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link to="/login" className="text-primary hover:underline font-medium">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
