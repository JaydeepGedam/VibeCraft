import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { userAPI, linkedInAPI, QuotaInfo } from "@/services/api";
import { Linkedin, Check, X, Key, Eye, EyeOff, Sparkles } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";

  const [defaultTone, setDefaultTone] = useState("");
  const [defaultContentType, setDefaultContentType] = useState("");
  const [defaultGoal, setDefaultGoal] = useState("");
  const [defaultAudience, setDefaultAudience] = useState("General");
  const [customOpenAiKey, setCustomOpenAiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkedInLoading, setLinkedInLoading] = useState(false);
  const [linkedInStatus, setLinkedInStatus] = useState<{
    isConnected: boolean;
    profile: { name: string; connectedAt: string } | null;
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    } else {
      loadPreferences();
      loadLinkedInStatus();
    }
  }, [isAuthenticated, navigate]);

  // Handle LinkedIn OAuth callback
  useEffect(() => {
    const success = searchParams.get("linkedin_success");
    const error = searchParams.get("linkedin_error");
    
    if (success === "true") {
      toast.success("LinkedIn account connected successfully!");
      loadLinkedInStatus();
      // Clean URL
      navigate("/settings", { replace: true });
    } else if (error) {
      const message = error === 'already_linked'
        ? 'This LinkedIn account is already linked to another Vibecraft user.'
        : `LinkedIn connection failed: ${error}`;
      toast.error(message);
      navigate("/settings", { replace: true });
    }
  }, [searchParams, navigate]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getPreferences();
      if (response.quota) {
        setQuota(response.quota);
      }
      setDefaultTone(response.preferences?.defaultTone || "");
      setDefaultContentType(response.preferences?.defaultContentType || "");
      setDefaultGoal(response.preferences?.defaultGoal || "");
      setDefaultAudience(response.preferences?.defaultAudience || "General");
      setCustomOpenAiKey(response.preferences?.customOpenAiKey || "");
    } catch (error) {
      setDefaultTone("");
      setDefaultContentType("");
      setDefaultGoal("");
      setDefaultAudience("General");
      setCustomOpenAiKey("");
    } finally {
      setLoading(false);
    }
  };

  const loadLinkedInStatus = async () => {
    try {
      const status = await linkedInAPI.getStatus();
      setLinkedInStatus(status);
    } catch (error) {
      console.error("Failed to load LinkedIn status:", error);
    }
  };

  const handleConnectLinkedIn = async () => {
    try {
      setLinkedInLoading(true);
      const response = await linkedInAPI.getAuthUrl();
      // Redirect to LinkedIn OAuth
      window.location.href = response.authUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to get LinkedIn auth URL");
      setLinkedInLoading(false);
    }
  };

  const handleDisconnectLinkedIn = async () => {
    try {
      setLinkedInLoading(true);
      await linkedInAPI.disconnect();
      toast.success("LinkedIn account disconnected successfully");
      // Optimistically update UI; then refresh from server
      setLinkedInStatus({ isConnected: false, profile: null });
      await loadLinkedInStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect LinkedIn account");
    } finally {
      setLinkedInLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await userAPI.updatePreferences({
        defaultTone,
        defaultContentType,
        defaultGoal,
        defaultAudience,
        customOpenAiKey,
      });
      if (response?.quota) {
        setQuota(response.quota);
      }
      toast.success("Preferences saved successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save preferences");
    }
  };

  if (loading) {
    return (
      <Layout showNav>
        <div className="max-w-2xl mx-auto">
          <p className="text-center text-muted-foreground">Loading preferences...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showNav>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground text-lg">
            Customize your default content preferences
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Default Preferences</CardTitle>
            <CardDescription>
              Set your preferred defaults for content generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="defaultContentType">Default Content Type</Label>
              <Select value={defaultContentType} onValueChange={setDefaultContentType}>
                <SelectTrigger id="defaultContentType">
                  <SelectValue placeholder="Select default type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LinkedIn">LinkedIn Post</SelectItem>
                  <SelectItem value="Blog">Blog Post</SelectItem>
                  <SelectItem value="Product">Product Description</SelectItem>
                  <SelectItem value="Twitter">Twitter / X Thread</SelectItem>
                  <SelectItem value="Email">Cold Email</SelectItem>
                  <SelectItem value="Instagram">Instagram Caption</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultGoal">Default Goal</Label>
              <Select value={defaultGoal} onValueChange={setDefaultGoal}>
                <SelectTrigger id="defaultGoal">
                  <SelectValue placeholder="Select default goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Educate">Educate</SelectItem>
                  <SelectItem value="Persuade">Persuade</SelectItem>
                  <SelectItem value="Entertain">Entertain</SelectItem>
                  <SelectItem value="Sell">Sell / Convert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultTone">Default Tone</Label>
              <Select value={defaultTone} onValueChange={setDefaultTone}>
                <SelectTrigger id="defaultTone">
                  <SelectValue placeholder="Select default tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Professional">Professional & Authoritative</SelectItem>
                  <SelectItem value="Friendly">Friendly & Approachable</SelectItem>
                  <SelectItem value="Witty">Witty & Creative</SelectItem>
                  <SelectItem value="Persuasive">Persuasive & Direct</SelectItem>
                  <SelectItem value="Inspirational">Inspirational & Bold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultAudience">Default Target Audience</Label>
              <Select value={defaultAudience} onValueChange={setDefaultAudience}>
                <SelectTrigger id="defaultAudience">
                  <SelectValue placeholder="Select target audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General Audience</SelectItem>
                  <SelectItem value="Tech">Software Engineers / Tech</SelectItem>
                  <SelectItem value="Founders">Founders & Leaders</SelectItem>
                  <SelectItem value="Creators">Marketers & Creators</SelectItem>
                  <SelectItem value="JobSeekers">Students & Job Seekers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSave} className="w-full">
              Save Preferences
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Custom OpenAI API Key (BYOK)
            </CardTitle>
            <CardDescription>
              Bring Your Own Key: use your private OpenAI API key to bypass shared limits. Leave blank to use the default system quota.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Live Quota Status Banner */}
            {quota?.hasCustomKey ? (
              <div className="p-3.5 rounded-lg border border-green-500/30 bg-green-500/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Custom Key Active</p>
                    <p className="text-xs text-muted-foreground">
                      Unlimited generations unlocked. All requests use your personal OpenAI account.
                    </p>
                  </div>
                </div>
                <Badge className="bg-green-600 text-white hover:bg-green-600 shrink-0">
                  Unlimited
                </Badge>
              </div>
            ) : quota ? (
              <div className="p-3.5 rounded-lg border border-border/80 bg-secondary/30 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Free Tier Generation Quota
                  </span>
                  <span
                    className={`font-semibold ${
                      quota.remaining === 0 ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {quota.generationsUsed} / {quota.freeGenerationLimit} used ({quota.remaining} remaining)
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (quota.generationsUsed / quota.freeGenerationLimit) * 100)}
                  className={`h-2 ${quota.remaining === 0 ? "[&>div]:bg-destructive" : ""}`}
                />
                <p className="text-xs text-muted-foreground">
                  {quota.remaining > 0
                    ? `You have ${quota.remaining} free generations remaining. Once exhausted, add your OpenAI API key to continue without limits.`
                    : "You've used all 15 free generations. Add your personal OpenAI API key below to unlock unlimited generations."}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="customOpenAiKey">OpenAI API Key</Label>
              <div className="relative">
                <Input
                  id="customOpenAiKey"
                  type={showApiKey ? "text" : "password"}
                  placeholder="sk-proj-... or sk-..."
                  value={customOpenAiKey}
                  onChange={(e) => setCustomOpenAiKey(e.target.value)}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your key is stored securely in your private user profile and used directly for all generations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleSave} className="flex-1">
                Save API Key
              </Button>
              {customOpenAiKey && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    setCustomOpenAiKey("");
                    try {
                      const res = await userAPI.updatePreferences({
                        defaultTone,
                        defaultContentType,
                        defaultGoal,
                        defaultAudience,
                        customOpenAiKey: "",
                      });
                      if (res?.quota) setQuota(res.quota);
                      toast.success("API Key removed. Reverted to standard quota.");
                    } catch (e) {
                      toast.error("Failed to remove API key");
                    }
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  Remove Key
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Linkedin className="w-5 h-5" />
              LinkedIn Integration
            </CardTitle>
            <CardDescription>
              Connect your LinkedIn account to post content directly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {linkedInStatus?.isConnected ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="font-medium">Connected</p>
                      {linkedInStatus.profile && (
                        <p className="text-sm text-muted-foreground">
                          {linkedInStatus.profile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleDisconnectLinkedIn}
                  variant="destructive"
                  className="w-full"
                  disabled={linkedInLoading}
                >
                  <X className="w-4 h-4 mr-2" />
                  Disconnect LinkedIn
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <X className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Not Connected</p>
                      <p className="text-sm text-muted-foreground">
                        Connect your LinkedIn account to post content directly
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleConnectLinkedIn}
                  className="w-full"
                  disabled={linkedInLoading}
                >
                  <Linkedin className="w-4 h-4 mr-2" />
                  {linkedInLoading ? "Connecting..." : "Connect LinkedIn"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Settings;
