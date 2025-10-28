import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { userAPI } from "@/services/api";

const Settings = () => {
  const navigate = useNavigate();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";

  const [defaultTone, setDefaultTone] = useState("");
  const [defaultContentType, setDefaultContentType] = useState("");
  const [defaultGoal, setDefaultGoal] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    } else {
      loadPreferences();
    }
  }, [isAuthenticated, navigate]);

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
      </div>
    </Layout>
  );
};

export default Settings;
