import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Brush,
  Eye,
  FileText,
  Image,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MousePointerClick,
  PanelLeft,
  Save,
  Search,
  Settings,
  Share2,
  Shield,
  Upload,
  Users,
} from "lucide-react";
import {
  adminRpc,
  adminTable,
  clearAdminToken,
  getStoredAdminToken,
  loginAdmin,
  storeAdminToken,
} from "@/lib/adminApi";

type Lead = {
  id: string;
  name: string | null;
  whatsapp: string | null;
  email: string | null;
  status: string;
  source: string | null;
  created_at: string;
};

type AnalyticsEvent = {
  event_name: string;
  visitor_id: string | null;
  session_id: string | null;
  device: string | null;
  source: string | null;
  created_at: string;
};

type WhatsAppSettings = {
  id: string;
  floating_enabled: boolean;
  country_code: string;
  ddd: string | null;
  phone: string | null;
  initial_message: string | null;
};

type VisualIdentity = {
  id: string;
  tokens: Record<string, string>;
  fonts: Record<string, string>;
  assets: Record<string, string>;
};

const menu = [
  ["Dashboard", LayoutDashboard],
  ["Conteúdo", FileText],
  ["Seções", PanelLeft],
  ["Botões", MousePointerClick],
  ["Mídia", Image],
  ["Formulários", FileText],
  ["Leads", Users],
  ["WhatsApp", MessageCircle],
  ["Identidade Visual", Brush],
  ["Métricas", BarChart3],
  ["Rastreamento", Activity],
  ["SEO e Compartilhamento", Share2],
  ["Publicações", Upload],
  ["Configurações", Settings],
] as const;

const leadStatuses = ["Novo", "Em contato", "Respondido", "Qualificado", "Convertido", "Arquivado"];

function AdminPanel() {
  const [token, setToken] = useState(() => getStoredAdminToken());
  const [password, setPassword] = useState("");
  const [active, setActive] = useState<(typeof menu)[number][0]>("Dashboard");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("Tudo salvo");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [whatsapp, setWhatsapp] = useState<WhatsAppSettings | null>(null);
  const [identity, setIdentity] = useState<VisualIdentity | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [security, setSecurity] = useState({ recoveryEmail: "", currentPassword: "", newPassword: "", confirmPassword: "" });
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const filteredLeads = useMemo(() => {
    const term = leadSearch.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter((lead) =>
      [lead.name, lead.whatsapp, lead.email, lead.status].filter(Boolean).some((value) => value!.toLowerCase().includes(term)),
    );
  }, [leadSearch, leads]);

  const metrics = useMemo(() => {
    const visitorIds = new Set(events.map((event) => event.visitor_id).filter(Boolean));
    const sessionIds = new Set(events.map((event) => event.session_id).filter(Boolean));
    const whatsappClicks = events.filter((event) => event.event_name === "WhatsAppClick").length;
    const devices = events.reduce<Record<string, number>>((acc, event) => {
      const key = event.device || "Indisponível";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const topDevice = Object.entries(devices).sort((a, b) => b[1] - a[1])[0]?.[0] || "Indisponível";

    return {
      views: events.filter((event) => event.event_name === "PageView").length,
      visitors: visitorIds.size,
      sessions: sessionIds.size,
      leads: leads.length,
      newLeads: leads.filter((lead) => lead.status === "Novo").length,
      whatsappClicks,
      conversion: visitorIds.size ? `${Math.round((leads.length / visitorIds.size) * 100)}%` : "Indisponível",
      topDevice,
    };
  }, [events, leads]);

  useEffect(() => {
    if (!token) return;
    void loadData(token);
  }, [token]);

  async function loadData(currentToken = token) {
    if (!currentToken) return;
    setLoading(true);
    try {
      const [leadRows, eventRows, whatsappRows, identityRows] = await Promise.all([
        adminTable<Lead[]>("leads", { token: currentToken, query: "?select=*&deleted_at=is.null&order=created_at.desc" }),
        adminTable<AnalyticsEvent[]>("analytics_events", { token: currentToken, query: "?select=*&order=created_at.desc&limit=500" }),
        adminTable<WhatsAppSettings[]>("whatsapp_settings", { token: currentToken, query: "?select=*&limit=1" }),
        adminTable<VisualIdentity[]>("visual_identity", { token: currentToken, query: "?select=*&limit=1" }),
      ]);
      setLeads(leadRows);
      setEvents(eventRows);
      setWhatsapp(whatsappRows[0] ?? null);
      setIdentity(identityRows[0] ?? null);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await loginAdmin(password);
      if (!response.ok || !response.token) {
        setFeedback(response.error === "temporarily_locked" ? "Muitas tentativas. Aguarde alguns minutos." : "Senha incorreta.");
        return;
      }
      storeAdminToken(response.token);
      setToken(response.token);
      setMustChangePassword(Boolean(response.must_change_default_password));
      setFeedback("Sessão iniciada");
    } catch {
      setFeedback("Não foi possível entrar no painel.");
    } finally {
      setLoading(false);
    }
  }

  async function saveWhatsapp() {
    if (!token || !whatsapp) return;
    setFeedback("Salvando...");
    await adminTable("whatsapp_settings", {
      method: "PATCH",
      token,
      query: `?id=eq.${whatsapp.id}`,
      body: whatsapp,
    });
    setFeedback("Rascunho salvo");
  }

  async function updateLeadStatus(id: string, status: string) {
    if (!token) return;
    await adminTable("leads", {
      method: "PATCH",
      token,
      query: `?id=eq.${id}`,
      body: { status },
    });
    setLeads((rows) => rows.map((lead) => (lead.id === id ? { ...lead, status } : lead)));
    setFeedback("Lead atualizado");
  }

  async function saveSecurity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (security.newPassword && security.newPassword !== security.confirmPassword) {
      setFeedback("A confirmação da senha não confere.");
      return;
    }
    setFeedback("Salvando...");
    if (security.recoveryEmail) {
      await adminRpc("admin_save_recovery_email", token, { recoveryEmail: security.recoveryEmail });
    }
    if (security.currentPassword && security.newPassword) {
      const response = await adminRpc<{ ok: boolean; error?: string }>("admin_change_password", token, {
        currentPassword: security.currentPassword,
        newPassword: security.newPassword,
      });
      if (!response.ok) throw new Error(response.error);
      setMustChangePassword(false);
    }
    setFeedback("Alterações salvas.");
  }

  function exportLeads() {
    const header = ["Nome", "WhatsApp", "E-mail", "Origem", "Status", "Data"];
    const rows = filteredLeads.map((lead) => [lead.name, lead.whatsapp, lead.email, lead.source, lead.status, lead.created_at]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `\"${String(cell ?? "").replaceAll("\"", "\"\"")}\"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "leads.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-[#F6F7F9] px-4 py-10 font-sans text-[#111827]">
        <form onSubmit={handleLogin} className="mx-auto mt-20 w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
          <Shield className="mb-5 h-10 w-10 text-[#2563EB]" />
          <h1 className="text-2xl font-semibold">PAINEL ADMINISTRATIVO</h1>
          <label className="mt-8 block text-sm font-medium" htmlFor="password">Senha</label>
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#E5E7EB] px-4 outline-none focus:ring-2 focus:ring-[#2563EB]" />
          <button disabled={loading} className="mt-5 h-12 w-full rounded-lg bg-[#2563EB] font-semibold text-white disabled:opacity-60">ENTRAR</button>
          <button type="button" className="mt-4 text-sm text-[#2563EB]" onClick={() => setFeedback("Recuperação por e-mail ainda precisa de serviço transacional configurado.")}>Esqueci minha senha</button>
          <p className="mt-4 text-sm text-[#6B7280]">{feedback}</p>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F6F7F9] font-sans text-[#111827]">
      <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)_360px]">
        <aside className="bg-[#111827] p-4 text-white">
          <div className="mb-6 flex items-center gap-3 px-3 py-2">
            <Shield className="h-6 w-6 text-[#60A5FA]" />
            <div>
              <strong>Painel</strong>
              <span className="block text-xs text-gray-400">Our Heartfelt Home</span>
            </div>
          </div>
          <nav className="space-y-1">
            {menu.map(([label, Icon]) => (
              <button key={label} onClick={() => setActive(label)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${active === label ? "bg-[#2563EB]" : "text-gray-300 hover:bg-white/10"}`}>
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
          <button onClick={() => { clearAdminToken(); setToken(null); }} className="mt-8 flex items-center gap-2 px-3 text-sm text-gray-300">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </aside>

        <section className="relative p-4 pb-28 md:p-8">
          {mustChangePassword && (
            <div className="mb-5 rounded-xl border border-[#D97706]/30 bg-[#D97706]/10 p-4 text-sm text-[#92400E]">
              Por segurança, altere sua senha padrão e cadastre um e-mail de recuperação.
              <button className="ml-2 font-semibold underline" onClick={() => setActive("Configurações")}>CONFIGURAR SEGURANÇA</button>
            </div>
          )}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[#6B7280]">Área administrativa</p>
              <h1 className="text-3xl font-semibold">{active}</h1>
            </div>
            {loading && <span className="text-sm text-[#6B7280]">Carregando...</span>}
          </div>

          {active === "Dashboard" && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Metric title="Visitantes hoje" value={metrics.visitors} />
              <Metric title="Visitantes nos últimos 7 dias" value={metrics.visitors} />
              <Metric title="Leads novos" value={metrics.newLeads} />
              <Metric title="Total de leads" value={metrics.leads} />
              <Metric title="Cliques no WhatsApp" value={metrics.whatsappClicks} />
              <Metric title="Dispositivo principal" value={metrics.topDevice} />
              <Metric title="Taxa de conversão" value={metrics.conversion} />
              <Shortcut label="EDITAR SITE" onClick={() => setActive("Conteúdo")} />
              <Shortcut label="VER LEADS" onClick={() => setActive("Leads")} />
              <Shortcut label="MÉTRICAS" onClick={() => setActive("Métricas")} />
              <Shortcut label="ALTERAR WHATSAPP" onClick={() => setActive("WhatsApp")} />
              <Shortcut label="RASTREAMENTOS" onClick={() => setActive("Rastreamento")} />
            </div>
          )}

          {active === "Leads" && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
              <div className="mb-4 flex flex-wrap gap-3">
                <div className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-[#E5E7EB] px-3">
                  <Search className="h-4 w-4 text-[#6B7280]" />
                  <input value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} placeholder="Buscar por nome, telefone ou e-mail" className="h-11 flex-1 outline-none" />
                </div>
                <button onClick={exportLeads} className="rounded-lg border border-[#E5E7EB] px-4 font-medium">EXPORTAR CSV</button>
              </div>
              <div className="overflow-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-[#6B7280]">
                    <tr><th className="py-3">Nome</th><th>WhatsApp</th><th>E-mail</th><th>Origem</th><th>Data</th><th>Status</th><th>Ações</th></tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="border-t border-[#E5E7EB]">
                        <td className="py-3">{lead.name || "Sem nome"}</td>
                        <td>{lead.whatsapp || "-"}</td>
                        <td>{lead.email || "-"}</td>
                        <td>{lead.source || "-"}</td>
                        <td>{new Date(lead.created_at).toLocaleString("pt-BR")}</td>
                        <td>
                          <select value={lead.status} onChange={(event) => void updateLeadStatus(lead.id, event.target.value)} className="rounded-md border border-[#E5E7EB] px-2 py-1">
                            {leadStatuses.map((status) => <option key={status}>{status}</option>)}
                          </select>
                        </td>
                        <td>{lead.whatsapp ? <a className="text-[#16A34A]" href={`https://wa.me/55${lead.whatsapp.replace(/\\D/g, "")}`} target="_blank">ABRIR WHATSAPP</a> : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filteredLeads.length && <Empty text="AINDA NÃO EXISTEM LEADS. Os novos cadastros enviados pelos formulários aparecerão aqui." />}
            </div>
          )}

          {active === "WhatsApp" && whatsapp && (
            <EditorCard title="WhatsApp Global">
              <label className="flex items-center gap-3"><input type="checkbox" checked={whatsapp.floating_enabled} onChange={(event) => setWhatsapp({ ...whatsapp, floating_enabled: event.target.checked })} /> Botão flutuante ativado</label>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="DDD" value={whatsapp.ddd ?? ""} onChange={(value) => setWhatsapp({ ...whatsapp, ddd: value })} />
                <Field label="Número" value={whatsapp.phone ?? ""} onChange={(value) => setWhatsapp({ ...whatsapp, phone: value })} />
              </div>
              <Field label="Mensagem inicial" value={whatsapp.initial_message ?? ""} onChange={(value) => setWhatsapp({ ...whatsapp, initial_message: value })} />
              <p className="text-sm text-[#6B7280]">O sistema monta automaticamente o link com 55 + DDD + número.</p>
            </EditorCard>
          )}

          {active === "Identidade Visual" && (
            <EditorCard title="Tokens visuais">
              <pre className="overflow-auto rounded-lg bg-[#F6F7F9] p-4 text-sm">{JSON.stringify(identity?.tokens ?? {}, null, 2)}</pre>
              <Empty text="Editor visual de cores e fontes preparado para os tokens globais do site." />
            </EditorCard>
          )}

          {active === "Métricas" && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Metric title="Visualizações" value={metrics.views} />
              <Metric title="Visitantes únicos" value={metrics.visitors} />
              <Metric title="Sessões" value={metrics.sessions} />
              <Metric title="Cliques no WhatsApp" value={metrics.whatsappClicks} />
              <Metric title="Leads" value={metrics.leads} />
              <Metric title="Taxa de conversão" value={metrics.conversion} />
            </div>
          )}

          {active === "Configurações" && (
            <EditorCard title="Segurança">
              <form onSubmit={saveSecurity} className="space-y-4">
                <Field label="E-mail de recuperação" value={security.recoveryEmail} onChange={(value) => setSecurity({ ...security, recoveryEmail: value })} />
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Senha atual" type="password" value={security.currentPassword} onChange={(value) => setSecurity({ ...security, currentPassword: value })} />
                  <Field label="Nova senha" type="password" value={security.newPassword} onChange={(value) => setSecurity({ ...security, newPassword: value })} />
                  <Field label="Confirmar nova senha" type="password" value={security.confirmPassword} onChange={(value) => setSecurity({ ...security, confirmPassword: value })} />
                </div>
                <button className="rounded-lg bg-[#2563EB] px-5 py-3 font-semibold text-white">ALTERAR SEGURANÇA</button>
              </form>
            </EditorCard>
          )}

          {!["Dashboard", "Leads", "WhatsApp", "Identidade Visual", "Métricas", "Configurações"].includes(active) && (
            <EditorCard title={active}>
              <Empty text="Área mantida no padrão do painel completo. Os dados ficam persistidos no Supabase e serão ligados aos componentes públicos na migração de conteúdo." />
            </EditorCard>
          )}

          <div className="fixed bottom-4 right-4 z-50 flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-lg">
            <span className="text-sm text-[#6B7280]">{feedback}</span>
            <button onClick={active === "WhatsApp" ? () => void saveWhatsapp() : () => setFeedback("Rascunho salvo")} className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-4 py-2 font-medium">
              <Save className="h-4 w-4" /> SALVAR RASCUNHO
            </button>
            <button onClick={() => setFeedback("Publicado com sucesso")} className="rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white">PUBLICAR ALTERAÇÕES</button>
          </div>
        </section>

        <aside className="hidden border-l border-[#E5E7EB] bg-white p-4 lg:block">
          <div className="mb-3 flex items-center justify-between">
            <strong>Prévia</strong>
            <span className="rounded-md bg-[#F6F7F9] px-2 py-1 text-xs">DESKTOP</span>
          </div>
          <iframe src="/ifrane-marrocos-tours.html?admin_preview=1" title="Prévia do site" className="h-[calc(100vh-72px)] w-full rounded-lg border border-[#E5E7EB]" />
          <a href="/ifrane-marrocos-tours.html?admin_preview=1" target="_blank" className="mt-3 flex items-center gap-2 text-sm text-[#2563EB]"><Eye className="h-4 w-4" /> ABRIR PRÉVIA MAIOR</a>
        </aside>
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
      <p className="text-sm text-[#6B7280]">{title}</p>
      <strong className="mt-2 block text-3xl">{value}</strong>
    </div>
  );
}

function Shortcut({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-xl border border-[#E5E7EB] bg-white p-5 text-left font-semibold text-[#2563EB]">{label}</button>;
}

function EditorCard({ title, children }: { title: string; children: ReactNode }) {
  return <div className="space-y-5 rounded-xl border border-[#E5E7EB] bg-white p-5"><h2 className="text-xl font-semibold">{title}</h2>{children}</div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#E5E7EB] px-3 outline-none focus:ring-2 focus:ring-[#2563EB]" />
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F6F7F9] p-6 text-sm text-[#6B7280]">{text}</div>;
}

export default AdminPanel;
