import { Button } from "@/components/ui/button";
import { MessageSquare, Sparkles, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate("/register");
  };

  const handleSignIn = () => {
    navigate("/signin");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex flex-col relative overflow-hidden">
      {/* Top Menu Bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between relative z-20 bg-white border-b border-border shadow-sm">
        <img src="/banner_logo.png" alt="Vocalytics" className="h-[53px] w-auto" />
        <div className="flex items-center gap-3">
          <Button
            onClick={handleGetStarted}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
          >
            Get Started for Free
          </Button>
          <Button
            onClick={handleSignIn}
            variant="outline"
            className="border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Decorative background elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

      {/* Hero section */}
      <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary to-primary/70 text-white text-sm font-medium mb-4 shadow-lg shadow-primary/20">
          <Sparkles className="w-4 h-4" />
          For YouTube Creators
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight drop-shadow-lg">
          Reply to the right fans{" "}
          <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/70 bg-clip-text text-transparent animate-gradient">
            in your own voice
          </span>
          {" "}— in minutes, not hours.
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Vocalytics finds the comments that matter, drafts replies that sound like you, 
          and lets you publish them in bulk.
        </p>

        {/* Feature bullets */}
        <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto py-8">
          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-primary/5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20 transition-all group">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold">Auto-prioritize high-value comments</h3>
            <p className="text-sm text-muted-foreground">Never miss questions, sponsors, or top fans</p>
          </div>

          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-primary/5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20 transition-all group">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold">Reply in your own voice</h3>
            <p className="text-sm text-muted-foreground">AI learns your tone, emoji style, and phrases</p>
          </div>

          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-primary/5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20 transition-all group">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold">Batch send approved replies</h3>
            <p className="text-sm text-muted-foreground">Select, review, and post multiple replies at once</p>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button
            onClick={handleGetStarted}
            size="lg"
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white text-lg px-8 shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all hover:scale-105"
          >
            Get Started
          </Button>
          <Button
            onClick={handleSignIn}
            variant="outline"
            size="lg"
            className="text-lg px-8 border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
          >
            Sign in
          </Button>
        </div>

        {/* Trust note */}
        <p className="text-sm text-muted-foreground pt-8">
          We never post without approval. You can revoke YouTube access anytime.
        </p>
      </div>
    </div>
  );
};

export default LandingPage;
