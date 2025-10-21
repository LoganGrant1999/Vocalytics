import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Youtube, CheckCircle2, AlertCircle, Moon, Sun, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useSession } from '@/hooks/useSession';
import { UsageMeter } from '@/components/UsageMeter';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

function SettingToggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { isDark, toggle } = useDarkMode();
  const { session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const FREE_ANALYZE_LIMIT = 2; // per week
  const FREE_REPLY_LIMIT = 1; // per day
  const isPro = session?.tier === 'pro';

  // Fetch tone profile
  const { data: toneData, isLoading: toneLoading } = useQuery({
    queryKey: ['tone-profile'],
    queryFn: async () => {
      try {
        const response = await api.get('/tone');
        return response.data.toneProfile;
      } catch (error) {
        return null;
      }
    },
    enabled: isPro
  });

  // Learn tone
  const learnTone = useMutation({
    mutationFn: async () => {
      return await api.post('/tone/learn');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tone-profile'] });
      toast.success('Tone analysis complete!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to analyze tone');
    }
  });

  // Fetch reply settings
  const { data: settingsData } = useQuery({
    queryKey: ['reply-settings'],
    queryFn: async () => {
      const response = await api.get('/comments/settings');
      return response.data.settings;
    },
    enabled: isPro
  });

  // Update settings
  const updateSettings = useMutation({
    mutationFn: async (settings: any) => {
      return await api.put('/comments/settings', settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reply-settings'] });
      toast.success('Settings updated');
    },
    onError: () => {
      toast.error('Failed to update settings');
    }
  });

  const handleConnectYouTube = () => {
    // Store current page for redirect after OAuth
    sessionStorage.setItem('oauth_redirect', '/settings');
    // Use current origin to work in both dev and production
    window.location.href = `${window.location.origin}/api/youtube/connect`;
  };

  const handleDisconnectYouTube = () => {
    // TODO: Implement disconnect functionality
    toast.info('Disconnect functionality coming soon');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-6 py-8">
      {/* Usage - Only show for free tier users */}
      {session?.tier === 'free' && (
        <Card className="hover:translate-y-0 hover:shadow-card rounded-lg">
          <CardHeader>
            <CardTitle>Usage This Period</CardTitle>
            <CardDescription>Monitor your API usage and limits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {session && (
                <>
                  <UsageMeter
                    label="Sentiment Analyses"
                    used={session.comments_analyzed_count}
                    limit={FREE_ANALYZE_LIMIT}
                    period="this week"
                  />
                  <UsageMeter
                    label="AI Replies"
                    used={session.replies_generated_count}
                    limit={FREE_REPLY_LIMIT}
                    period="today"
                  />
                </>
              )}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Button onClick={() => navigate('/billing')} className="w-full">
                Upgrade to Pro for Unlimited Usage
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Information */}
      <Card className="hover:translate-y-0 hover:shadow-card rounded-lg">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Name</label>
            <p className="text-base">{user?.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <p className="text-base">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Plan</label>
            <p className="text-base capitalize">{user?.tier}</p>
          </div>
        </CardContent>
      </Card>

      {/* Billing Management - Only show for pro tier users */}
      {session?.tier === 'pro' && (
        <Card className="hover:translate-y-0 hover:shadow-card rounded-lg">
          <CardHeader>
            <CardTitle>Subscription Management</CardTitle>
            <CardDescription>Manage your Pro subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Pro Plan Active</p>
                <p className="text-sm text-muted-foreground">
                  Unlimited analyses and AI replies. Manage your subscription, update payment method, or cancel anytime.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/billing')}>
                Manage Subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tone Learning Section */}
      <Card className="hover:translate-y-0 hover:shadow-card rounded-lg">
        <CardHeader>
          <CardTitle>Your Reply Style</CardTitle>
          <CardDescription>AI learns your writing style from past replies</CardDescription>
        </CardHeader>
        <CardContent>
          {!isPro && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-blue-800 dark:text-blue-200 mb-3">
                <strong>Pro Feature:</strong> AI learns your writing style from past replies
                to generate authentic responses that sound like you.
              </p>
              <Button onClick={() => navigate('/billing')}>
                Upgrade to Pro
              </Button>
            </div>
          )}

          {isPro && !toneData && (
            <div>
              <p className="text-muted-foreground mb-4">
                We'll analyze your past YouTube comment replies to understand your unique style.
                This helps generate replies that sound exactly like you wrote them.
              </p>
              <Button
                onClick={() => learnTone.mutate()}
                disabled={learnTone.isPending}
              >
                {learnTone.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Learn My Tone'
                )}
              </Button>
            </div>
          )}

          {isPro && toneData && (
            <div>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-green-600 dark:text-green-400 font-medium">Tone Learned</span>
                  <Badge variant="secondary">{toneData.learned_from_count} replies analyzed</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Tone:</span>
                    <p className="font-medium capitalize">{toneData.tone}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Formality:</span>
                    <p className="font-medium capitalize">{toneData.formality_level?.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Emoji Usage:</span>
                    <p className="font-medium capitalize">{toneData.emoji_usage}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Reply Length:</span>
                    <p className="font-medium capitalize">{toneData.avg_reply_length}</p>
                  </div>
                </div>

                {toneData.common_phrases?.length > 0 && (
                  <div className="mb-4">
                    <span className="text-sm text-muted-foreground block mb-2">Common phrases you use:</span>
                    <div className="flex flex-wrap gap-2">
                      {toneData.common_phrases.map((phrase: string, i: number) => (
                        <Badge key={i} variant="outline">"{phrase}"</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {toneData.example_replies?.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground block mb-2">Example replies:</span>
                    <div className="space-y-2">
                      {toneData.example_replies.slice(0, 3).map((reply: string, i: number) => (
                        <div key={i} className="bg-muted/50 border rounded p-3 text-sm">
                          "{reply}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => learnTone.mutate()}
                disabled={learnTone.isPending}
              >
                {learnTone.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Re-analyzing...
                  </>
                ) : (
                  'Re-analyze My Tone'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Priority Settings Section */}
      {isPro && settingsData && (
        <Card className="hover:translate-y-0 hover:shadow-card rounded-lg">
          <CardHeader>
            <CardTitle>Comment Priority Settings</CardTitle>
            <CardDescription>Choose which comments should be prioritized in your inbox</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <SettingToggle
                label="Questions about the video"
                description="Prioritize comments that ask questions"
                checked={settingsData.prioritize_questions}
                onChange={(checked) => updateSettings.mutate({
                  ...settingsData,
                  prioritize_questions: checked
                })}
              />

              <SettingToggle
                label="Negative sentiment"
                description="Address criticism and concerns quickly"
                checked={settingsData.prioritize_negative}
                onChange={(checked) => updateSettings.mutate({
                  ...settingsData,
                  prioritize_negative: checked
                })}
              />

              <SettingToggle
                label="Video title keywords"
                description="Comments that mention your video topic"
                checked={settingsData.prioritize_title_keywords}
                onChange={(checked) => updateSettings.mutate({
                  ...settingsData,
                  prioritize_title_keywords: checked
                })}
              />

              <SettingToggle
                label="Popular comments (5+ likes)"
                description="Comments that the community is engaging with"
                checked={settingsData.prioritize_popular}
                onChange={(checked) => updateSettings.mutate({
                  ...settingsData,
                  prioritize_popular: checked
                })}
              />

              <div className="pt-4 border-t">
                <h3 className="font-medium mb-3">Auto-Ignore</h3>

                <SettingToggle
                  label="Likely spam"
                  description="Hide spam and bot comments"
                  checked={settingsData.ignore_spam}
                  onChange={(checked) => updateSettings.mutate({
                    ...settingsData,
                    ignore_spam: checked
                  })}
                />

                <SettingToggle
                  label="Generic praise"
                  description='Hide simple "great video!" comments'
                  checked={settingsData.ignore_generic_praise}
                  onChange={(checked) => updateSettings.mutate({
                    ...settingsData,
                    ignore_generic_praise: checked
                  })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appearance */}
      <Card className="hover:translate-y-0 hover:shadow-card rounded-lg">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how Vocalytics looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-2">
                {isDark ? (
                  <Moon className="h-6 w-6 text-primary" />
                ) : (
                  <Sun className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  {isDark ? 'Dark mode' : 'Light mode'}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={toggle}>
              {isDark ? (
                <>
                  <Sun className="mr-2 h-4 w-4" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="mr-2 h-4 w-4" />
                  Dark Mode
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card className="hover:translate-y-0 hover:shadow-card rounded-lg">
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>Manage your connected social accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-2">
                <Youtube className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">YouTube</p>
                <div className="flex items-center gap-2 text-sm">
                  {user?.hasYouTubeConnected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-muted-foreground">Connected</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Not connected</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {user?.hasYouTubeConnected ? (
              <Button variant="outline" onClick={handleDisconnectYouTube}>
                Disconnect
              </Button>
            ) : (
              <Button onClick={handleConnectYouTube}>
                <Youtube className="mr-2 h-4 w-4" />
                Connect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive hover:translate-y-0 hover:shadow-card rounded-lg">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible account actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => toast.info('Delete account functionality coming soon')}
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
