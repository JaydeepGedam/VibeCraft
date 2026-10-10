import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sparkles,
  Copy,
  RotateCw,
  Save,
  Linkedin,
  Download,
  Scissors,
  Maximize2,
  Smile,
  Check,
  FileText,
  Eye,
  Edit3,
  ExternalLink,
  CheckCircle2,
  Wand2,
  Hash,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  MessageSquare,
  Repeat2,
  Send,
  Key,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { contentAPI, userAPI, linkedInAPI, QuotaInfo } from "@/services/api";

const PENDING_GENERATE_KEY = "vibecraft_pending_generate";

const Generate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";

  // Form State
  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState("LinkedIn");
  const [goal, setGoal] = useState("Educate");
  const [tone, setTone] = useState("Professional");
  const [audience, setAudience] = useState("General");
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [mood, setMood] = useState([50]);
  const [variationCount, setVariationCount] = useState<1 | 3>(1);
  const [enableStreaming, setEnableStreaming] = useState(true);

  // Quota & BYOK State
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);

  // Content & Variations State
  const [generatedContent, setGeneratedContent] = useState("");
  const [variations, setVariations] = useState<string[]>([]);
  const [activeVariationIndex, setActiveVariationIndex] = useState(0);
  const [canSave, setCanSave] = useState(false);
  const [savedContentId, setSavedContentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [isFeedFoldExpanded, setIsFeedFoldExpanded] = useState(false);

  // Loading States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState<string | null>(null);
  const [isPostingToLinkedIn, setIsPostingToLinkedIn] = useState(false);

  // LinkedIn State
  const [linkedInConnected, setLinkedInConnected] = useState(false);
  const [linkedInProfileName, setLinkedInProfileName] = useState<string | null>(null);
  const [isLinkedInModalOpen, setIsLinkedInModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Unsaved changes beforeunload guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (canSave && generatedContent.trim()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [canSave, generatedContent]);

  // Check auth
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Load user preferences and LinkedIn status
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadPreferences = async () => {
      try {
        const response = await userAPI.getPreferences();
        if (response.quota) {
          setQuota(response.quota);
        }
        const prefs = response.preferences;
        if (prefs) {
          if (prefs.defaultContentType) setContentType(prefs.defaultContentType);
          if (prefs.defaultGoal) setGoal(prefs.defaultGoal);
          if (prefs.defaultTone) setTone(prefs.defaultTone);
          if (prefs.defaultAudience) setAudience(prefs.defaultAudience);
        }
      } catch (error) {
        // Silently fail
      }
    };

    const checkLinkedInStatus = async () => {
      try {
        const status = await linkedInAPI.getStatus();
        setLinkedInConnected(status.isConnected);
        if (status.profile?.name) {
          setLinkedInProfileName(status.profile.name);
        }
      } catch (error) {
        // Silently fail
      }
    };

    loadPreferences();
    checkLinkedInStatus();
  }, [isAuthenticated]);

  // Handle LinkedIn OAuth callback query params on /generate
  useEffect(() => {
    const success = searchParams.get("linkedin_success");
    const error = searchParams.get("linkedin_error");

    if (success === "true") {
      toast.success("LinkedIn connected successfully!");
      linkedInAPI.getStatus().then((status) => {
        setLinkedInConnected(status.isConnected);
        if (status.profile?.name) setLinkedInProfileName(status.profile.name);
      });
      // Restore draft if saved before OAuth redirect
      const saved = sessionStorage.getItem(PENDING_GENERATE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.topic) setTopic(parsed.topic);
          if (parsed.contentType) setContentType(parsed.contentType);
          if (parsed.goal) setGoal(parsed.goal);
          if (parsed.tone) setTone(parsed.tone);
          if (parsed.audience) setAudience(parsed.audience);
          if (parsed.instructions) {
            setInstructions(parsed.instructions);
            setShowInstructions(true);
          }
          if (parsed.content) {
            setGeneratedContent(parsed.content);
            setVariations([parsed.content]);
            setCanSave(true);
          }
          sessionStorage.removeItem(PENDING_GENERATE_KEY);
        } catch (e) {
          // ignore
        }
      }
      navigate("/generate", { replace: true });
    } else if (error) {
      const message =
        error === "already_linked"
          ? "This LinkedIn account is already linked to another user."
          : `LinkedIn connection error: ${error}`;
      toast.error(message);
      navigate("/generate", { replace: true });
    }
  }, [searchParams, navigate]);

  // Prefill if navigated from Dashboard with viewContent or regenerate
  useEffect(() => {
    const state = (location && (location.state as any)) || {};
    const view = state.viewContent || state.regenerate;
    if (view) {
      setTopic(view.topic || "");
      setContentType(view.contentType || view.type || "LinkedIn");
      setGoal(view.goal || "Educate");
      setTone(view.tone || "Professional");
      if (view.audience) setAudience(view.audience);
      if (view.instructions) {
        setInstructions(view.instructions);
        setShowInstructions(true);
      }
      if (view._id) setSavedContentId(view._id);
      const text = view.generatedText || view.content || "";
      setGeneratedContent(text);
      setVariations(text ? [text] : []);
      setActiveVariationIndex(0);
      setCanSave(false);
    }
  }, [location]);

  // Mood label calculation
  const getMoodEmoji = (value: number) => {
    if (value < 25) return "😐 Serious & Analytical";
    if (value < 50) return "🙂 Professional & Balanced";
    if (value < 75) return "😊 Engaging & Friendly";
    return "😄 Witty & Humorous";
  };

  // Live stats calculation
  const charCount = generatedContent.length;
  const wordCount = generatedContent.trim() ? generatedContent.trim().split(/\s+/).length : 0;
  const readTimeMinutes = Math.max(1, Math.round(wordCount / 200));

  // Handle direct text changes by user
  const handleContentChange = (newText: string) => {
    setGeneratedContent(newText);
    setCanSave(true);
    if (variations.length > 0) {
      const updated = [...variations];
      updated[activeVariationIndex] = newText;
      setVariations(updated);
    }
  };

  // Switch between variations
  const handleSelectVariation = (idx: number) => {
    setActiveVariationIndex(idx);
    if (variations[idx]) {
      setGeneratedContent(variations[idx]);
    }
  };

  const handleQuotaError = (error: any) => {
    if (
      error?.status === 403 ||
      error?.data?.error === "FREE_LIMIT_REACHED" ||
      (typeof error?.message === "string" && error.message.includes("15 free generations"))
    ) {
      if (error?.data?.quota) {
        setQuota(error.data.quota);
      } else {
        userAPI.getPreferences().then((r) => r.quota && setQuota(r.quota)).catch(() => {});
      }
      setIsQuotaModalOpen(true);
      return true;
    }
    return false;
  };

  // Generation Handler
  const handleGenerate = async () => {
    if (!topic || !contentType || !goal || !tone) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (quota && !quota.hasCustomKey && quota.remaining <= 0) {
      setIsQuotaModalOpen(true);
      return;
    }

    setIsGenerating(true);
    setViewMode("edit");
    setSavedContentId(null);

    // Multi-variation generation
    if (variationCount > 1) {
      try {
        const response = await contentAPI.generate({
          topic,
          contentType,
          goal,
          tone,
          mood: mood[0],
          audience,
          instructions,
          count: variationCount,
        });
        if (response.quota) {
          setQuota(response.quota);
        }
        const list = response.variations || [response.content];
        setVariations(list);
        setActiveVariationIndex(0);
        setGeneratedContent(list[0] || "");
        setCanSave(true);
        toast.success(`Generated ${list.length} variations!`);
      } catch (error: any) {
        if (!handleQuotaError(error)) {
          toast.error(error instanceof Error ? error.message : "Failed to generate content");
        }
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // Single generation with streaming
    if (enableStreaming) {
      setGeneratedContent("");
      setVariations([]);
      abortControllerRef.current = new AbortController();

      try {
        let accumulated = "";
        await contentAPI.generateStream(
          {
            topic,
            contentType,
            goal,
            tone,
            mood: mood[0],
            audience,
            instructions,
          },
          (chunk) => {
            accumulated += chunk;
            setGeneratedContent(accumulated);
          },
          abortControllerRef.current.signal,
          (streamQuota) => {
            if (streamQuota) setQuota(streamQuota);
          }
        );
        setVariations([accumulated]);
        setActiveVariationIndex(0);
        setCanSave(true);
        toast.success("Content generated successfully!");
      } catch (error: any) {
        if (error.name !== "AbortError") {
          if (!handleQuotaError(error)) {
            toast.error(error instanceof Error ? error.message : "Failed to stream content");
          }
        }
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // Single generation without streaming (standard fallback)
    try {
      const response = await contentAPI.generate({
        topic,
        contentType,
        goal,
        tone,
        mood: mood[0],
        audience,
        instructions,
        count: 1,
      });
      if (response.quota) {
        setQuota(response.quota);
      }
      setGeneratedContent(response.content);
      setVariations([response.content]);
      setActiveVariationIndex(0);
      setCanSave(true);
      toast.success("Content generated successfully!");
    } catch (error: any) {
      if (!handleQuotaError(error)) {
        toast.error(error instanceof Error ? error.message : "Failed to generate content");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    if (!generatedContent) {
      toast.error("Generate content first");
      return;
    }
    setCanSave(false);
    handleGenerate();
  };

  // AI Refine actions
  const handleRefine = async (action: string) => {
    if (!generatedContent.trim()) {
      toast.error("Generate content before refining");
      return;
    }

    try {
      setIsRefining(action);
      const res = await contentAPI.refine({
        content: generatedContent,
        action,
      });
      if (res.content) {
        handleContentChange(res.content);
        toast.success(`Applied: ${action.replace("_", " ")}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refine content");
    } finally {
      setIsRefining(null);
    }
  };

  // Copy helpers
  const handleCopy = () => {
    if (!generatedContent) {
      toast.error("No content to copy");
      return;
    }
    navigator.clipboard.writeText(generatedContent);
    toast.success("Copied to clipboard!");
  };

  const handleCopyRichText = () => {
    if (!generatedContent) return;
    try {
      const blob = new Blob([generatedContent], { type: "text/plain" });
      const item = new ClipboardItem({ "text/plain": blob });
      navigator.clipboard.write([item]);
      toast.success("Copied rich text!");
    } catch (e) {
      handleCopy();
    }
  };

  // Export downloads
  const handleDownload = (format: "md" | "txt") => {
    if (!generatedContent) {
      toast.error("No content to export");
      return;
    }
    const filename = `${topic ? topic.replace(/[^a-z0-9]/gi, "_").toLowerCase() : "vibecraft_content"}.${format}`;
    const blob = new Blob([generatedContent], { type: format === "md" ? "text/markdown" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded as ${filename}`);
  };

  // Save to Dashboard
  const handleSave = async () => {
    if (!generatedContent) {
      toast.error("No content to save");
      return;
    }

    try {
      const res = await contentAPI.save({
        topic,
        contentType,
        goal,
        tone,
        mood: mood[0],
        audience,
        instructions,
        generatedText: generatedContent,
      });
      if (res?.content_id) {
        setSavedContentId(res.content_id);
      }
      toast.success("Content saved to dashboard!");
      setCanSave(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save content");
    }
  };

  // Start LinkedIn connect OAuth flow
  const handleInitiateLinkedInConnect = async () => {
    try {
      // Save current draft state to sessionStorage so it survives the OAuth redirect
      sessionStorage.setItem(
        PENDING_GENERATE_KEY,
        JSON.stringify({
          topic,
          contentType,
          goal,
          tone,
          audience,
          instructions,
          content: generatedContent,
        })
      );
      const res = await linkedInAPI.getAuthUrl("generate");
      window.location.href = res.authUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate LinkedIn connection");
    }
  };

  // Publish to LinkedIn
  const handleConfirmPostToLinkedIn = async () => {
    if (!generatedContent.trim()) {
      toast.error("Content cannot be empty");
      return;
    }

    try {
      setIsPostingToLinkedIn(true);
      await linkedInAPI.post(generatedContent);
      toast.success("Successfully published to LinkedIn!");
      setIsLinkedInModalOpen(false);

      // Automatically update published status in DB
      try {
        if (savedContentId) {
          await contentAPI.markPublished(savedContentId, "LinkedIn");
        } else {
          const res = await contentAPI.save({
            topic,
            contentType,
            goal,
            tone,
            mood: mood[0],
            audience,
            instructions,
            generatedText: generatedContent,
            isPublished: true,
            publishedPlatform: "LinkedIn",
          });
          if (res?.content_id) {
            setSavedContentId(res.content_id);
          }
        }
      } catch (pubErr) {
        console.error("Failed to mark content published in DB:", pubErr);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to post to LinkedIn";
      toast.error(msg);
      if (msg.includes("not connected") || msg.includes("expired")) {
        setLinkedInConnected(false);
      }
    } finally {
      setIsPostingToLinkedIn(false);
    }
  };

  return (
    <Layout showNav>
      <div className="max-w-7xl mx-auto animate-fade-in space-y-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Create & Polish Content</h1>
          <p className="text-muted-foreground text-lg">
            Generate high-impact marketing copy, social posts, and blogs with real-time AI streaming.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Parameters
                </CardTitle>
                <CardDescription>Configure your tone, format, and goals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic or Idea *</Label>
                  <Input
                    id="topic"
                    placeholder="e.g., 5 Lessons Learned Scaling a SaaS to $10k MRR"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contentType">Format *</Label>
                    <Select value={contentType} onValueChange={setContentType}>
                      <SelectTrigger id="contentType">
                        <SelectValue placeholder="Format" />
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
                    <Label htmlFor="goal">Goal *</Label>
                    <Select value={goal} onValueChange={setGoal}>
                      <SelectTrigger id="goal">
                        <SelectValue placeholder="Goal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Educate">Educate</SelectItem>
                        <SelectItem value="Persuade">Persuade</SelectItem>
                        <SelectItem value="Entertain">Entertain</SelectItem>
                        <SelectItem value="Sell">Sell / Convert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tone">Tone *</Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger id="tone">
                        <SelectValue placeholder="Tone" />
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
                    <Label htmlFor="audience">Target Audience</Label>
                    <Select value={audience} onValueChange={setAudience}>
                      <SelectTrigger id="audience">
                        <SelectValue placeholder="Target Audience" />
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
                </div>

                {/* Key Points & Custom Instructions Expandable */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowInstructions(!showInstructions)}
                    className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground hover:text-foreground py-1 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>Key Points & Custom Instructions</span>
                      {instructions.trim() && (
                        <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                      )}
                    </span>
                    {showInstructions ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {showInstructions && (
                    <div className="mt-2 space-y-1.5 animate-in fade-in-50 duration-200">
                      <Textarea
                        placeholder="Specific talking points, stats, callouts, or guidelines you want included..."
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        className="min-h-[75px] text-xs resize-y"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Add specific details, quotes, stats, or formatting rules for the AI.
                      </p>
                    </div>
                  )}
                </div>

                {/* Mood Slider */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-sm">
                    <Label>Mood</Label>
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {getMoodEmoji(mood[0])}
                    </span>
                  </div>
                  <Slider
                    value={mood}
                    onValueChange={setMood}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Serious / Formal</span>
                    <span>Balanced</span>
                    <span>Humorous</span>
                  </div>
                </div>

                {/* Variations & Streaming Options */}
                <div className="pt-3 border-t border-border/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Generation Mode</Label>
                      <p className="text-xs text-muted-foreground">Number of unique draft variations</p>
                    </div>
                    <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg">
                      <Button
                        type="button"
                        size="sm"
                        variant={variationCount === 1 ? "default" : "ghost"}
                        className="h-7 px-3 text-xs"
                        onClick={() => setVariationCount(1)}
                      >
                        1 Option
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={variationCount === 3 ? "default" : "ghost"}
                        className="h-7 px-3 text-xs"
                        onClick={() => {
                          setVariationCount(3);
                          setEnableStreaming(false); // multi-variation uses structured batching
                        }}
                      >
                        3 Variations
                      </Button>
                    </div>
                  </div>

                  {variationCount === 1 && (
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="stream-toggle" className="text-sm font-medium">
                          Real-Time Streaming
                        </Label>
                        <p className="text-xs text-muted-foreground">Stream words as they generate</p>
                      </div>
                      <Switch
                        id="stream-toggle"
                        checked={enableStreaming}
                        onCheckedChange={setEnableStreaming}
                      />
                    </div>
                  )}
                </div>

                {/* Generation Quota Tracker */}
                {quota && (
                  <div className="p-3 rounded-lg border border-border/70 bg-secondary/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        {quota.hasCustomKey ? "Unlimited Generations" : "Free Plan Quota"}
                      </span>
                      {quota.hasCustomKey ? (
                        <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 px-2 py-0">
                          Custom Key Active
                        </Badge>
                      ) : (
                        <span
                          className={`text-[11px] font-semibold ${
                            quota.remaining === 0 ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {quota.generationsUsed} / {quota.freeGenerationLimit} used ({quota.remaining} left)
                        </span>
                      )}
                    </div>

                    {!quota.hasCustomKey && (
                      <>
                        <Progress
                          value={Math.min(100, (quota.generationsUsed / quota.freeGenerationLimit) * 100)}
                          className={`h-1.5 ${quota.remaining === 0 ? "[&>div]:bg-destructive" : ""}`}
                        />
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                          <span>
                            {quota.remaining > 0
                              ? "1 credit per run (multi-variation included)"
                              : "15 free generations used"}
                          </span>
                          <button
                            type="button"
                            onClick={() => navigate("/settings")}
                            className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                          >
                            Add Key
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleGenerate}
                  className={`w-full gap-2 font-semibold shadow-sm ${
                    quota && !quota.hasCustomKey && quota.remaining <= 0
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : ""
                  }`}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      Generating with AI...
                    </>
                  ) : quota && !quota.hasCustomKey && quota.remaining <= 0 ? (
                    <>
                      <Key className="w-4 h-4" />
                      Limit Reached • Add Key to Generate
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate {variationCount > 1 ? "3 Variations" : "Content"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Editor & Output Column */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="border-border/60 shadow-sm flex flex-col min-h-[580px]">
              <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl">Generated Output</CardTitle>
                  {/* Variation Tabs */}
                  {variations.length > 1 && (
                    <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-md text-xs">
                      {variations.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectVariation(i)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                            activeVariationIndex === i
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Option {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Edit / Preview Toggle */}
                {generatedContent && (
                  <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg">
                    <Button
                      size="sm"
                      variant={viewMode === "edit" ? "default" : "ghost"}
                      className="h-7 px-3 text-xs gap-1.5"
                      onClick={() => setViewMode("edit")}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === "preview" ? "default" : "ghost"}
                      className="h-7 px-3 text-xs gap-1.5"
                      onClick={() => setViewMode("preview")}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </Button>
                  </div>
                )}
              </CardHeader>

              <CardContent className="flex-1 p-5 space-y-4 flex flex-col">
                {generatedContent || isGenerating ? (
                  <>
                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col">
                      {viewMode === "edit" ? (
                        <Textarea
                          value={generatedContent}
                          onChange={(e) => handleContentChange(e.target.value)}
                          placeholder="Your generated content will appear here..."
                          className="flex-1 min-h-[380px] p-4 font-sans text-sm leading-relaxed resize-y focus-visible:ring-primary/40"
                        />
                      ) : (
                        <div className="flex-1 min-h-[380px] p-5 rounded-md border border-input bg-background/50 overflow-auto prose prose-neutral dark:prose-invert max-w-none text-sm leading-relaxed [&>p]:mb-4 [&>h1]:mb-3 [&>h2]:mb-2 [&>h3]:mb-2 [&>ul]:mb-4 [&>ol]:mb-4 [&>li]:mb-1">
                          <ReactMarkdown remarkPlugins={[remarkBreaks]}>{generatedContent}</ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {/* Word and Character Meter */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-2 border-t border-border/40">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-foreground">{charCount} characters</span>
                        <span>•</span>
                        <span>{wordCount} words</span>
                        <span>•</span>
                        <span>~{readTimeMinutes} min read</span>
                      </div>

                      {/* LinkedIn Constraints Indicator */}
                      {contentType === "LinkedIn" && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px]">
                            LinkedIn: {charCount}/3,000 chars
                          </span>
                          <div className="w-20">
                            <Progress
                              value={Math.min(100, (charCount / 3000) * 100)}
                              className={`h-1.5 ${
                                charCount > 3000
                                  ? "bg-destructive"
                                  : charCount >= 1200 && charCount <= 2000
                                  ? "bg-green-500"
                                  : "bg-primary"
                              }`}
                            />
                          </div>
                          {charCount > 3000 && (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                              Exceeds 3k limit
                            </Badge>
                          )}
                          {charCount >= 1200 && charCount <= 2000 && (
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                              Optimal length
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick AI Polish Toolbar */}
                    <div className="p-3 bg-secondary/30 rounded-lg border border-border/40 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <Wand2 className="w-3.5 h-3.5 text-primary" />
                        <span>Quick AI Polish:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 bg-background"
                          disabled={!!isRefining || isGenerating}
                          onClick={() => handleRefine("shorten")}
                        >
                          <Scissors className="w-3 h-3" />
                          {isRefining === "shorten" ? "Shortening..." : "Shorten"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 bg-background"
                          disabled={!!isRefining || isGenerating}
                          onClick={() => handleRefine("expand")}
                        >
                          <Maximize2 className="w-3 h-3" />
                          {isRefining === "expand" ? "Expanding..." : "Expand"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 bg-background"
                          disabled={!!isRefining || isGenerating}
                          onClick={() => handleRefine("emojis")}
                        >
                          <Smile className="w-3 h-3" />
                          {isRefining === "emojis" ? "Adding..." : "Add Emojis"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 bg-background"
                          disabled={!!isRefining || isGenerating}
                          onClick={() => handleRefine("fix_grammar")}
                        >
                          <Check className="w-3 h-3 text-green-500" />
                          {isRefining === "fix_grammar" ? "Fixing..." : "Fix Grammar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 bg-background"
                          disabled={!!isRefining || isGenerating}
                          onClick={() => handleRefine("hashtags")}
                        >
                          <Hash className="w-3 h-3 text-sky-500" />
                          {isRefining === "hashtags" ? "Suggesting..." : "# Suggest Hashtags"}
                        </Button>
                      </div>
                    </div>

                    {/* Main Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={handleRegenerate}
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={isGenerating}
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          Regenerate
                        </Button>

                        <Button
                          onClick={handleCopy}
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5">
                              <Download className="w-3.5 h-3.5" />
                              Export
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => handleDownload("md")}>
                              Download as Markdown (.md)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload("txt")}>
                              Download as Text (.txt)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleCopyRichText}>
                              Copy Rich Text
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                          onClick={handleSave}
                          size="sm"
                          className="gap-1.5"
                          disabled={!canSave}
                        >
                          <Save className="w-3.5 h-3.5" />
                          Save
                        </Button>
                      </div>

                      {/* LinkedIn Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {contentType === "LinkedIn" && (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => setIsLinkedInModalOpen(true)}
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 border-[#0077B5] text-[#0077B5] hover:bg-[#0077B5] hover:text-white hover:border-[#0077B5] transition-all font-medium"
                                >
                                  <Linkedin className="w-3.5 h-3.5 fill-current" />
                                  <span>Feed Mockup</span>
                                  <Info className="w-3.5 h-3.5 opacity-70 ml-0.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs p-3 space-y-1 bg-card text-card-foreground border-border/80 shadow-lg">
                                <p className="font-semibold text-foreground flex items-center gap-1.5">
                                  <Linkedin className="w-3.5 h-3.5 text-[#0077B5] fill-current" />
                                  Realistic LinkedIn Feed Mockup
                                </p>
                                <p className="text-muted-foreground leading-relaxed">
                                  Preview exactly how your post will render on the LinkedIn feed before publishing, including the <strong>&apos;...see more&apos;</strong> fold, your profile avatar, and simulated reactions.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {linkedInConnected ? (
                          <Button
                            onClick={() => setIsLinkedInModalOpen(true)}
                            size="sm"
                            className="gap-1.5 bg-[#0077B5] hover:bg-[#006097] text-white shadow-sm"
                            disabled={isPostingToLinkedIn}
                          >
                            <Linkedin className="w-4 h-4 fill-current" />
                            Post to LinkedIn
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setIsConnectModalOpen(true)}
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-[#0077B5] text-[#0077B5] hover:bg-[#0077B5] hover:text-white hover:border-[#0077B5] transition-all"
                          >
                            <Linkedin className="w-4 h-4" />
                            Connect LinkedIn
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 min-h-[380px] flex items-center justify-center border-2 border-dashed rounded-lg border-border/70">
                    <div className="text-center p-8 max-w-sm">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">Ready to create</h3>
                      <p className="text-muted-foreground text-sm">
                        Enter your topic and desired tone, then click Generate to create tailored content in seconds.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* LinkedIn Post Preview Modal */}
      <Dialog open={isLinkedInModalOpen} onOpenChange={setIsLinkedInModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Linkedin className="w-5 h-5 text-[#0077B5] fill-current" />
              Preview LinkedIn Post
            </DialogTitle>
            <DialogDescription>
              Review how your post will look on your personal LinkedIn feed before publishing.
            </DialogDescription>
          </DialogHeader>

          {/* LinkedIn Realistic Feed Mockup Card */}
          <div className="border rounded-xl bg-card shadow-sm overflow-hidden text-card-foreground">
            {/* Header */}
            <div className="p-4 pb-3 flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#0077B5] to-blue-400 flex items-center justify-center font-bold text-white text-base shadow-sm shrink-0">
                {(linkedInProfileName || localStorage.getItem("userName") || "U").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm leading-tight truncate">
                    {linkedInProfileName || localStorage.getItem("userName") || "Your LinkedIn Profile"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  Creator & Professional • VibeCraft Creator
                </p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <span>Just now</span>
                  <span>•</span>
                  <span>🌐 Public</span>
                </p>
              </div>
            </div>

            {/* Post Content with realistic '...see more' fold */}
            <div className="px-4 py-2 font-sans text-sm leading-relaxed whitespace-pre-wrap select-text max-h-72 overflow-y-auto">
              {!isFeedFoldExpanded && generatedContent.length > 220 ? (
                <>
                  <span>{generatedContent.slice(0, 210)}</span>
                  <span>... </span>
                  <button
                    type="button"
                    onClick={() => setIsFeedFoldExpanded(true)}
                    className="font-semibold text-[#0077B5] hover:underline cursor-pointer"
                  >
                    see more
                  </button>
                </>
              ) : (
                <>
                  <span>{generatedContent}</span>
                  {generatedContent.length > 220 && (
                    <button
                      type="button"
                      onClick={() => setIsFeedFoldExpanded(false)}
                      className="block text-xs font-semibold text-[#0077B5] hover:underline mt-2 cursor-pointer"
                    >
                      see less
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Simulated Engagement Counts */}
            <div className="px-4 py-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground bg-secondary/10">
              <span className="flex items-center gap-1.5">
                <span className="flex -space-x-1">
                  <span className="w-4 h-4 rounded-full bg-blue-500 text-[9px] text-white flex items-center justify-center">👍</span>
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-[9px] text-white flex items-center justify-center">💡</span>
                </span>
                <span className="ml-0.5">You and 48 others</span>
              </span>
              <span>14 comments</span>
            </div>

            {/* Simulated Action Bar */}
            <div className="px-2 py-1.5 border-t border-border/40 grid grid-cols-4 gap-1 text-xs text-muted-foreground font-medium bg-card">
              <div className="flex items-center justify-center gap-1.5 py-1.5 rounded hover:bg-secondary/50 cursor-pointer transition-colors">
                <ThumbsUp className="w-4 h-4" />
                <span>Like</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 py-1.5 rounded hover:bg-secondary/50 cursor-pointer transition-colors">
                <MessageSquare className="w-4 h-4" />
                <span>Comment</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 py-1.5 rounded hover:bg-secondary/50 cursor-pointer transition-colors">
                <Repeat2 className="w-4 h-4" />
                <span>Repost</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 py-1.5 rounded hover:bg-secondary/50 cursor-pointer transition-colors">
                <Send className="w-4 h-4" />
                <span>Send</span>
              </div>
            </div>

            {/* Character indicator & Status */}
            <div className="px-4 py-2 bg-secondary/20 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
              <span>{charCount} / 3,000 characters</span>
              {charCount > 3000 ? (
                <span className="text-destructive font-medium">Post exceeds LinkedIn limit!</span>
              ) : (
                <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready to publish
                </span>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsLinkedInModalOpen(false)}
              disabled={isPostingToLinkedIn}
            >
              Cancel
            </Button>
            {linkedInConnected ? (
              <Button
                onClick={handleConfirmPostToLinkedIn}
                className="bg-[#0077B5] hover:bg-[#006097] text-white gap-2"
                disabled={isPostingToLinkedIn || charCount > 3000 || !generatedContent.trim()}
              >
                {isPostingToLinkedIn ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Publishing to LinkedIn...
                  </>
                ) : (
                  <>
                    <Linkedin className="w-4 h-4 fill-current" />
                    Confirm & Publish
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setIsLinkedInModalOpen(false);
                  setIsConnectModalOpen(true);
                }}
                className="bg-[#0077B5] hover:bg-[#006097] text-white gap-2"
              >
                <Linkedin className="w-4 h-4 fill-current" />
                Connect LinkedIn to Publish
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LinkedIn Connect Modal */}
      <Dialog open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Linkedin className="w-5 h-5 text-[#0077B5] fill-current" />
              Connect LinkedIn Account
            </DialogTitle>
            <DialogDescription>
              To publish posts directly from VibeCraft, connect your LinkedIn account with one click.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>Publish directly to your LinkedIn feed without leaving VibeCraft.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>Your current generated draft is automatically saved and restored.</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsConnectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInitiateLinkedInConnect}
              className="bg-[#0077B5] hover:bg-[#006097] text-white gap-2"
            >
              <Linkedin className="w-4 h-4 fill-current" />
              Connect with LinkedIn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quota Limit Reached Modal */}
      <Dialog open={isQuotaModalOpen} onOpenChange={setIsQuotaModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-2">
              <Key className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl">Free Generation Limit Reached</DialogTitle>
            <DialogDescription className="text-sm pt-1">
              You have completed all 15 free generations. To continue generating unlimited AI content, simply add your own OpenAI API key in Settings.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3 text-sm">
            <div className="p-3.5 rounded-lg bg-secondary/50 border border-border/60 space-y-2">
              <p className="font-medium text-xs text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Why Bring Your Own Key (BYOK)?
              </p>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                <li><strong>Unlimited Generations:</strong> Create as many posts and variations as you need without limits.</li>
                <li><strong>Private & Secure:</strong> Saved directly in your profile and used solely for your requests.</li>
                <li><strong>Direct Pricing:</strong> No platform markup; pay standard OpenAI API usage fees directly.</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsQuotaModalOpen(false)}>
              Maybe Later
            </Button>
            <Button
              onClick={() => {
                setIsQuotaModalOpen(false);
                navigate("/settings");
              }}
              className="gap-2"
            >
              <Key className="w-4 h-4" />
              Go to Settings & Add Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Generate;
