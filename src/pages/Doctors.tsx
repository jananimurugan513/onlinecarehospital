import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Doctor {
  id: string;
  specialty: string | null;
  bio: string | null;
  experience_years: number;
  photo_url: string | null;
  profiles: { full_name: string };
  departments: { id: string; name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

export default function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');

  useEffect(() => {
    fetchDepartments();
    fetchDoctors();
  }, [selectedDept]);

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('*');
    if (data) setDepartments(data);
  };

  const fetchDoctors = async () => {
    let query = supabase
      .from('doctors')
      .select('*, profiles(full_name), departments(id, name)');

    if (selectedDept !== 'all') {
      query = query.eq('department_id', selectedDept);
    }

    const { data } = await query;
    if (data) setDoctors(data);
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Find Doctors</h1>
          <p className="mt-2 text-muted-foreground">Browse our qualified healthcare professionals</p>
        </div>

        <div className="mb-6">
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filter by department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doctor) => (
            <Card key={doctor.id}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  {doctor.photo_url ? (
                    <img src={doctor.photo_url} alt={doctor.profiles.full_name} className="h-16 w-16 rounded-full" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-8 w-8 text-primary" />
                    </div>
                  )}
                  <div>
                    <CardTitle>Dr. {doctor.profiles.full_name}</CardTitle>
                    <CardDescription>{doctor.specialty}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{doctor.bio}</p>
                <p className="text-sm font-medium">{doctor.experience_years} years experience</p>
                <p className="text-sm text-muted-foreground">{doctor.departments?.name}</p>
                <Button className="w-full" asChild>
                  <Link to={`/book/${doctor.id}`}>Book Appointment</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
