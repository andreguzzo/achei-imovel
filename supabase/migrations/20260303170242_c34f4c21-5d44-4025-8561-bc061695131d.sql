
-- Appointment types enum
CREATE TYPE public.appointment_type AS ENUM ('visit', 'meeting', 'signing', 'inspection', 'follow_up', 'other');

-- Broker appointments table
CREATE TABLE public.broker_appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_id UUID NOT NULL,
  title TEXT NOT NULL,
  appointment_type appointment_type NOT NULL DEFAULT 'visit',
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  client_name TEXT,
  client_phone TEXT,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES public.sales_pipeline(id) ON DELETE SET NULL,
  location TEXT,
  notes TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.broker_appointments ENABLE ROW LEVEL SECURITY;

-- Brokers can manage their own appointments
CREATE POLICY "Brokers manage own appointments"
  ON public.broker_appointments FOR ALL
  TO authenticated
  USING (auth.uid() = broker_id)
  WITH CHECK (auth.uid() = broker_id);

-- Updated_at trigger
CREATE TRIGGER update_broker_appointments_updated_at
  BEFORE UPDATE ON public.broker_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
