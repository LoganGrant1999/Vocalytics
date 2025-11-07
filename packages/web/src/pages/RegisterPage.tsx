import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Youtube, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleYouTubeSignUp = () => {
    // Redirect to YouTube OAuth endpoint
    window.location.href = api.getYouTubeOAuthUrl();
  };

  const handleEmailSignUp = async () => {
    setError("");

    // Validation
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      // Split name into first and last
      const nameParts = name.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || firstName;

      await register({ firstName, lastName, email, password });
      // Navigation handled by register function
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = () => {
    navigate("/signin");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl">
          {/* Logo/Brand */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent mb-2">
              Vocalytics
            </h1>
            <p className="text-sm text-muted-foreground">
              Create your account to get started
            </p>
          </div>

          {/* YouTube sign-up */}
          <Button
            onClick={handleYouTubeSignUp}
            className="w-full mb-6 bg-primary hover:bg-primary/90 glow-accent"
            size="lg"
          >
            <Youtube className="w-5 h-5 mr-2" />
            Sign up with YouTube
          </Button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Email/password form */}
          <div className="space-y-4 mb-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must be at least 8 characters
              </p>
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <Button
            onClick={handleEmailSignUp}
            variant="outline"
            className="w-full mb-4"
            disabled={isLoading || !name || !email || !password || !confirmPassword}
          >
            {isLoading ? "Creating account..." : "Create account"}
          </Button>

          {/* Sign in link */}
          <div className="text-center">
            <span className="text-sm text-muted-foreground">Already have an account? </span>
            <button
              onClick={handleSignIn}
              className="text-sm text-primary hover:underline"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
