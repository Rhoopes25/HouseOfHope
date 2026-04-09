import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { PostOptimizer } from '@/components/PostOptimizer';

export default function SocialMediaAnalytics() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold text-foreground">Social Media Analytics</h1>

      <Card className="border-2 border-primary bg-primary/5">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-display font-semibold">Best Post Strategy</h2>
          </CardTitle>
          <p className="text-sm text-foreground/70">
            Our AI analyzed 26,000+ combinations to find the highest-performing post
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4" role="list" aria-label="Best post strategy details">
            {[
              { label: "Platform", value: "YouTube" },
              { label: "Post Type", value: "Fundraising Appeal" },
              { label: "Media Type", value: "Reel" },
              { label: "Best Day", value: "Thursday" },
              { label: "Best Time", value: "8:00 PM" },
              { label: "Topic", value: "Awareness Raising" },
              { label: "Tone", value: "Celebratory" },
              { label: "Predicted Value", value: "₱298,927" },
            ].map((item) => (
              <div key={item.label} className="bg-card rounded-lg p-3 text-center border" role="listitem">
                <p className="text-xs text-foreground/70">{item.label}</p>
                <p className="font-semibold text-sm text-foreground mt-1">{item.value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-foreground/70">
            Based on historical post performance data. Results are predictions, not guarantees.
          </p>
        </CardContent>
      </Card>

      <PostOptimizer />
    </div>
  );
}