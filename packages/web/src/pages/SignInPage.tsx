import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Youtube, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api from "@/lib/api";

const SignInPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleYouTubeSignIn = () => {
    // Redirect to YouTube OAuth endpoint
    window.location.href = api.getYouTubeOAuthUrl();
  };

  const handleEmailSignIn = async () => {
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
      // Navigation handled by login function
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = () => {
    navigate("/register");
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
              Connect your channel. We'll handle the comment chaos.
            </p>
          </div>

          {/* YouTube sign-in */}
          <Button
            onClick={handleYouTubeSignIn}
            className="w-full mb-6 bg-primary hover:bg-primary/90 glow-accent"
            size="lg"
          >
            <Youtube className="w-5 h-5 mr-2" />
            Sign in with YouTube
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailSignIn()}
                disabled={isLoading}
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
                onKeyDown={(e) => e.key === 'Enter' && handleEmailSignIn()}
                disabled={isLoading}
                className="mt-1"
              />
            </div>
          </div>

          <Button
            onClick={handleEmailSignIn}
            variant="outline"
            className="w-full mb-4"
            disabled={isLoading || !email || !password}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>

          {/* Create account link */}
          <div className="text-center">
            <button
              onClick={handleCreateAccount}
              className="text-sm text-primary hover:underline"
            >
              Create account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
