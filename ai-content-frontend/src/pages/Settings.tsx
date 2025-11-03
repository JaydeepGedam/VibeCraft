import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { userAPI, linkedInAPI } from "@/services/api";
import { Linkedin, Check, X } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";

  const [defaultTone, setDefaultTone] = useState("");
  const [defaultContentType, setDefaultContentType] = useState("");
  const [defaultGoal, setDefaultGoal] = useState("");
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
      setDefaultTone(response.preferences?.defaultTone || "");
      setDefaultContentType(response.preferences?.defaultContentType || "");
      setDefaultGoal(response.preferences?.defaultGoal || "");
    } catch (error) {
      setDefaultTone("");
      setDefaultContentType("");
      setDefaultGoal("");
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
      await userAPI.updatePreferences({
        defaultTone,
        defaultContentType,
        defaultGoal,
      });
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
                  <SelectItem value="Blog">Blog Post</SelectItem>
                  <SelectItem value="LinkedIn">LinkedIn Post</SelectItem>
                  <SelectItem value="Product">Product Description</SelectItem>
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
                  <SelectItem value="Sell">Sell</SelectItem>
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
                  <SelectItem value="Formal">Formal</SelectItem>
                  <SelectItem value="Friendly">Friendly</SelectItem>
                  <SelectItem value="Witty">Witty</SelectItem>
                  <SelectItem value="Persuasive">Persuasive</SelectItem>
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
