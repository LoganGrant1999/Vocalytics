import { Button } from '@/components/ui/button';
import { BarChart3, MessageSquare, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ConnectYouTubeButton } from '@/components/ConnectYouTubeButton';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4">
      {/* Hero Section */}
      <div className="py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm mb-6">
          <Sparkles className="h-4 w-4" />
          <span>AI-Powered YouTube Comment Analytics</span>
        </div>

        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Turn Comments Into
          <br />
          <span className="text-primary">Actionable Insights</span>
        </h1>

        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Analyze sentiment, generate AI replies, and understand your audience
          better. Built for creators who want to engage smarter, not harder.
        </p>

        <div className="flex gap-4 justify-center">
          <ConnectYouTubeButton size="lg" />
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate('/billing')}
          >
            View Pricing
          </Button>
        </div>
      </div>

      {/* Features */}
      <div className="py-20 border-t">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything You Need to Manage Comments
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<BarChart3 className="h-10 w-10 text-primary" />}
            title="Sentiment Analysis"
            description="Instantly analyze comment sentiment to understand how your audience feels about your content."
          />
          <FeatureCard
            icon={<MessageSquare className="h-10 w-10 text-primary" />}
            title="AI Replies"
            description="Generate contextual, brand-aligned replies with GPT-4. Save hours while maintaining authenticity."
          />
          <FeatureCard
            icon={<MessageSquare className="h-10 w-10 text-primary" />}
            title="YouTube Integration"
            description="Seamlessly connect your YouTube channel and manage everything from one dashboard."
          />
        </div>
      </div>

      {/* CTA */}
      <div className="py-20 border-t text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Connect your YouTube channel and start analyzing comments in minutes.
        </p>
        <ConnectYouTubeButton size="lg" />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border p-6 text-center">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
