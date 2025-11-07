import { Button } from "@/components/ui/button";
import { Youtube, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";

const ConnectYouTubePage = () => {
  const navigate = useNavigate();

  const handleConnect = () => {
    // Redirect to YouTube OAuth
    window.location.href = api.getYouTubeOAuthUrl();
  };

  const handleSkip = () => {
    // Allow user to access app without YouTube connection
    navigate("/app/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center px-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

      <div className="w-full max-w-lg relative z-10">
        <div className="rounded-2xl border border-border bg-card p-10 shadow-2xl text-center">
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-6">
            <Youtube className="w-12 h-12 text-primary" />
          </div>

          <h1 className="text-3xl font-bold mb-3">Connect your YouTube channel</h1>
          
          <p className="text-muted-foreground mb-8">
            We'll analyze your comments, build your voice profile, and show you the top replies worth sending.
          </p>

          <Button
            onClick={handleConnect}
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 text-lg glow-accent mb-4"
          >
            <Youtube className="w-5 h-5 mr-2" />
            Connect YouTube
          </Button>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 text-left mb-6">
            <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              This lets us read comments and draft replies. <strong>We will not post without your approval.</strong>
            </p>
          </div>

          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectYouTubePage;
