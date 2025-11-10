import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Bell, CalendarDays, CheckCircle2, Clock, ListChecks, Search, Users } from "lucide-react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

// --- Mock Data ---
const patients = [
  {
    id: 1,
    name: "Barış Karapelit",
    plan: "2 Haftalık Fit Plan",
    startDate: "2025-11-03",
    endDate: "2025-11-17",
    compliance: 72,
    lastAction: "Bugün 14:05",
    status: "Aktif",
  },
  {
    id: 2,
    name: "Elif Y.",
    plan: "Düşük Karb Plan",
    startDate: "2025-11-01",
    endDate: "2025-11-15",
    compliance: 86,
    lastAction: "Dün 20:11",
    status: "Aktif",
  },
  {
    id: 3,
    name: "Meriç B.",
    plan: "Glütensiz 14G",
    startDate: "2025-10-29",
    endDate: "2025-11-12",
    compliance: 54,
    lastAction: "3 gün önce",
    status: "Risk",
  },
];

const adherenceSeries = [
  { day: "1", value: 70 },
  { day: "2", value: 68 },
  { day: "3", value: 72 },
  { day: "4", value: 74 },
  { day: "5", value: 71 },
  { day: "6", value: 76 },
  { day: "7", value: 78 },
];

const mealCompletion = [
  { label: "Kahvaltı", done: 85 },
  { label: "Ara 1", done: 78 },
  { label: "Öğle", done: 82 },
  { label: "Ara 2", done: 73 },
  { label: "Akşam", done: 88 },
  { label: "Gece Ara", done: 60 },
];

// Problemli JSX kaçışlarını önlemek için sabit
const LESS_THAN_SIXTY = '<60';

// --- Utility ---
function classNames(...arr) {
  return arr.filter(Boolean).join(" ");
}
function formatMMSS(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';
const AUTH_EXPIRES_KEY = 'auth_expires_at';
const DEFAULT_DURATION_MIN = 30;

function getAuthFromStorage() {
  if (typeof window === 'undefined') return { token: null, user: null, expiresAt: 0 };
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const user = localStorage.getItem(AUTH_USER_KEY);
  const expiresAt = Number(localStorage.getItem(AUTH_EXPIRES_KEY) || 0);
  return { token, user, expiresAt };
}
function setAuthToStorage({ token, user, expiresAt }) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, user);
  localStorage.setItem(AUTH_EXPIRES_KEY, String(expiresAt));
}
function clearAuthStorage() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_EXPIRES_KEY);
}

export default function DietitianPanelMock() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const openDetail = (p) => { setSelectedPatient(p); setShowDetail(true); };
  const closeDetail = () => setShowDetail(false);

  // —— Auth (mock + timed session) ——
  const [{ token, user, expiresAt }, setAuth] = useState(getAuthFromStorage());
  const [isAuthed, setIsAuthed] = useState(() => !!getAuthFromStorage().token && getAuthFromStorage().expiresAt > Date.now());
  const [remainingSec, setRemainingSec] = useState(() => Math.max(0, Math.floor((getAuthFromStorage().expiresAt - Date.now()) / 1000)));

  const handleLogin = (email, password) => {
    if (email && password) {
      const exp = Date.now() + DEFAULT_DURATION_MIN * 60 * 1000;
      const next = { token: 'demo-token', user: email, expiresAt: exp };
      setAuthToStorage(next);
      setAuth(next);
      setIsAuthed(true);
      setRemainingSec(Math.floor((exp - Date.now()) / 1000));
    }
  };
  const handleLogout = () => {
    clearAuthStorage();
    setAuth({ token: null, user: null, expiresAt: 0 });
    setIsAuthed(false);
    setRemainingSec(0);
  };
  const extendSession = (mins = 15) => {
    if (!isAuthed) return;
    const exp = Date.now() + mins * 60 * 1000;
    const next = { token: token || 'demo-token', user: user || 'user', expiresAt: exp };
    setAuthToStorage(next);
    setAuth(next);
    setRemainingSec(Math.floor((exp - Date.now()) / 1000));
  };

  // timer
  React.useEffect(() => {
    if (!isAuthed) return;
    const id = setInterval(() => {
      const now = Date.now();
      const exp = Number(localStorage.getItem(AUTH_EXPIRES_KEY) || 0);
      const rem = Math.floor((exp - now) / 1000);
      setRemainingSec(Math.max(0, rem));
      if (exp && now >= exp) {
        clearInterval(id);
        handleLogout();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isAuthed]);

  // sync across tabs
  React.useEffect(() => {
    const onStorage = (e) => {
      if ([AUTH_TOKEN_KEY, AUTH_USER_KEY, AUTH_EXPIRES_KEY].includes(e.key)) {
        const next = getAuthFromStorage();
        setAuth(next);
        const valid = !!next.token && next.expiresAt > Date.now();
        setIsAuthed(valid);
        setRemainingSec(Math.max(0, Math.floor((next.expiresAt - Date.now()) / 1000)));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const filtered = useMemo(() => {
    if (!query) return patients;
    return patients.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  return (
    <div className="min-h-screen bg-gray-50">
      {isAuthed ? (<>
      {/* Topbar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-6 w-6" />
            <span className="font-semibold">Diyetisyen Paneli</span> <span className="ml-2 text-xs text-gray-500">{user ? `· ${user}` : ''}</span>
          </div>
          <div className="ml-auto w-full max-w-md flex items-center gap-2">
            <div className="relative w-full">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hasta ara..."
                className="pl-8"
              />
            </div>
            {/* Oturum süresi görünümü kaldırıldı */}
            <Button variant="outline" className="gap-2">
              <Bell className="h-4 w-4" />
              Bildirimler
            </Button>
            <Button variant="outline" onClick={handleLogout}>Çıkış</Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto p-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="patients">Hastalar</TabsTrigger>
            <TabsTrigger value="plans">Planlar</TabsTrigger>
            <TabsTrigger value="alerts">Uyarılar</TabsTrigger>
            <TabsTrigger value="settings">Ayarlar</TabsTrigger>
          </TabsList>

          {/* DASHBOARD */}
          <TabsContent value="dashboard" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard icon={<Users className="h-5 w-5" />} title="Toplam Hasta" value="48" subtitle="Bu ay +6" />
              <StatCard icon={<CheckCircle2 className="h-5 w-5" />} title="Ortalama Uyum" value="%76" subtitle="Son 7 gün" />
              <StatCard icon={<Clock className="h-5 w-5" />} title="Devam Eden Plan" value="23" subtitle="14 günlük" />
              <StatCard icon={<CalendarDays className="h-5 w-5" />} title="Bugün Tamamlanan" value="112" subtitle="Öğün" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4">
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>7 Günlük Uyum Yüzdesi</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={adherenceSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Öğün Tamamlama Dağılımı</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mealCompletion}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="done" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Hızlı Hasta Görünümü</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2">Hasta</th>
                        <th className="py-2">Plan</th>
                        <th className="py-2">Tarih</th>
                        <th className="py-2">Uyum</th>
                        <th className="py-2">Son İşlem</th>
                        <th className="py-2">Durum</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="py-3 font-medium">{p.name}</td>
                          <td className="py-3 text-gray-600">{p.plan}</td>
                          <td className="py-3 text-gray-600">{p.startDate} → {p.endDate}</td>
                          <td className="py-3 w-52">
                            <div className="flex items-center gap-2">
                              <Progress value={p.compliance} />
                              <span className="w-12 text-right">%{p.compliance}</span>
                            </div>
                          </td>
                          <td className="py-3 text-gray-600">{p.lastAction}</td>
                          <td className="py-3">
                            <Badge variant={p.status === "Risk" ? "destructive" : "default"}>{p.status}</Badge>
                          </td>
                          <td className="py-3 text-right">
                            <Button size="sm" variant="secondary" onClick={() => openDetail(p)}>Detay</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PATIENTS */}
          <TabsContent value="patients" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filtered.map((p) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{p.name}</span>
                        <Badge variant={p.status === "Risk" ? "destructive" : "default"}>{p.status}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-gray-500">Plan</Label>
                        <p>{p.plan}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                        <div>
                          <span className="block">Başlangıç</span>
                          <span className="font-medium text-gray-800">{p.startDate}</span>
                        </div>
                        <div>
                          <span className="block">Bitiş</span>
                          <span className="font-medium text-gray-800">{p.endDate}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-gray-500">Uyum</Label>
                        <div className="flex items-center gap-2">
                          <Progress value={p.compliance} />
                          <span className="w-12 text-right">%{p.compliance}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button className="flex-1" variant="default" onClick={() => openDetail(p)}>Görüntüle</Button>
                        <Button className="flex-1" variant="outline">Plan Ata</Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* PLANS – Editor */}
          <TabsContent value="plans" className="mt-4">
            <DnDPlanEditor />
          </TabsContent>

          {/* ALERTS */}
          <TabsContent value="alerts" className="mt-4">
            <AlertRulesForm />
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Genel Ayarlar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Bildirim Saatleri (Varsayılan)</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {[
                        "09:00", // Kahvaltı
                        "11:00", // Ara 1
                        "13:30", // Öğle
                        "16:30", // Ara 2
                        "19:30", // Akşam
                        "22:30", // Gece ara
                      ].map((t, i) => (
                        <Input key={i} defaultValue={t} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Uyum Eşiği (%)</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input defaultValue={70} type="number" className="max-w-[140px]" />
                      <span className="text-gray-500">Altında uyarı üret</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button>Kaydet</Button>
                  <Button variant="outline">Sıfırla</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Patient Detail Drawer */}
      {showDetail && (
        <PatientDetailDrawer patient={selectedPatient} onClose={closeDetail} />
      )}

      <footer className="max-w-7xl mx-auto px-4 py-8 text-xs text-gray-500">
        © {new Date().getFullYear()} Diyetisyen Paneli · Mockup
      </footer>
        </>) : (<LoginScreen onLogin={handleLogin} />)}
    </div>
  );
}

function StatCard({ icon, title, value, subtitle }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

// ————————— Additional Components —————————
function PatientDetailDrawer({ patient, onClose }) {
  if (!patient) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex">
      <div className="ml-auto h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Hasta Detay</p>
            <h3 className="text-lg font-semibold">{patient.name} · <span className="font-normal text-gray-600">{patient.plan}</span></h3>
          </div>
          <Button variant="outline" onClick={onClose}>Kapat</Button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>14 Günlük Çizelge</CardTitle></CardHeader>
              <CardContent>
                <MealGrid />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Bildirim Saatleri</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[ ["Kahvaltı","09:00"],["Ara 1","11:00"],["Öğle","13:30"],["Ara 2","16:30"],["Akşam","19:30"],["Gece Ara","22:30"] ].map(([label,time],i)=> (
                  <div key={i} className="flex items-center justify-between">
                    <Label className="text-gray-600">{label}</Label>
                    <Input defaultValue={time} className="max-w-[120px]"/>
                  </div>
                ))}
                <div className="pt-2"><Button size="sm">Kaydet</Button></div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Plan Atama</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Plan Şablonu</Label>
                <select className="mt-1 w-full border rounded-md p-2">
                  <option>2 Haftalık Fit Plan</option>
                  <option>Düşük Karbonhidrat</option>
                  <option>Glütensiz 14G</option>
                </select>
              </div>
              <div>
                <Label>Başlangıç Tarihi</Label>
                <Input type="date" defaultValue={patient.startDate} className="mt-1"/>
              </div>
              <div>
                <Label>Döngü (gün)</Label>
                <Input type="number" defaultValue={14} className="mt-1 max-w-[140px]"/>
              </div>
              <div className="flex items-end">
                <Button className="w-full">Ata / Güncelle</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Öğün Günlüğü (Son 7 Gün)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 text-center text-xs">
                {[...Array(7)].map((_,i)=>(
                  <div key={i} className="border rounded-lg p-2">
                    <p className="text-gray-500">Gün {i+1}</p>
                    <div className="flex flex-col gap-1 mt-1">
                      {['K','A1','Ö','A2','A'].map((m,idx)=>(
                        <span key={idx} className="inline-flex items-center justify-center h-6 rounded-md border">{m} ✅</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MealGrid() {
  const days = [...Array(14)].map((_,i)=> i+1);
  const meals = ["Kahvaltı","Ara 1","Öğle","Ara 2","Akşam"];
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left">Gün</th>
            {meals.map((m)=>(<th key={m} className="p-2 text-left">{m}</th>))}
          </tr>
        </thead>
        <tbody>
          {days.map((d)=>(
            <tr key={d} className="border-t">
              <td className="p-2 font-medium">{d}</td>
              {meals.map((m,idx)=>(
                <td key={idx} className="p-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked={Math.random()>0.3} />
                    <span className="text-gray-600">Tamamlandı</span>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DnDPlanEditor() {
  const [items, setItems] = useState([
    { id: 'k', label: 'Kahvaltı: 1 haşlanmış yumurta' },
    { id: 'a1', label: 'Ara 1: 1 fincan sade kahve' },
    { id: 'o', label: 'Öğle: 1 kase mevsim salata + 1 dilim tam buğday' },
    { id: 'a2', label: 'Ara 2: 6 adet badem' },
    { id: 'a', label: 'Akşam: Izgara tavuk + salata' },
  ]);
  const [repeat, setRepeat] = useState({ every: 14, unit: 'day' });

  const onDragStart = (e, id) => { e.dataTransfer.setData('text/plain', id); };
  const onDrop = (e, index) => {
    const id = e.dataTransfer.getData('text/plain');
    const from = items.findIndex(i => i.id === id);
    if (from === -1) return;
    const newItems = [...items];
    const [moved] = newItems.splice(from, 1);
    newItems.splice(index, 0, moved);
    setItems(newItems);
  };
  const onDragOver = (e) => e.preventDefault();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Şablonu Editörü (Sürükle–Bırak)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 border rounded-xl p-3 bg-gray-50">
            <p className="text-sm text-gray-600 mb-2">Öğeleri sürükleyerek sıralamayı değiştir.</p>
            <ul className="space-y-2">
              {items.map((it, idx) => (
                <li key={it.id}
                    draggable
                    onDragStart={(e)=>onDragStart(e,it.id)}
                    onDrop={(e)=>onDrop(e, idx)}
                    onDragOver={onDragOver}
                    className="p-3 rounded-lg bg-white border shadow-sm cursor-move">
                  {idx+1}. {it.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <div>
              <Label>Tekrar Kuralı</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" value={repeat.every} onChange={(e)=>setRepeat({ ...repeat, every: Number(e.target.value) })} className="max-w-[120px]"/>
                <select value={repeat.unit} onChange={(e)=>setRepeat({ ...repeat, unit: e.target.value })} className="border rounded-md p-2">
                  <option value="day">gün</option>
                  <option value="week">hafta</option>
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1">Örn: 14 gün döngü ile tekrar et.</p>
            </div>
            <div>
              <Label>Şablon Adı</Label>
              <Input defaultValue="2 Haftalık Fit Plan" className="mt-1"/>
            </div>
            <div className="flex gap-2">
              <Button>Kaydet</Button>
              <Button variant="outline">Yeni Olarak Kaydet</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertRulesForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Uyarı Kuralları</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Uyum Eşiği (%)</Label>
            <Input defaultValue={70} type="number" className="max-w-[140px]" />
            <p className="text-xs text-gray-500">Altına düşerse uyarı oluştur.</p>
          </div>
          <div className="space-y-2">
            <Label>İşaretlenmeyen Öğün (saat)</Label>
            <Input defaultValue={4} type="number" className="max-w-[140px]" />
            <p className="text-xs text-gray-500">Öğünden sonra şu kadar saat içinde tamamlanmadıysa.</p>
          </div>
          <div className="space-y-2">
            <Label>Plan Bitiş Hatırlatma (gün)</Label>
            <Input defaultValue={2} type="number" className="max-w-[140px]" />
            <p className="text-xs text-gray-500">Bitişe bu kadar gün kala uyar.</p>
          </div>
        </div>

        <div className="border rounded-xl p-3">
          <p className="font-medium mb-2">Sessize Alma</p>
          <div className="grid md:grid-cols-3 gap-3">
            {['Gece 23:00-07:00', 'Hafta Sonu', 'Tatiller'].map((l,i)=>(
              <label key={i} className="flex items-center gap-2">
                <input type="checkbox" defaultChecked={i===0} />
                <span>{l}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="border rounded-xl p-3">
          <p className="font-medium mb-2">Otomatik Senaryolar</p>
          <ul className="space-y-2">
            <li className="flex items-center justify-between">
              <span>48 saatte 3 öğün kaçtı → Hastaya push bildirimi</span>
              <Button size="sm" variant="outline">Düzenle</Button>
            </li>
            <li className="flex items-center justify-between">
              <span>Uyum {LESS_THAN_SIXTY} → Diyetisyene e‑posta</span>
              <Button size="sm" variant="outline">Düzenle</Button>
            </li>
            <li className="flex items-center justify-between">
              <span>Plan bitişine 1 gün → Yeni plan öner</span>
              <Button size="sm" variant="outline">Düzenle</Button>
            </li>
          </ul>
        </div>

        <div className="flex gap-2">
          <Button>Kaydet</Button>
          <Button variant="outline">Varsayılanlara Dön</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ————————— Login Screen —————————
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // duration removed (fixed automatic session duration)
  const canSubmit = email.trim() !== '' && password.trim() !== '';
  const submit = (e) => {
    e.preventDefault();
    if (canSubmit) onLogin(email, password);
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Giriş Yap</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <Label>E‑posta</Label>
              <Input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label>Şifre</Label>
              <Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {/* Oturum süresi otomatik; süre alanı kaldırıldı */}
            <Button type="submit" className="w-full" disabled={!canSubmit}>Giriş</Button>
            <p className="text-xs text-gray-500 text-center">Demo: Herhangi bir e‑posta/şifre kabul edilir.</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ————————— Minimal Smoke Tests —————————
// Test 1: LESS_THAN_SIXTY metni doğru mu?
if (typeof window !== 'undefined') {
  try {
    console.assert(LESS_THAN_SIXTY === '<60', 'LESS_THAN_SIXTY sabiti beklenen değerde değil');
    console.assert(formatMMSS(61) === '01:01', 'formatMMSS(61) => 01:01 olmalı');
    console.assert(formatMMSS(0) === '00:00', 'formatMMSS(0) => 00:00 olmalı');
    console.assert(formatMMSS(3599) === '59:59', 'formatMMSS(3599) => 59:59 olmalı');
  } catch {}
}
