import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2, Plus, CalendarDays, Clock, MapPin, CheckCircle2, Circle, ChevronLeft, ChevronRight, User,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BrokerAgendaProps {
  userId: string;
}

interface Appointment {
  id: string;
  title: string;
  appointment_type: string;
  appointment_date: string;
  start_time: string;
  end_time: string | null;
  client_name: string | null;
  client_phone: string | null;
  property_id: string | null;
  pipeline_id: string | null;
  location: string | null;
  notes: string | null;
  completed: boolean;
}

interface PropertyOption {
  id: string;
  title: string;
}

const APPOINTMENT_TYPES = [
  { key: "visit", labelPt: "Visita", labelEn: "Visit" },
  { key: "meeting", labelPt: "Reunião", labelEn: "Meeting" },
  { key: "signing", labelPt: "Assinatura", labelEn: "Signing" },
  { key: "inspection", labelPt: "Vistoria", labelEn: "Inspection" },
  { key: "follow_up", labelPt: "Follow-up", labelEn: "Follow-up" },
  { key: "other", labelPt: "Outro", labelEn: "Other" },
] as const;

const TYPE_COLORS: Record<string, string> = {
  visit: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  meeting: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  signing: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  inspection: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  follow_up: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  other: "bg-muted text-muted-foreground",
};

const BrokerAgenda = ({ userId }: BrokerAgendaProps) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const dateLocale = pt ? ptBR : undefined;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState("visit");
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPropertyId, setFormPropertyId] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const [apptRes, propsRes] = await Promise.all([
      supabase
        .from("broker_appointments")
        .select("id, title, appointment_type, appointment_date, start_time, end_time, client_name, client_phone, property_id, pipeline_id, location, notes, completed")
        .eq("broker_id", userId)
        .order("appointment_date")
        .order("start_time"),
      supabase
        .from("properties")
        .select("id, title")
        .eq("user_id", userId)
        .eq("status", "active"),
    ]);
    setAppointments((apptRes.data as Appointment[]) ?? []);
    setProperties((propsRes.data as PropertyOption[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [userId]);

  const resetForm = () => {
    setFormTitle("");
    setFormType("visit");
    setFormDate(format(selectedDate, "yyyy-MM-dd"));
    setFormStartTime("09:00");
    setFormEndTime("");
    setFormClient("");
    setFormPhone("");
    setFormPropertyId("");
    setFormLocation("");
    setFormNotes("");
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formDate || !formStartTime) return;
    setSubmitting(true);
    const { error } = await supabase.from("broker_appointments").insert({
      broker_id: userId,
      title: formTitle,
      appointment_type: formType,
      appointment_date: formDate,
      start_time: formStartTime,
      end_time: formEndTime || null,
      client_name: formClient || null,
      client_phone: formPhone || null,
      property_id: formPropertyId || null,
      location: formLocation || null,
      notes: formNotes || null,
    } as any);
    if (error) {
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: pt ? "Compromisso criado!" : "Appointment created!" });
      setShowNew(false);
      resetForm();
      fetchData();
    }
    setSubmitting(false);
  };

  const handleToggleCompleted = async (appt: Appointment) => {
    await supabase.from("broker_appointments").update({ completed: !appt.completed }).eq("id", appt.id);
    setAppointments((prev) =>
      prev.map((a) => (a.id === appt.id ? { ...a, completed: !a.completed } : a))
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm(pt ? "Excluir compromisso?" : "Delete appointment?")) return;
    await supabase.from("broker_appointments").delete().eq("id", id);
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    toast({ title: pt ? "Excluído" : "Deleted" });
  };

  // Calendar computations
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start to align with weekday
  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(days);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((a) => {
      const key = a.appointment_date;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [appointments]);

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const dayAppointments = appointmentsByDate[selectedDateStr] ?? [];

  const weekDays = pt
    ? ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const typeLabel = (key: string) => {
    const t = APPOINTMENT_TYPES.find((a) => a.key === key);
    return t ? (pt ? t.labelPt : t.labelEn) : key;
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">
          {pt ? "Agenda" : "Calendar"}
        </h2>
        <Dialog open={showNew} onOpenChange={(open) => { setShowNew(open); if (open) { resetForm(); setFormDate(format(selectedDate, "yyyy-MM-dd")); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> {pt ? "Novo" : "New"}</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{pt ? "Novo Compromisso" : "New Appointment"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder={pt ? "Título *" : "Title *"} value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{pt ? t.labelPt : t.labelEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-xs text-muted-foreground">{pt ? "Data" : "Date"}</label>
                  <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{pt ? "Início" : "Start"}</label>
                  <Input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{pt ? "Fim" : "End"}</label>
                  <Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={pt ? "Nome do cliente" : "Client name"} value={formClient} onChange={(e) => setFormClient(e.target.value)} />
                <Input placeholder={pt ? "Telefone" : "Phone"} value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
              </div>
              {properties.length > 0 && (
                <Select value={formPropertyId} onValueChange={setFormPropertyId}>
                  <SelectTrigger><SelectValue placeholder={pt ? "Vincular imóvel (opcional)" : "Link property (optional)"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{pt ? "Nenhum" : "None"}</SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input placeholder={pt ? "Local" : "Location"} value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
              <Textarea placeholder={pt ? "Observações" : "Notes"} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} />
              <Button onClick={handleCreate} disabled={submitting || !formTitle.trim()} className="w-full">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pt ? "Criar" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Calendar Grid */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-base capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: dateLocale })}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px">
              {weekDays.map((d) => (
                <div key={d} className="pb-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
              {paddedDays.map((day, i) => {
                if (!day) return <div key={`pad-${i}`} />;
                const dateStr = format(day, "yyyy-MM-dd");
                const dayAppts = appointmentsByDate[dateStr] ?? [];
                const selected = isSameDay(day, selectedDate);
                const today = isToday(day);
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(day)}
                    className={`relative flex flex-col items-center rounded-lg p-1.5 text-sm transition-colors
                      ${selected ? "bg-primary text-primary-foreground" : today ? "bg-accent" : "hover:bg-accent"}
                      ${!isSameMonth(day, currentMonth) ? "text-muted-foreground/50" : ""}
                    `}
                  >
                    <span className="font-medium">{format(day, "d")}</span>
                    {dayAppts.length > 0 && (
                      <div className="mt-0.5 flex gap-0.5">
                        {dayAppts.slice(0, 3).map((a) => (
                          <span
                            key={a.id}
                            className={`h-1.5 w-1.5 rounded-full ${a.completed ? "bg-muted-foreground/40" : "bg-primary"}`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Day detail */}
        <div className="space-y-3">
          <h3 className="font-medium text-foreground">
            {format(selectedDate, pt ? "dd 'de' MMMM" : "MMMM d", { locale: dateLocale })}
          </h3>
          {dayAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {pt ? "Nenhum compromisso" : "No appointments"}
            </p>
          ) : (
            dayAppointments.map((appt) => (
              <Card key={appt.id} className={appt.completed ? "opacity-60" : ""}>
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <button onClick={() => handleToggleCompleted(appt)} className="mt-0.5 shrink-0">
                        {appt.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${appt.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {appt.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className={`text-[10px] ${TYPE_COLORS[appt.appointment_type] ?? TYPE_COLORS.other}`}>
                            {typeLabel(appt.appointment_type)}
                          </Badge>
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {appt.start_time.slice(0, 5)}
                            {appt.end_time && ` - ${appt.end_time.slice(0, 5)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs text-destructive shrink-0 h-6 px-2" onClick={() => handleDelete(appt.id)}>
                      ✕
                    </Button>
                  </div>
                  {appt.client_name && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground pl-6">
                      <User className="h-3 w-3" /> {appt.client_name}
                      {appt.client_phone && ` • ${appt.client_phone}`}
                    </p>
                  )}
                  {appt.location && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground pl-6">
                      <MapPin className="h-3 w-3" /> {appt.location}
                    </p>
                  )}
                  {appt.notes && (
                    <p className="text-xs text-muted-foreground pl-6">{appt.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Upcoming appointments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" />
            {pt ? "Próximos Compromissos" : "Upcoming Appointments"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const todayStr = format(new Date(), "yyyy-MM-dd");
            const upcoming = appointments
              .filter((a) => a.appointment_date >= todayStr && !a.completed)
              .slice(0, 8);
            if (upcoming.length === 0) {
              return <p className="text-sm text-muted-foreground py-4 text-center">{pt ? "Nenhum compromisso futuro" : "No upcoming appointments"}</p>;
            }
            return (
              <div className="space-y-2">
                {upcoming.map((appt) => (
                  <div key={appt.id} className="flex items-center justify-between rounded-lg border p-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-center shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(appt.appointment_date), pt ? "dd/MM" : "MM/dd")}
                        </p>
                        <p className="text-xs font-bold">{appt.start_time.slice(0, 5)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{appt.title}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge className={`text-[10px] ${TYPE_COLORS[appt.appointment_type] ?? TYPE_COLORS.other}`}>
                            {typeLabel(appt.appointment_type)}
                          </Badge>
                          {appt.client_name && (
                            <span className="text-xs text-muted-foreground truncate">{appt.client_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Checkbox
                      checked={appt.completed}
                      onCheckedChange={() => handleToggleCompleted(appt)}
                    />
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

export default BrokerAgenda;
