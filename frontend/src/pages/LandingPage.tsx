import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Heart, Shield, BookOpen, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const stats = [
  { label: 'Girls Rescued', value: '247+' },
  { label: 'Safehouses', value: '3' },
  { label: 'Reintegration Rate', value: '78%' },
  { label: 'Years of Service', value: '12+' },
];

const services = [
  { icon: Shield, title: 'Safe Shelter', description: 'Providing secure, nurturing homes where girls can heal from trauma in a protected environment.' },
  { icon: Heart, title: 'Trauma Recovery', description: 'Professional counseling and therapy programs designed specifically for survivors of abuse.' },
  { icon: BookOpen, title: 'Education', description: 'Access to quality education and skills training to build a brighter future.' },
  { icon: Users, title: 'Reintegration', description: 'Carefully planned family reintegration or independent living preparation.' },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();  // ADD THIS LINE

  return (
    <div>
      {/* Hero */}
      <section className="gradient-hero text-primary-foreground py-20 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="max-w-3xl flex-1"
            >
              <h1 className="text-4xl md:text-6xl font-display font-bold leading-tight">
                Every Girl Deserves a Safe Place to Call Home
              </h1>
              <p className="mt-6 text-lg md:text-xl opacity-90 font-body leading-relaxed max-w-2xl">
                House of Hope operates safehouses in the Philippines for girls who are survivors of sexual abuse and trafficking. We provide shelter, healing, education, and hope for a brighter future.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 bg-transparent" asChild>
                  <Link to="/impact">
                    View Impact
                  </Link>
                </Button>
                {!isAuthenticated && (  // WRAP THE LOGIN BUTTON
                    <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 bg-transparent" asChild>
                      <Link to="/login">Login</Link>
                    </Button>
                )}
              </div>
            </motion.div>
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="flex-1 hidden md:block"
            >
              <img
                  src="/multiethnic-children-hands-together-with-rainbow.jpg"
                  alt="Children joining hands together in a circle wearing colorful bracelets, representing community and hope"
                  className="rounded-2xl shadow-2xl w-full object-cover max-h-[400px]"
              />
            </motion.div>
          </div>
        </div>
      </section>


      {/* What We Do */}
      <section id="about" className="py-20 gradient-warm">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">What We Do</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Our comprehensive approach to caring for survivors ensures every girl receives the support she needs.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, i) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-card rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border"
              >
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">{service.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{service.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
