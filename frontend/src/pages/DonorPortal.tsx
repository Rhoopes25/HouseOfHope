import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchDonations, fetchImpactStats } from '@/lib/api-endpoints';
import { StatCard } from '@/components/StatCard';
import { PublicNavbar } from '@/components/PublicNavbar';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, DollarSign, Users, GraduationCap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DonorPortal() {
  const { user } = useAuth();
  const donationsQ = useQuery({ queryKey: ['donations'], queryFn: fetchDonations });
  const impactQ = useQuery({ queryKey: ['impact'], queryFn: fetchImpactStats });

  const myDonations = useMemo(() => {
    const all = donationsQ.data ?? [];
    if (!user?.displayName) return [];
    return all.filter(d => d.donorName === user.displayName);
  }, [donationsQ.data, user?.displayName]);

  const totalGiven = myDonations.filter(d => d.type === 'monetary').reduce((s, d) => s + (d.amount || 0), 0);
  const impact = impactQ.data;

  const loading = donationsQ.isLoading || impactQ.isLoading;

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />
      <main className="flex-1 gradient-warm py-8">
        <div className="container mx-auto px-4 space-y-8">
          <div className="bg-card rounded-xl border p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                <Heart className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-foreground">Welcome, {user?.displayName}!</h1>
                <p className="text-muted-foreground text-sm">Thank you for your generous support of House of Hope.</p>
              </div>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              Your donations are making a real difference in the lives of girls who are survivors of abuse and trafficking.
              Every contribution helps provide safe shelter, education, counseling, and hope for a brighter future.
              We are deeply grateful for your partnership in this mission.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
            ) : (
              <>
                <StatCard title="Total Given" value={`₱${totalGiven.toLocaleString()}`} icon={<DollarSign className="h-6 w-6" />} />
                <StatCard title="Donations Made" value={myDonations.length} icon={<Heart className="h-6 w-6" />} />
                <StatCard title="Residents (org-wide)" value={impact?.totalResidentsServed ?? 0} icon={<Users className="h-6 w-6" />} description="Anonymized aggregate" />
                <StatCard title="Education rate" value={`${impact?.educationEnrollmentRate ?? 0}%`} icon={<GraduationCap className="h-6 w-6" />} description="Program-wide" />
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Your Giving History</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-40 w-full" /> : (
                <div className="space-y-3">
                  {myDonations.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-sm">{d.date}</p>
                        <p className="text-xs text-muted-foreground capitalize">{d.type} donation</p>
                      </div>
                      <span className="font-semibold text-primary">
                        {d.amount != null ? `${d.currency === 'USD' ? '$' : '₱'}${d.amount.toLocaleString()}` : d.type}
                      </span>
                    </div>
                  ))}
                  {myDonations.length === 0 && (
                    <p className="text-sm text-muted-foreground">No donations found for your account name in the database. Sign in as donor (Mila Alvarez) to see sample data.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Your Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Anonymized aggregates from the Lighthouse dataset:</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <p className="text-2xl font-display font-bold text-primary">{impact?.totalResidentsServed ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Residents in program data</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <p className="text-2xl font-display font-bold text-primary">{impact?.educationEnrollmentRate ?? '—'}%</p>
                  <p className="text-xs text-muted-foreground">Education progress (avg)</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <p className="text-2xl font-display font-bold text-primary">{impact?.healthImprovementRate ?? '—'}%</p>
                  <p className="text-xs text-muted-foreground">Health score (normalized)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Supported Programs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Safe shelter network</Badge>
                <Badge variant="secondary">Education & tutoring</Badge>
                <Badge variant="secondary">Mental health services</Badge>
                <Badge variant="secondary">Life skills training</Badge>
                <Badge variant="secondary">Reintegration program</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <CookieConsentBanner />
    </div>
  );
}
