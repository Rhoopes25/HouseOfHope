import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@/components/StatCard';
import { fetchImpactStats } from '@/lib/api-endpoints';
import { Users, DollarSign, TrendingUp, GraduationCap, HeartPulse } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

export default function DonorImpactDashboard() {
  const { data: impact, isLoading, error } = useQuery({ queryKey: ['impact'], queryFn: fetchImpactStats });

  if (error) {
    return (
      <div className="gradient-warm py-12">
        <div className="container mx-auto px-4">
          <p className="text-destructive text-center">Unable to load impact data.</p>
        </div>
      </div>
    );
  }

  const trends = impact?.monthlyTrends ?? [];

  return (
    <div className="gradient-warm py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-display font-bold text-foreground">Our Impact</h1>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            See how your support transforms lives. All data is anonymized to protect the privacy of the girls we serve.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
          {isLoading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            <>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                <StatCard title="Total Residents Served" value={impact?.totalResidentsServed ?? 0} icon={<Users className="h-6 w-6" />} />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <StatCard title="Total Donations" value={`₱${((impact?.totalDonationsReceived ?? 0) / 1000).toFixed(0)}K`} icon={<DollarSign className="h-6 w-6" />} />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <StatCard title="Reintegration Rate" value={`${impact?.reintegrationSuccessRate ?? 0}%`} icon={<TrendingUp className="h-6 w-6" />} />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <StatCard title="Education Rate" value={`${impact?.educationEnrollmentRate ?? 0}%`} icon={<GraduationCap className="h-6 w-6" />} />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <StatCard title="Health Improvement" value={`${impact?.healthImprovementRate ?? 0}%`} icon={<HeartPulse className="h-6 w-6" />} />
              </motion.div>
            </>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Girls Helped Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-[300px] w-full" /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 15% 90%)" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Line type="monotone" dataKey="residents" stroke="hsl(174 55% 38%)" strokeWidth={3} dot={{ fill: 'hsl(174 55% 38%)' }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Education & Health Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-[300px] w-full" /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 15% 90%)" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="education" stroke="hsl(200 65% 55%)" strokeWidth={3} name="Education %" />
                    <Line type="monotone" dataKey="health" stroke="hsl(174 55% 38%)" strokeWidth={3} name="Health %" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
