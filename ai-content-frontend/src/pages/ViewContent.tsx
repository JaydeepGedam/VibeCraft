import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, RotateCw, ArrowLeft, Linkedin, Download, Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import { contentAPI, linkedInAPI } from "@/services/api";

interface Content {
  _id: string;
  topic: string;
  contentType: string;
  goal: string;
  tone: string;
  audience?: string;
  generatedText: string;
  createdAt: string;
  isPublished?: boolean;
  publishedPlatform?: string;
}

const ViewContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPostingToLinkedIn, setIsPostingToLinkedIn] = useState(false);
  const [linkedInConnected, setLinkedInConnected] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "raw">("preview");

  useEffect(() => {
    if (!id) return;
    loadContent(id);
  }, [id]);

  useEffect(() => {
    const checkLinkedInStatus = async () => {
      try {
        const status = await linkedInAPI.getStatus();
        setLinkedInConnected(status.isConnected);
      } catch (error) {
        // Silently fail
      }
    };
    checkLinkedInStatus();
  }, []);

  const loadContent = async (contentId: string) => {
    try {
      setLoading(true);
      const data = await contentAPI.get(contentId);
      setContent({
        _id: data._id,
        topic: data.topic || "",
        contentType: data.type || data.contentType || "",
        goal: data.goal || "",
        tone: data.tone || "",
        audience: data.audience || "",
        generatedText: data.content || data.generatedText || "",
        createdAt: data.created_at || data.createdAt || data.created || "",
        isPublished: !!data.is_published,
        publishedPlatform: data.published_platform || "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleDownload = (format: "md" | "txt") => {
    if (!content) return;
    const filename = `${content.topic ? content.topic.replace(/[^a-z0-9]/gi, "_").toLowerCase() : "content"}.${format}`;
    const blob = new Blob([content.generatedText], {
      type: format === "md" ? "text/markdown" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const handleRegenerate = (contentItem: Content) => {
    navigate("/generate", { state: { regenerate: contentItem } });
  };

  const handlePostToLinkedIn = async () => {
    if (!content || !content.generatedText) {
      toast.error("No content to post");
      return;
    }

    if (!linkedInConnected) {
      toast.error("Please connect your LinkedIn account first");
      return;
    }

    try {
      setIsPostingToLinkedIn(true);
      await linkedInAPI.post(content.generatedText);
      toast.success("Posted to LinkedIn successfully!");
      try {
        await contentAPI.markPublished(content._id, "LinkedIn");
        setContent((prev) => prev ? { ...prev, isPublished: true, publishedPlatform: "LinkedIn" } : null);
      } catch (pubErr) {
        // ignore
      }
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

  const wordCount = content?.generatedText ? content.generatedText.trim().split(/\s+/).length : 0;
  const charCount = content?.generatedText ? content.generatedText.length : 0;

  return (
    <Layout showNav>
      <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">Loading content details...</p>
          </div>
        ) : !content ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Content not found</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {content.contentType && (
                      <Badge className="bg-primary/10 text-primary border-primary/20">
                        {content.contentType}
                      </Badge>
                    )}
                    {content.isPublished && (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Published to {content.publishedPlatform || "LinkedIn"}
                      </Badge>
                    )}
                    {content.tone && <Badge variant="outline">{content.tone}</Badge>}
                    {content.goal && <Badge variant="outline">{content.goal}</Badge>}
                    {content.audience && <Badge variant="outline">Audience: {content.audience}</Badge>}
                  </div>
                  <CardTitle className="text-2xl font-bold tracking-tight">{content.topic}</CardTitle>
                  <CardDescription className="text-xs">
                    Created {new Date(content.createdAt).toLocaleString()} • {charCount} chars • {wordCount} words
                  </CardDescription>
                </div>

                <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg self-start md:self-auto">
                  <Button
                    size="sm"
                    variant={viewMode === "preview" ? "default" : "ghost"}
                    className="h-7 px-3 text-xs gap-1.5"
                    onClick={() => setViewMode("preview")}
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "raw" ? "default" : "ghost"}
                    className="h-7 px-3 text-xs gap-1.5"
                    onClick={() => setViewMode("raw")}
                  >
                    <FileText className="w-3.5 h-3.5" /> Plain Text
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {viewMode === "preview" ? (
                <div className="prose prose-neutral dark:prose-invert max-w-none min-h-[300px] p-5 bg-background/50 border rounded-lg overflow-auto text-sm leading-relaxed [&>p]:mb-4 [&>h1]:mb-3 [&>h2]:mb-2 [&>h3]:mb-2 [&>ul]:mb-4 [&>ol]:mb-4 [&>li]:mb-1">
                  <ReactMarkdown remarkPlugins={[remarkBreaks]}>{content.generatedText}</ReactMarkdown>
                </div>
              ) : (
                <div className="p-5 bg-secondary/20 border rounded-lg whitespace-pre-wrap font-mono text-sm leading-relaxed min-h-[300px]">
                  {content.generatedText}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => handleCopy(content.generatedText)} className="gap-1.5">
                    <Copy className="w-4 h-4" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRegenerate(content)} className="gap-1.5">
                    <RotateCw className="w-4 h-4" /> Open in Editor
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Download className="w-4 h-4" /> Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => handleDownload("md")}>
                        Download as Markdown (.md)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload("txt")}>
                        Download as Text (.txt)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {linkedInConnected && (
                  <Button
                    size="sm"
                    onClick={handlePostToLinkedIn}
                    className="gap-2 bg-[#0077B5] hover:bg-[#006097] text-white"
                    disabled={isPostingToLinkedIn}
                  >
                    <Linkedin className="w-4 h-4 fill-current" />
                    {isPostingToLinkedIn ? "Posting..." : "Post to LinkedIn"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default ViewContent;
