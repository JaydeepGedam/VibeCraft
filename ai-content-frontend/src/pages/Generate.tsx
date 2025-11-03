import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sparkles, Copy, RotateCw, Save, Linkedin } from "lucide-react";
import { toast } from "sonner";
import { contentAPI, userAPI, linkedInAPI } from "@/services/api";

const Generate = () => {
  const navigate = useNavigate();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";

  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState("");
  const [goal, setGoal] = useState("");
  const [tone, setTone] = useState("");
  const [mood, setMood] = useState([50]);
  const [canSave, setCanSave] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPostingToLinkedIn, setIsPostingToLinkedIn] = useState(false);
  const [linkedInConnected, setLinkedInConnected] = useState(false);
  const location = useLocation();

  // Load user preferences on component mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await userAPI.getPreferences();
        const prefs = response.preferences;
        if (prefs) {
          setContentType(prefs.defaultContentType || "");
          setGoal(prefs.defaultGoal || "");
          setTone(prefs.defaultTone || "");
        }
      } catch (error) {
        // Silently fail - user may not have preferences set
      }
    };

    const checkLinkedInStatus = async () => {
      try {
        const status = await linkedInAPI.getStatus();
        setLinkedInConnected(status.isConnected);
      } catch (error) {
        // Silently fail
      }
    };

    if (isAuthenticated) {
      loadPreferences();
      checkLinkedInStatus();
    }
  }, [isAuthenticated]);

  // If navigated from Dashboard with viewContent or regenerate, prefill fields
  useEffect(() => {
    const state = (location && (location.state as any)) || {};
    const view = state.viewContent || state.regenerate;
    if (view) {
      setTopic(view.topic || "");
      // backend/frontend mapping might use contentType or type
      setContentType(view.contentType || view.type || "");
      setGoal(view.goal || "");
      setTone(view.tone || "");
      setGeneratedContent(view.generatedText || view.content || "");
      // When we navigate from dashboard with existing content, disable Save
      // until the user regenerates content (or generates new content)
      setCanSave(false);
    }
  }, [location]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  const getMoodEmoji = (value: number) => {
    if (value < 33) return "😐 Serious";
    if (value < 67) return "🙂 Balanced";
    return "😄 Funny";
  };

  const handleGenerate = async () => {
    if (!topic || !contentType || !goal || !tone) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await contentAPI.generate({
        topic,
        contentType,
        goal,
        tone,
        mood: mood[0],
      });
      setGeneratedContent(response.content);
      // After successful generation, enable Save
      setCanSave(true);
      toast.success("Content generated successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate content");
    } finally {
      setIsGenerating(false);
    }
  };
  const handleRegenerate = () => {
    if (!generatedContent) {
      toast.error("Generate content first");
      return;
    }
    // When regenerating, disable save until the new generation finishes
    setCanSave(false);
    handleGenerate();
  };

  const handleCopy = () => {
    if (!generatedContent) {
      toast.error("No content to copy");
      return;
    }
    navigator.clipboard.writeText(generatedContent);
    toast.success("Copied to clipboard!");
  };

  const handleSave = async () => {
    if (!generatedContent) {
      toast.error("No content to save");
      return;
    }
    if (!canSave) {
      toast.error("Please regenerate or modify content before saving to avoid duplicates");
      return;
    }

    try {
      const res = await contentAPI.save({
        topic,
        contentType,
        goal,
        tone,
        mood: mood[0],
        generatedText: generatedContent,
      });
      toast.success("Content saved to dashboard!");
      // after saving, prevent immediate duplicate saves
      setCanSave(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save content");
    }
  };

  const handlePostToLinkedIn = async () => {
    if (!generatedContent) {
      toast.error("No content to post");
      return;
    }

    if (!linkedInConnected) {
      toast.error("Please connect your LinkedIn account in Settings first");
      return;
    }

    try {
      setIsPostingToLinkedIn(true);
      await linkedInAPI.post(generatedContent);
      toast.success("Posted to LinkedIn successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to post to LinkedIn";
      toast.error(errorMessage);
      if (errorMessage.includes("not connected") || errorMessage.includes("expired")) {
        setLinkedInConnected(false);
      }
    } finally {
      setIsPostingToLinkedIn(false);
    }
  };

  return (
    <Layout showNav>
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Generate Content</h1>
          <p className="text-muted-foreground text-lg">
            Create amazing AI-powered content in seconds
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Content Settings</CardTitle>
              <CardDescription>Configure your content parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic *</Label>
                <Input
                  id="topic"
                  placeholder="e.g., Tips for productivity"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contentType">Content Type *</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger id="contentType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Blog">Blog Post</SelectItem>
                    <SelectItem value="LinkedIn">LinkedIn Post</SelectItem>
                    <SelectItem value="Product">Product Description</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal">Goal *</Label>
                <Select value={goal} onValueChange={setGoal}>
                  <SelectTrigger id="goal">
                    <SelectValue placeholder="Select goal" />
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
                <Label htmlFor="tone">Tone *</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger id="tone">
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Formal">Formal</SelectItem>
                    <SelectItem value="Friendly">Friendly</SelectItem>
                    <SelectItem value="Witty">Witty</SelectItem>
                    <SelectItem value="Persuasive">Persuasive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Mood: {getMoodEmoji(mood[0])}</Label>
                <Slider
                  value={mood}
                  onValueChange={setMood}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>😐 Serious</span>
                  <span>🙂 Balanced</span>
                  <span>😄 Funny</span>
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                className="w-full gap-2"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Output Section */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Content</CardTitle>
              <CardDescription>Your AI-generated content appears here</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {generatedContent ? (
                <>
                  <Textarea
                    value={generatedContent}
                    onChange={(e) => setGeneratedContent(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                    readOnly
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={handleRegenerate} variant="outline" className="gap-2" disabled={isGenerating}>
                      <RotateCw className="w-4 h-4" />
                      Regenerate
                    </Button>
                    <Button onClick={handleCopy} variant="outline" className="gap-2">
                      <Copy className="w-4 h-4" />
                      Copy
                    </Button>
                    <Button onClick={handleSave} className="gap-2" disabled={!canSave}>
                      <Save className="w-4 h-4" />
                      Save
                    </Button>
                    {linkedInConnected && (
                      <Button 
                        onClick={handlePostToLinkedIn} 
                        variant="outline" 
                        className="gap-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 border-blue-200 dark:border-blue-800"
                        disabled={isPostingToLinkedIn}
                      >
                        <Linkedin className="w-4 h-4" />
                        {isPostingToLinkedIn ? "Posting..." : "Post to LinkedIn"}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="min-h-[400px] flex items-center justify-center border-2 border-dashed rounded-lg">
                  <div className="text-center p-8">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Fill in the settings and click Generate to create content
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Generate;
