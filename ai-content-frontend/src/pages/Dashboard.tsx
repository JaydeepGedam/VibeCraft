import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  Copy,
  RotateCw,
  Eye,
  Plus,
  Trash2,
  Search,
  Star,
  Download,
  Filter,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
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
  isFavorite?: boolean;
  isPublished?: boolean;
  publishedPlatform?: string;
  audience?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const userName = localStorage.getItem("userName") || "Creator";
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [publishedOnly, setPublishedOnly] = useState(false);

  const from = location.state?.from;
  const welcomeMessage = from === "signup" ? `Welcome, ${userName}!` : `Welcome Back, ${userName}!`;

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
      toast.error("Failed to load content library");
      setContents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleToggleFavorite = async (id: string) => {
    // Optimistic UI update
    setContents((prev) =>
      prev.map((c) => (c._id === id ? { ...c, isFavorite: !c.isFavorite } : c))
    );
    try {
      await contentAPI.toggleFavorite(id);
    } catch (err) {
      // Revert if error
      setContents((prev) =>
        prev.map((c) => (c._id === id ? { ...c, isFavorite: !c.isFavorite } : c))
      );
      toast.error("Failed to update favorite status");
    }
  };

  const handleDownload = (content: Content, format: "md" | "txt") => {
    const filename = `${content.topic ? content.topic.replace(/[^a-z0-9]/gi, "_").toLowerCase() : "vibecraft_content"}.${format}`;
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

  const handleDelete = async (id: string) => {
    try {
      await contentAPI.delete(id);
      toast.success("Content deleted");
      loadContents();
    } catch (err) {
      toast.error("Failed to delete content");
    }
  };

  const handleView = (content: Content) => {
    navigate(`/content/${content._id}`);
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
    });
  };

  // Filtered contents
  const filteredContents = useMemo(() => {
    return contents.filter((item) => {
      // Search filter
      const matchesSearch =
        !searchQuery.trim() ||
        (item.topic || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.generatedText || "").toLowerCase().includes(searchQuery.toLowerCase());

      // Type filter
      const matchesType =
        typeFilter === "all" ||
        (item.contentType || "").toLowerCase() === typeFilter.toLowerCase();

      // Favorite filter
      const matchesFavorite = !favoriteOnly || !!item.isFavorite;

      // Published filter
      const matchesPublished = !publishedOnly || !!item.isPublished;

      return matchesSearch && matchesType && matchesFavorite && matchesPublished;
    });
  }, [contents, searchQuery, typeFilter, favoriteOnly, publishedOnly]);

  return (
    <Layout showNav>
      <div className="max-w-7xl mx-auto animate-fade-in space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-1">{welcomeMessage}</h1>
            <p className="text-muted-foreground text-lg">
              Manage, search, and export your AI-generated library.
            </p>
          </div>
          <Button onClick={() => navigate("/generate")} className="gap-2 shadow-sm self-start md:self-auto">
            <Plus className="w-4 h-4" />
            Create New Content
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by topic title or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/60"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-40">
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
              variant={favoriteOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setFavoriteOnly(!favoriteOnly)}
              className="gap-1.5 h-10 px-3.5"
            >
              <Star className={`w-4 h-4 ${favoriteOnly ? "fill-current text-amber-400" : ""}`} />
              Starred
            </Button>

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

        {/* Content Grid */}
        {loading ? (
          <div className="text-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading your library...</p>
          </div>
        ) : contents.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/60" />
              <h3 className="text-xl font-semibold mb-2">No content generated yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Generate high-converting marketing copy, social media posts, and articles in seconds.
              </p>
              <Button onClick={() => navigate("/generate")} className="gap-2">
                <Sparkles className="w-4 h-4" />
                Generate Your First Content
              </Button>
            </CardContent>
          </Card>
        ) : filteredContents.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-xl border-dashed">
            <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-1">No matching content found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Try adjusting your search query or format filter.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setTypeFilter("all");
                setFavoriteOnly(false);
                setPublishedOnly(false);
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContents.map((content) => {
              const charCount = content.generatedText ? content.generatedText.length : 0;
              const wordCount = content.generatedText ? content.generatedText.trim().split(/\s+/).length : 0;

              return (
                <Card
                  key={content._id}
                  className="hover:shadow-md transition-all border-border/60 flex flex-col justify-between group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {content.contentType && (
                            <Badge
                              className={`text-[11px] font-medium ${
                                content.contentType.toLowerCase() === "linkedin"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200"
                                  : "bg-secondary text-secondary-foreground"
                              }`}
                            >
                              {content.contentType}
                            </Badge>
                          )}
                          {content.isPublished && (
                            <Badge
                              className="text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 flex items-center gap-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Published to {content.publishedPlatform || "LinkedIn"}
                            </Badge>
                          )}
                          {content.tone && (
                            <Badge variant="outline" className="text-[11px]">
                              {content.tone}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg font-bold truncate group-hover:text-primary transition-colors">
                          {content.topic || "Untitled Content"}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {formatDate(content.createdAt)} • {wordCount} words
                        </CardDescription>
                      </div>

                      {/* Favorite & Delete Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-500"
                          onClick={() => handleToggleFavorite(content._id)}
                          aria-label="Toggle favorite"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              content.isFavorite
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              aria-label="Delete content"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this content?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove "{content.topic}" from your dashboard library.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(content._id)}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-1">
                    <p className="text-muted-foreground text-sm line-clamp-4 leading-relaxed font-sans bg-secondary/10 p-3 rounded-md border border-border/30">
                      {content.generatedText}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleView(content)}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRegenerate(content)}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          Tune
                        </Button>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(content.generatedText)}
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
                            <DropdownMenuItem onClick={() => handleDownload(content, "md")}>
                              Download Markdown (.md)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(content, "txt")}>
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

export default Dashboard;
