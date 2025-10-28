import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Target, Palette } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Content Creation</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-tight">
            Write Less, Express More
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Powered by AI. Transform your ideas into compelling content in seconds.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
            <Link to="/signup">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-lg px-8">
                Get Started
                <Sparkles className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8">
                Login
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow animate-slide-in">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
              <p className="text-muted-foreground">
                Generate high-quality content in seconds, not hours
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow animate-slide-in" style={{ animationDelay: "0.1s" }}>
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 mx-auto">
                <Target className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Goal-Oriented</h3>
              <p className="text-muted-foreground">
                Tailor content to educate, persuade, entertain, or sell
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow animate-slide-in" style={{ animationDelay: "0.2s" }}>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                <Palette className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Tone Perfect</h3>
              <p className="text-muted-foreground">
                Choose from formal, friendly, witty, or persuasive tones
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
