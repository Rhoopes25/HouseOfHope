import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerUser } from '@/lib/authAPI';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminRole, setAdminRole] = useState(false);
  const [donorRole, setDonorRole] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (password.length < 14) {
      setError('Password must be at least 14 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords must match.');
      return;
    }

    const roles: string[] = [];
    if (adminRole) roles.push('Admin');
    if (donorRole) roles.push('Donor');
    if (roles.length === 0) {
      setError('Select at least one role.');
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
        roles,
      });
      const loginResult = await login(email.trim(), password);
      if (!loginResult.success) {
        navigate('/login');
        return;
      }

      if (roles.includes('Admin')) {
        navigate('/admin');
      } else if (roles.includes('Donor')) {
        navigate('/donor-portal');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center gradient-warm px-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary flex items-center justify-center mb-3">
            <Heart className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="font-display text-2xl">Create Account</CardTitle>
          <CardDescription>Register with one or more roles</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="displayName">Display Name (optional)</Label>
              <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1" />
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Password rule:</p>
              <p>- Must be at least 14 characters long.</p>
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">Roles (select one or more)</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={adminRole} onChange={e => setAdminRole(e.target.checked)} />
                Admin
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={donorRole} onChange={e => setDonorRole(e.target.checked)} />
                Donor
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-primary hover:underline">Already have an account? Sign in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
