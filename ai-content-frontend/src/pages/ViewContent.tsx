import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, RotateCw, ArrowLeft, Linkedin } from "lucide-react";
import { toast } from "sonner";
import { contentAPI, linkedInAPI } from "@/services/api";

interface Content {
  _id: string;
  topic: string;
  contentType: string;
  goal: string;
  tone: string;
  generatedText: string;
  createdAt: string;
}

const ViewContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPostingToLinkedIn, setIsPostingToLinkedIn] = useState(false);
  const [linkedInConnected, setLinkedInConnected] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadContent(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // backend returns the object directly
      setContent({
        _id: data._id,
        topic: data.topic || "",
        contentType: data.type || data.contentType || "",
        goal: data.goal || "",
        tone: data.tone || "",
        generatedText: data.content || data.generatedText || "",
        createdAt: data.created_at || data.createdAt || data.created || "",
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

  const handleRegenerate = (content: Content) => {
    // Navigate to generate page with regenerate state
    navigate('/generate', { state: { regenerate: content } });
  };

  const handlePostToLinkedIn = async () => {
    if (!content || !content.generatedText) {
      toast.error("No content to post");
      return;
    }

    if (!linkedInConnected) {
      toast.error("Please connect your LinkedIn account in Settings first");
      return;
    }

    try {
      setIsPostingToLinkedIn(true);
      await linkedInAPI.post(content.generatedText);
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
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading content...</p>
          </div>
        ) : !content ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Content not found</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-1">{content.topic}</CardTitle>
                  <CardDescription className="text-sm">{new Date(content.createdAt).toLocaleString()}</CardDescription>
                </div>
                <div className="ml-2" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4 whitespace-pre-line">{content.generatedText}</p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => handleCopy(content.generatedText)} className="gap-2">
                  <Copy className="w-4 h-4" /> Copy
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleRegenerate(content)} className="gap-2">
                  <RotateCw className="w-4 h-4" /> Regenerate
                </Button>
                {linkedInConnected && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handlePostToLinkedIn} 
                    className="gap-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 border-blue-200 dark:border-blue-800"
                    disabled={isPostingToLinkedIn}
                  >
                    <Linkedin className="w-4 h-4" />
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
