import { Button } from '@/components/ui/button';
import { BarChart3, MessageSquare, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/app');
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="container mx-auto px-4">
      {/* Hero Section */}
      <div className="py-20 text-center relative">
        {/* Gradient background accent */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#E63946]/5 via-transparent to-[#4B5563]/5 rounded-3xl" />

        <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#E63946]/20 bg-[#E63946]/5 px-4 py-1.5 text-sm mb-6">
          <Sparkles className="h-4 w-4 text-[#E63946]" />
          <span className="text-[#E63946] font-semibold">AI-Powered YouTube Comment Analytics</span>
        </div>

        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Turn Comments Into
          <br />
          <span className="bg-gradient-to-r from-[#E63946] to-[#FF6B6B] bg-clip-text text-transparent">
            Actionable Insights
          </span>
        </h1>

        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Analyze sentiment, generate AI replies, and understand your audience
          better. Built for creators who want to engage smarter, not harder.
        </p>

        <div className="flex gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => navigate('/register')}
          >
            Get Started Free
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate('/login')}
          >
            Sign In
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mt-4">
          No credit card required
        </p>
      </div>

      {/* Features */}
      <div className="py-20 border-t">
        <h2 className="text-3xl font-bold text-center mb-4">
          Everything You Need to Manage Comments
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
          Powerful features designed to help you understand and engage with your audience
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<BarChart3 className="h-10 w-10 text-[#E63946]" />}
            title="Sentiment Analysis"
            description="Instantly analyze comment sentiment to understand how your audience feels about your content."
            gradient="from-[#E63946]/10 to-transparent"
          />
          <FeatureCard
            icon={<MessageSquare className="h-10 w-10 text-[#E63946]" />}
            title="AI Replies"
            description="Generate contextual, brand-aligned replies with GPT-4. Save hours while maintaining authenticity."
            gradient="from-[#FF6B6B]/10 to-transparent"
          />
          <FeatureCard
            icon={<MessageSquare className="h-10 w-10 text-[#E63946]" />}
            title="YouTube Integration"
            description="Seamlessly connect your YouTube channel and manage everything from one dashboard."
            gradient="from-[#4B5563]/10 to-transparent"
          />
        </div>
      </div>

      {/* CTA */}
      <div className="py-20 border-t text-center relative">
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#E63946]/5 to-transparent rounded-3xl" />
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Create your account and start analyzing comments in minutes.
        </p>
        <Button size="lg" onClick={() => navigate('/register')}>
          Get Started Free
        </Button>
        <p className="text-sm text-muted-foreground mt-4">
          Free tier includes 2 analyses per week
        </p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient?: string;
}) {
  return (
    <div className="rounded-xl border-2 border-brand-border p-6 text-center relative overflow-hidden group hover:border-[#E63946]/30 transition-all hover:shadow-lg">
      {gradient && (
        <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${gradient} group-hover:opacity-100 opacity-50 transition-opacity`} />
      )}
      <div className="flex justify-center mb-4 transform group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
