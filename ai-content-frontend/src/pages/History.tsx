import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { FileText, Copy, RotateCw, Trash2 } from "lucide-react";
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

const History = () => {
  const navigate = useNavigate();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const [history, setHistory] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) loadHistory();
  }, [isAuthenticated]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await contentAPI.list();
      setHistory(res.contents || []);
    } catch (err) {
      toast.error("Failed to load history");
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (content: string) => {
    if (!content) {
      toast.error("No content to copy");
      return;
    }
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard!");
  };

  const handleDelete = async (id: string) => {
    try {
      await contentAPI.delete(id);
      toast.success("Content deleted");
      // reload history
      loadHistory();
    } catch (err) {
      toast.error("Failed to delete content");
    }
  };

  const handleView = (content: Content) => {
    navigate("/generate", { state: { viewContent: content } });
  };

  const handleRegenerate = (content: Content) => {
    navigate("/generate", { state: { regenerate: content } });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return dateString;
    }
  };

  const typeColors: Record<string, string> = {
    Blog: "bg-blue-100 text-blue-800 border-blue-200",
    "LinkedIn Post": "bg-purple-100 text-purple-800 border-purple-200",
    "Product Description": "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <Layout showNav>
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Content History</h1>
          <p className="text-muted-foreground text-lg">
            View all your previously generated content
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading history...</p>
          </div>
        ) : history.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No history yet</h3>
              <p className="text-muted-foreground mb-6">
                Start generating content to build your history
              </p>
              <Button onClick={() => navigate("/generate")} className="gap-2">
                Generate Content
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {history.map((item, index) => (
              <Card
                key={item._id}
                className="hover:shadow-md transition-shadow animate-slide-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {item.contentType ? (
                          <Badge className={typeColors[item.contentType] || "bg-gray-100 text-gray-800"}>
                            {item.contentType}
                          </Badge>
                        ) : null}
                        {item.tone ? <Badge variant="outline">{item.tone}</Badge> : null}
                        {item.goal ? <Badge variant="outline">{item.goal}</Badge> : null}
                      </div>
                      <CardTitle className="text-xl mb-1">{item.topic}</CardTitle>
                      <CardDescription className="text-sm">
                        {formatDate(item.createdAt)}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4 line-clamp-2">{item.generatedText}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleCopy(item.generatedText)}
                    >
                      <Copy className="w-4 h-4" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleRegenerate(item)}
                    >
                      <RotateCw className="w-4 h-4" />
                      Regenerate
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" aria-label="Delete content">
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
                          <AlertDialogAction onClick={() => handleDelete(item._id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

export default History;
