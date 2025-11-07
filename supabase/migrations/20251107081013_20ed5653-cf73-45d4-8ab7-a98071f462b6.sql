-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create departments table
CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create profiles table (extends auth.users with role and additional info)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
  email_confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create doctors table
CREATE TABLE doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  specialty text,
  bio text,
  experience_years int DEFAULT 0,
  photo_url text,
  created_at timestamptz DEFAULT now()
);

-- Create doctor_availabilities table
CREATE TABLE doctor_availabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid REFERENCES doctors(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create appointments table
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id),
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  created_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')),
  patient_note text,
  doctor_note text,
  cancelled_by text CHECK (cancelled_by IN ('patient', 'doctor', 'admin'))
);

-- Create unique index to prevent double booking
CREATE UNIQUE INDEX idx_appointments_no_double_booking 
ON appointments (doctor_id, appointment_date, appointment_time)
WHERE status IN ('pending', 'confirmed');

-- Enable Row Level Security
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for departments
CREATE POLICY "Departments are viewable by everyone"
  ON departments FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage departments"
  ON departments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for doctors
CREATE POLICY "Doctors are viewable by everyone"
  ON doctors FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage doctors"
  ON doctors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for doctor_availabilities
CREATE POLICY "Availabilities are viewable by everyone"
  ON doctor_availabilities FOR SELECT
  USING (true);

CREATE POLICY "Doctors can manage their own availability"
  ON doctor_availabilities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM doctors
      JOIN profiles ON doctors.profile_id = profiles.id
      WHERE profiles.id = auth.uid()
      AND doctors.id = doctor_availabilities.doctor_id
    )
  );

CREATE POLICY "Admins can manage all availabilities"
  ON doctor_availabilities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for appointments
CREATE POLICY "Patients can view their own appointments"
  ON appointments FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY "Doctors can view their appointments"
  ON appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM doctors
      WHERE doctors.profile_id = auth.uid()
      AND doctors.id = appointments.doctor_id
    )
  );

CREATE POLICY "Admins can view all appointments"
  ON appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Patients can create appointments"
  ON appointments FOR INSERT
  WITH CHECK (
    auth.uid() = patient_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email_confirmed = true
    )
  );

CREATE POLICY "Patients can cancel their appointments"
  ON appointments FOR UPDATE
  USING (auth.uid() = patient_id)
  WITH CHECK (
    auth.uid() = patient_id
    AND status = 'cancelled'
    AND cancelled_by = 'patient'
  );

CREATE POLICY "Doctors can update their appointment status"
  ON appointments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM doctors
      WHERE doctors.profile_id = auth.uid()
      AND doctors.id = appointments.doctor_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM doctors
      WHERE doctors.profile_id = auth.uid()
      AND doctors.id = appointments.doctor_id
    )
  );

CREATE POLICY "Admins can manage all appointments"
  ON appointments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to update profile email_confirmed from auth.users
CREATE OR REPLACE FUNCTION update_profile_email_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET email_confirmed = NEW.email_confirmed_at IS NOT NULL
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync email confirmation status
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_email_confirmed();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, phone, role, email_confirmed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    NEW.email_confirmed_at IS NOT NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Insert sample departments
INSERT INTO departments (name, description) VALUES
  ('Cardiology', 'Heart and cardiovascular system care'),
  ('Dermatology', 'Skin, hair, and nail treatments'),
  ('Orthopedics', 'Bone, joint, and muscle care'),
  ('Pediatrics', 'Healthcare for children and adolescents'),
  ('General Medicine', 'Primary care and general health'),
  ('Neurology', 'Brain and nervous system care');

-- Enable realtime for appointments
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;