import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Shield, Stethoscope, Users, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Department {
  id: string;
  name: string;
  description: string | null;
}

export default function Landing() {
  const { user, profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('*')
      .limit(6);
    if (data) setDepartments(data);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Book Your Healthcare
              <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Appointments Online
              </span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
              Connect with qualified doctors across all specialties. Easy scheduling, verified professionals, and seamless care management.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {!user ? (
                <>
                  <Button size="lg" asChild>
                    <Link to="/auth/register">Get Started</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/doctors">Browse Doctors</Link>
                  </Button>
                </>
              ) : (
                <Button size="lg" asChild>
                  <Link to={profile?.role === 'admin' ? '/admin/dashboard' : profile?.role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard'}>
                    Go to Dashboard
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Why Choose Us</h2>
            <p className="mt-4 text-muted-foreground">Modern healthcare at your fingertips</p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <Calendar className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Easy Scheduling</CardTitle>
                <CardDescription>
                  Book appointments in seconds with our intuitive calendar system
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-secondary mb-2" />
                <CardTitle>Verified Doctors</CardTitle>
                <CardDescription>
                  All medical professionals are thoroughly verified and certified
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Clock className="h-10 w-10 text-accent mb-2" />
                <CardTitle>24/7 Support</CardTitle>
                <CardDescription>
                  Get help whenever you need it with our round-the-clock support
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Stethoscope className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Multiple Specialties</CardTitle>
                <CardDescription>
                  Access to doctors across all medical specialties and departments
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-secondary mb-2" />
                <CardTitle>Trusted by Thousands</CardTitle>
                <CardDescription>
                  Join our growing community of satisfied patients
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CheckCircle className="h-10 w-10 text-accent mb-2" />
                <CardTitle>Instant Confirmation</CardTitle>
                <CardDescription>
                  Receive immediate booking confirmations and reminders
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Departments Section */}
      <section className="bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Our Departments</h2>
            <p className="mt-4 text-muted-foreground">Comprehensive healthcare across all specialties</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <Card key={dept.id} className="hover:shadow-medium transition-shadow">
                <CardHeader>
                  <CardTitle>{dept.name}</CardTitle>
                  <CardDescription>{dept.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="link" className="p-0" asChild>
                    <Link to="/doctors">Find Doctors →</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of patients who trust us with their healthcare needs
          </p>
          {!user && (
            <Button size="lg" asChild>
              <Link to="/auth/register">Create Your Account</Link>
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
