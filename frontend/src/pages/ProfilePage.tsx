import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PublicNavbar } from '@/components/PublicNavbar';
import { SiteFooter } from '@/components/SiteFooter';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EditableSelect } from '@/components/EditableSelect';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyProfile, updateMyProfile } from '@/lib/authAPI';
import { mergeDistinctOptions } from '@/lib/residentFieldOptions';

const supporterTypeOptions = ['monetary', 'in-kind', 'volunteer', 'skills', 'social-media', 'partner'];
const countrySeeds = ['Philippines', 'United States', 'Canada', 'United Kingdom', 'Australia'];
const channelSeeds = ['Website', 'Facebook', 'Instagram', 'Church Network', 'Referral', 'Donor Portal'];

export default function ProfilePage() {
  const { refreshAuth, hasRole } = useAuth();
  const { toast } = useToast();
  const profileQ = useQuery({ queryKey: ['my-profile'], queryFn: fetchMyProfile });
  const profile = profileQ.data;

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [supporterType, setSupporterType] = useState('monetary');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [country, setCountry] = useState('');
  const [countryOther, setCountryOther] = useState('');
  const [acquisitionChannel, setAcquisitionChannel] = useState('');
  const [acquisitionChannelOther, setAcquisitionChannelOther] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || '');
    setEmail(profile.email || '');
    setSupporterType(profile.supporterType || 'monetary');
    setStatus(profile.status || 'active');
    setCountry(profile.country || '');
    setAcquisitionChannel(profile.acquisitionChannel || '');
    setCurrentPassword('');
    setNewPassword('');
  }, [profile]);

  const countryOptions = useMemo(() => mergeDistinctOptions([...(profile?.country ? [profile.country] : []), ...countrySeeds]), [profile?.country]);
  const channelOptions = useMemo(
    () => mergeDistinctOptions([...(profile?.acquisitionChannel ? [profile.acquisitionChannel] : []), ...channelSeeds]),
    [profile?.acquisitionChannel],
  );

  const saveProfileMutation = useMutation({
    mutationFn: () =>
      updateMyProfile({
        email: email.trim(),
        displayName: displayName.trim(),
        supporterType,
        status,
        country: country === 'other' ? countryOther.trim() : country.trim(),
        acquisitionChannel: acquisitionChannel === 'other' ? acquisitionChannelOther.trim() : acquisitionChannel.trim(),
        currentPassword: currentPassword.trim() || undefined,
        newPassword: newPassword.trim() || undefined,
      }),
    onSuccess: async () => {
      await Promise.all([profileQ.refetch(), refreshAuth()]);
      setCurrentPassword('');
      setNewPassword('');
      toast({ title: 'Profile updated', description: 'Your account and donor profile were saved.' });
    },
    onError: (error) =>
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Could not update profile.',
        variant: 'destructive',
      }),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />
      <main className="flex-1 gradient-warm py-8">
        <div className="container mx-auto px-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">Profile</CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Your roles:</span>
                {hasRole('admin') && <Badge variant="secondary">Admin</Badge>}
                {hasRole('donor') && <Badge variant="secondary">Donor</Badge>}
                {!hasRole('admin') && !hasRole('donor') && <Badge variant="secondary">Public</Badge>}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Display Name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div>
                <Label>Email (login)</Label>
                <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Donor Type</Label>
                <Select value={supporterType} onValueChange={setSupporterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supporterTypeOptions.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: 'active' | 'inactive') => setStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <EditableSelect
                label="Country"
                value={country}
                customValue={countryOther}
                options={countryOptions}
                onChange={setCountry}
                onCustomChange={setCountryOther}
                placeholder="Select country"
                allowEmpty
              />
              <EditableSelect
                label="Acquisition Channel"
                value={acquisitionChannel}
                customValue={acquisitionChannelOther}
                options={channelOptions}
                onChange={setAcquisitionChannel}
                onCustomChange={setAcquisitionChannelOther}
                placeholder="Select channel"
                allowEmpty
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Change Password</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Current Password</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div>
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => saveProfileMutation.mutate()}
              disabled={
                profileQ.isLoading ||
                saveProfileMutation.isPending ||
                !displayName.trim() ||
                !email.trim() ||
                (country === 'other' && !countryOther.trim()) ||
                (acquisitionChannel === 'other' && !acquisitionChannelOther.trim()) ||
                (!!newPassword && !currentPassword)
              }
            >
              {saveProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
      <CookieConsentBanner />
    </div>
  );
}
