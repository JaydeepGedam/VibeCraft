import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Copy, RotateCw, Eye, Plus } from "lucide-react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { contentAPI } from "@/services/api";

interface Content {
  _id: string;
  topic: string;
  contentType: string;
  goal: string;
  tone: string;
  generatedText: string;
  createdAt: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const userName = localStorage.getItem("userName") || "User";
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    } else {
      loadContents();
    }
  }, [isAuthenticated, navigate]);

  const loadContents = async () => {
    try {
      setLoading(true);
      const response = await contentAPI.list();
      setContents(response.contents || []);
    } catch (error) {
      toast.error("Failed to load content");
      setContents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleDelete = async (id: string) => {
    // NOTE: kept for compatibility if needed elsewhere. This performs a permanent delete on the backend.
    try {
      await contentAPI.delete(id);
      toast.success("Content deleted");
      loadContents();
    } catch (err) {
      toast.error("Failed to delete content");
    }
  };

  // Remove a card only from the Dashboard UI without deleting it from the backend.
  // This lets users hide items from the Dashboard while keeping them in History.
  const handleRemoveFromDashboard = (id: string) => {
    setContents((prev) => prev.filter((c) => c._id !== id));
    toast.success("Removed from dashboard");
  };

  const handleView = (content: Content) => {
    navigate("/generate", { state: { viewContent: content } });
  };

  const handleRegenerate = (content: Content) => {
    navigate("/generate", { state: { regenerate: content } });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Layout showNav>
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Welcome back, {userName}!</h1>
          <p className="text-muted-foreground text-lg">
            Your AI-generated content library
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading your content...</p>
          </div>
        ) : contents.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No content yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start creating amazing AI-powered content
                </p>
                <Button onClick={() => navigate("/generate")}>
                  Generate Your First Content
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contents.map((content) => (
              <Card key={content._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {content.contentType ? (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">{content.contentType}</Badge>
                        ) : null}
                        {content.tone ? <Badge variant="outline">{content.tone}</Badge> : null}
                        {content.goal ? <Badge variant="outline">{content.goal}</Badge> : null}
                      </div>
                      <CardTitle className="text-xl mb-1">{content.topic}</CardTitle>
                      <CardDescription className="text-sm">{formatDate(content.createdAt)}</CardDescription>
                    </div>
                    <div className="ml-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive" aria-label="Delete content">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete content</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this content? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            {/* On Dashboard we only remove from the UI; permanent deletion is available in History. */}
                            <AlertDialogAction onClick={() => handleRemoveFromDashboard(content._id)}>Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Truncate long generated text in the card for a cleaner layout. Use the View button to see full text. */}
                  <p className="text-muted-foreground mb-4 line-clamp-6">{content.generatedText}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => handleView(content)} className="gap-2">
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRegenerate(content)} className="gap-2">
                      <RotateCw className="w-4 h-4" />
                      Regenerate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCopy(content.generatedText)} className="gap-2">
                      <Copy className="w-4 h-4" />
                      Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
