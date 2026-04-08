import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createMyDonation, fetchImpactStats, fetchMyDonations } from '@/lib/api-endpoints';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/StatCard';
import { PublicNavbar } from '@/components/PublicNavbar';
import { SiteFooter } from '@/components/SiteFooter';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, DollarSign, Clock, Package, Megaphone } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function DonorPortal() {
  const TO_PHP_RATE: Record<'PHP' | 'USD' | 'EUR', number> = {
    PHP: 1,
    USD: 56,
    EUR: 61,
  };
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const donationsQ = useQuery({ queryKey: ['my-donations'], queryFn: fetchMyDonations });
  const impactQ = useQuery({ queryKey: ['impact'], queryFn: fetchImpactStats });
  const [amount, setAmount] = useState('1000');
  const [donationType, setDonationType] = useState<'monetary' | 'time' | 'in-kind' | 'skills' | 'social-media'>('monetary');
  const [inputCurrency, setInputCurrency] = useState<'PHP' | 'USD' | 'EUR'>('PHP');
  const [donationDate, setDonationDate] = useState(new Date().toISOString().slice(0, 10));
  const [campaignName, setCampaignName] = useState('');
  const [notes, setNotes] = useState('');

  const createDonationMutation = useMutation({
    mutationFn: () => {
      const trimmedNotes = notes.trim() || undefined;
      const trimmedCampaign = campaignName.trim() || 'Donor Portal';
      const numericAmount = Number(amount);
      const phpValue = numericAmount * TO_PHP_RATE[inputCurrency];

      switch (donationType) {
        case 'time':
          return createMyDonation({
            donationType: 'Time',
            donationDate,
            estimatedValue: Number(amount),
            notes: trimmedNotes,
            campaignName: trimmedCampaign,
          });
        case 'in-kind':
          return createMyDonation({
            donationType: 'InKind',
            donationDate,
            estimatedValue: phpValue,
            currencyCode: 'PHP',
            notes: trimmedNotes,
            campaignName: trimmedCampaign,
          });
        case 'skills':
          return createMyDonation({
            donationType: 'Skills',
            donationDate,
            estimatedValue: phpValue,
            currencyCode: 'PHP',
            notes: trimmedNotes,
            campaignName: trimmedCampaign,
          });
        case 'social-media':
          return createMyDonation({
            donationType: 'SocialMedia',
            donationDate,
            estimatedValue: phpValue,
            currencyCode: 'PHP',
            notes: trimmedNotes,
            campaignName: trimmedCampaign,
          });
        case 'monetary':
        default:
          return createMyDonation({
            donationType: 'Monetary',
            donationDate,
            amount: phpValue,
            currencyCode: 'PHP',
            notes: trimmedNotes,
            campaignName: trimmedCampaign,
          });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-donations'] }),
        queryClient.invalidateQueries({ queryKey: ['impact'] }),
      ]);
      setNotes('');
      setCampaignName('');
      setAmount(donationType === 'monetary' ? '1000' : '2');
      toast({ title: 'Donation recorded', description: 'Your donation was saved and added to your giving history.' });
    },
    onError: () => {
      toast({ title: 'Donation failed', description: 'Unable to record donation right now.', variant: 'destructive' });
    },
  });

  const myDonations = useMemo(
    () =>
      [...(donationsQ.data ?? [])].sort((a, b) => {
        const dateCompare = (b.date || '').localeCompare(a.date || '');
        if (dateCompare !== 0) return dateCompare;
        return Number(b.id) - Number(a.id);
      }),
    [donationsQ.data],
  );

  const totalGiven = myDonations
    .filter(d => d.type === 'monetary')
    .reduce((s, d) => s + (d.amount || 0), 0);
  const totalHours = myDonations
    .filter(d => d.type === 'time')
    .reduce((s, d) => s + (d.hours || 0), 0);
  const inKindEstimated = myDonations
    .filter(d => d.type === 'in-kind')
    .reduce((s, d) => s + (d.amount || 0), 0);
  const socialCampaigns = myDonations.filter(d => d.type === 'social-media').length;
  const formattedTotalGiven = totalGiven.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedHours = totalHours.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const formattedInKind = inKindEstimated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const byType = useMemo(() => {
    const groups: Record<string, number> = {
      monetary: 0,
      'in-kind': 0,
      time: 0,
      skills: 0,
      'social-media': 0,
    };
    for (const d of myDonations) groups[d.type] = (groups[d.type] ?? 0) + 1;
    return groups;
  }, [myDonations]);
  const impact = impactQ.data;

  const loading = donationsQ.isLoading || impactQ.isLoading;

  const amountLabel = donationType === 'monetary'
    ? `Amount (${inputCurrency})`
    : donationType === 'time'
      ? 'Hours'
      : `Estimated Value (${inputCurrency})`;
  const notesPlaceholder = donationType === 'in-kind'
    ? 'Example: 20 hygiene kits, school supplies, blankets...'
    : donationType === 'skills'
      ? 'Example: legal consult, tutoring, counseling support...'
      : donationType === 'social-media'
        ? 'Example: posted survivor-safe awareness campaign on Instagram...'
        : donationType === 'time'
          ? 'Example: Saturday mentoring shift at safehouse...'
          : 'Any note for this donation...';

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
                <StatCard title="Total Given" value={`₱${formattedTotalGiven}`} icon={<DollarSign className="h-6 w-6" />} />
                <StatCard title="Donations Made" value={myDonations.length} icon={<Heart className="h-6 w-6" />} />
                <StatCard title="Volunteer Hours" value={formattedHours} icon={<Clock className="h-6 w-6" />} />
                <StatCard title="In-Kind Value" value={`₱${formattedInKind}`} icon={<Package className="h-6 w-6" />} />
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Your Contribution Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-24 w-full" /> : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xl font-bold text-primary">{byType.monetary}</p><p className="text-xs text-muted-foreground">Monetary</p></div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xl font-bold text-primary">{byType['in-kind']}</p><p className="text-xs text-muted-foreground">In-kind</p></div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xl font-bold text-primary">{byType.time}</p><p className="text-xs text-muted-foreground">Time</p></div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xl font-bold text-primary">{byType.skills}</p><p className="text-xs text-muted-foreground">Skills</p></div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xl font-bold text-primary">{byType['social-media']}</p><p className="text-xs text-muted-foreground">Social Media</p></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Make a Donation (Simulation)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Donation Type</Label>
                  <Select
                    value={donationType}
                    onValueChange={(v: 'monetary' | 'time' | 'in-kind' | 'skills' | 'social-media') => {
                      setDonationType(v);
                      setAmount(v === 'monetary' ? '1000' : '2');
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monetary">Monetary</SelectItem>
                      <SelectItem value="time">Time</SelectItem>
                      <SelectItem value="in-kind">In-Kind</SelectItem>
                      <SelectItem value="skills">Skills</SelectItem>
                      <SelectItem value="social-media">Social Media</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="donation-amount">{amountLabel}</Label>
                  <Input id="donation-amount" type="number" min="0.25" step="0.25" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                {donationType !== 'time' && (
                  <div>
                    <Label>Input Currency</Label>
                    <Select value={inputCurrency} onValueChange={(v: 'PHP' | 'USD' | 'EUR') => setInputCurrency(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PHP">PHP</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor="donation-date">Donation Date</Label>
                  <Input id="donation-date" type="date" value={donationDate} onChange={(e) => setDonationDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="donation-campaign">Campaign / Source (optional)</Label>
                  <Input id="donation-campaign" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex: Spring Outreach Campaign" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="donation-notes">Notes (optional)</Label>
                  <Textarea id="donation-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={notesPlaceholder} />
                </div>
              </div>
              <div className="mt-4">
                <Button
                  onClick={() => createDonationMutation.mutate()}
                  disabled={createDonationMutation.isPending || !Number(amount) || Number(amount) <= 0 || !donationDate}
                >
                  {createDonationMutation.isPending ? 'Recording...' : 'Submit Donation'}
                </Button>
              </div>
            </CardContent>
          </Card>

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
                        {d.campaignName && <p className="text-xs text-muted-foreground mt-1">Campaign: {d.campaignName}</p>}
                        {d.notes && <p className="text-xs text-muted-foreground mt-1">{d.notes}</p>}
                      </div>
                      <span className="font-semibold text-primary">
                        {d.type === 'time'
                          ? `${(d.hours ?? d.amount ?? 0).toLocaleString()} hrs`
                          : d.type === 'social-media'
                            ? 'Social campaign'
                            : d.type === 'skills'
                              ? d.skillDescription || 'Skills contribution'
                              : d.type === 'in-kind'
                                ? d.itemDetails || `₱${(d.amount ?? 0).toLocaleString()}`
                          : d.amount != null
                            ? `${d.currency === 'USD' ? '$' : '₱'}${d.amount.toLocaleString()}`
                            : d.type}
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
              <CardTitle className="font-display text-lg">Your Impact + Program Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Your personal activity plus anonymized organization-wide outcomes.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <p className="text-2xl font-display font-bold text-primary">{socialCampaigns}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Megaphone className="h-3 w-3" /> Social campaigns supported</p>
                </div>
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
      <SiteFooter />
      <CookieConsentBanner />
    </div>
  );
}
