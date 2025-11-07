import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock, User, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  patient_note: string | null;
  doctor_note: string | null;
  profiles: {
    full_name: string;
    phone: string | null;
  };
  departments: {
    name: string;
  } | null;
}

export default function DoctorDashboard() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [doctorNote, setDoctorNote] = useState('');
  const [actionDialog, setActionDialog] = useState<'confirm' | 'reject' | null>(null);
  const { toast } = useToast();
  const [doctorId, setDoctorId] = useState<string | null>(null);

  useEffect(() => {
    fetchDoctorId();
  }, [profile]);

  useEffect(() => {
    if (doctorId) {
      fetchAppointments();
      subscribeToAppointments();
    }
  }, [doctorId]);

  const fetchDoctorId = async () => {
    if (!profile?.id) return;
    
    const { data } = await supabase
      .from('doctors')
      .select('id')
      .eq('profile_id', profile.id)
      .single();
    
    if (data) setDoctorId(data.id);
  };

  const fetchAppointments = async () => {
    if (!doctorId) return;

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          profiles (full_name, phone),
          departments (name)
        `)
        .eq('doctor_id', doctorId)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load appointments',
      });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToAppointments = () => {
    if (!doctorId) return;

    const channel = supabase
      .channel('doctor-appointments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `doctor_id=eq.${doctorId}`,
        },
        () => {
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAppointmentAction = async () => {
    if (!selectedAppointment || !actionDialog) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: actionDialog === 'confirm' ? 'confirmed' : 'rejected',
          doctor_note: doctorNote || null,
        })
        .eq('id', selectedAppointment.id);

      if (error) throw error;

      toast({
        title: `Appointment ${actionDialog === 'confirm' ? 'confirmed' : 'rejected'}`,
        description: `You have ${actionDialog === 'confirm' ? 'confirmed' : 'rejected'} the appointment`,
      });

      setActionDialog(null);
      setSelectedAppointment(null);
      setDoctorNote('');
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update appointment',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      confirmed: 'default',
      rejected: 'destructive',
      cancelled: 'secondary',
      completed: 'secondary',
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const pendingAppointments = appointments.filter((apt) => apt.status === 'pending');
  const confirmedAppointments = appointments.filter((apt) => apt.status === 'confirmed');
  const otherAppointments = appointments.filter(
    (apt) => apt.status !== 'pending' && apt.status !== 'confirmed'
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Dr. {profile?.full_name}'s Dashboard</h1>
          <p className="mt-2 text-muted-foreground">Manage your appointments and patients</p>
        </div>

        {/* Pending Appointments */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Pending Requests ({pendingAppointments.length})
          </h2>
          {pendingAppointments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No pending appointment requests</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingAppointments.map((appointment) => (
                <Card key={appointment.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          {appointment.profiles.full_name}
                        </CardTitle>
                        <CardDescription>
                          {appointment.profiles.phone} • {appointment.departments?.name}
                        </CardDescription>
                      </div>
                      {getStatusBadge(appointment.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(appointment.appointment_date), 'MMMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{appointment.appointment_time}</span>
                    </div>
                    {appointment.patient_note && (
                      <div className="text-sm">
                        <p className="font-medium">Patient's note:</p>
                        <p className="text-muted-foreground">{appointment.patient_note}</p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setActionDialog('confirm');
                        }}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setActionDialog('reject');
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Confirmed Appointments */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Confirmed Appointments ({confirmedAppointments.length})
          </h2>
          {confirmedAppointments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No confirmed appointments</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {confirmedAppointments.map((appointment) => (
                <Card key={appointment.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          {appointment.profiles.full_name}
                        </CardTitle>
                        <CardDescription>
                          {appointment.profiles.phone} • {appointment.departments?.name}
                        </CardDescription>
                      </div>
                      {getStatusBadge(appointment.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(appointment.appointment_date), 'MMMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{appointment.appointment_time}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Past/Other Appointments */}
        {otherAppointments.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Past Appointments</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {otherAppointments.map((appointment) => (
                <Card key={appointment.id} className="opacity-75">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          {appointment.profiles.full_name}
                        </CardTitle>
                        <CardDescription>{appointment.departments?.name}</CardDescription>
                      </div>
                      {getStatusBadge(appointment.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(appointment.appointment_date), 'MMMM d, yyyy')}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === 'confirm' ? 'Confirm' : 'Reject'} Appointment
            </DialogTitle>
            <DialogDescription>
              {actionDialog === 'confirm'
                ? 'Confirm this appointment with the patient'
                : 'Reject this appointment request'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Add a note (optional)"
              value={doctorNote}
              onChange={(e) => setDoctorNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={actionDialog === 'confirm' ? 'default' : 'destructive'}
              onClick={handleAppointmentAction}
            >
              {actionDialog === 'confirm' ? 'Confirm' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
