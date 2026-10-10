import { useEffect, useState, useMemo } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Copy, RotateCw, Trash2, Eye, Search, Download, History as HistoryIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { contentAPI } from "@/services/api";

interface Content {
  _id: string;
  originalId?: string | null;
  topic: string;
  contentType: string;
  goal: string;
  tone: string;
  generatedText: string;
  createdAt: string;
  isPublished?: boolean;
  publishedPlatform?: string;
  audience?: string;
}

const History = () => {
  const navigate = useNavigate();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const [history, setHistory] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [publishedOnly, setPublishedOnly] = useState(false);

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
      const res = await contentAPI.historyList();
      if (Array.isArray(res)) {
        const mapped = res.map((item: any) => ({
          _id: item._id,
          originalId: item.original_content_id || item.original_content || item.original_contentId || null,
          topic: item.topic || item.name || "",
          contentType: item.type || item.contentType || "",
          goal: item.goal || "",
          tone: item.tone || "",
          generatedText: item.content || item.generatedText || "",
          createdAt: item.createdAt || item.created_at || item.created || "",
          isPublished: !!item.is_published,
          publishedPlatform: item.published_platform || "",
          audience: item.audience || "",
        }));
        setHistory(mapped || []);
      } else {
        setHistory([]);
      }
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

  const handleDownload = (item: Content, format: "md" | "txt") => {
    const filename = `${item.topic ? item.topic.replace(/[^a-z0-9]/gi, "_").toLowerCase() : "history_content"}.${format}`;
    const blob = new Blob([item.generatedText], {
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

  const handleDelete = async (id: string) => {
    try {
      await contentAPI.historyDelete(id);
      toast.success("Removed from history");
      loadHistory();
    } catch (err) {
      toast.error("Failed to remove from history");
    }
  };

  const handleView = (content: Content) => {
    const targetId = content.originalId || content._id;
    navigate(`/content/${targetId}`);
  };

  const handleRegenerate = (content: Content) => {
    navigate("/generate", { state: { regenerate: content } });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "Recently";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch =
        !searchQuery.trim() ||
        (item.topic || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.generatedText || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        typeFilter === "all" ||
        (item.contentType || "").toLowerCase() === typeFilter.toLowerCase();

      const matchesPublished = !publishedOnly || !!item.isPublished;

      return matchesSearch && matchesType && matchesPublished;
    });
  }, [history, searchQuery, typeFilter, publishedOnly]);

  return (
    <Layout showNav>
      <div className="max-w-7xl mx-auto animate-fade-in space-y-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Generation History</h1>
          <p className="text-muted-foreground text-lg">
            A chronological timeline of all AI-generated drafts and past sessions.
          </p>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search history by topic or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/60"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-44">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-background/60">
                  <SelectValue placeholder="All Formats" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Formats</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="blog">Blog</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="twitter">Twitter / X</SelectItem>
                  <SelectItem value="email">Cold Email</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant={publishedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setPublishedOnly(!publishedOnly)}
              className="gap-1.5 h-10 px-3.5"
            >
              <CheckCircle2 className={`w-4 h-4 ${publishedOnly ? "text-emerald-400" : ""}`} />
              Published
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading generation history...</p>
          </div>
        ) : history.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center">
              <HistoryIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground/60" />
              <h3 className="text-xl font-semibold mb-2">No history records found</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Items you generate will automatically be archived here for reference.
              </p>
              <Button onClick={() => navigate("/generate")}>Generate Content</Button>
            </CardContent>
          </Card>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-xl border-dashed">
            <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-1">No matching history entries</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Try adjusting your search keywords or format filter.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setTypeFilter("all");
                setPublishedOnly(false);
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHistory.map((item) => {
              const wordCount = item.generatedText ? item.generatedText.trim().split(/\s+/).length : 0;

              return (
                <Card
                  key={item._id}
                  className="hover:shadow-md transition-all border-border/60 flex flex-col justify-between"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.contentType && (
                            <Badge
                              className={`text-[11px] font-medium ${
                                item.contentType.toLowerCase() === "linkedin"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200"
                                  : "bg-secondary text-secondary-foreground"
                              }`}
                            >
                              {item.contentType}
                            </Badge>
                          )}
                          {item.isPublished && (
                            <Badge
                              className="text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 flex items-center gap-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Published to {item.publishedPlatform || "LinkedIn"}
                            </Badge>
                          )}
                          {item.tone && (
                            <Badge variant="outline" className="text-[11px]">
                              {item.tone}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg font-bold truncate">
                          {item.topic || "Generated Draft"}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {formatDate(item.createdAt)} • {wordCount} words
                        </CardDescription>
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                            aria-label="Remove from history"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove from history?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove this generation from your history archive.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(item._id)}
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-1">
                    <p className="text-muted-foreground text-sm line-clamp-4 leading-relaxed font-sans bg-secondary/10 p-3 rounded-md border border-border/30">
                      {item.generatedText}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleView(item)}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRegenerate(item)}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          Regenerate
                        </Button>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(item.generatedText)}
                          className="h-8 w-8 p-0"
                          title="Copy text"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Export">
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownload(item, "md")}>
                              Download Markdown (.md)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(item, "txt")}>
                              Download Text (.txt)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default History;
