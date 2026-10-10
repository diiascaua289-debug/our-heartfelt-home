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
  Plus,
  Save,
  Search,
  Settings,
  Share2,
  Shield,
  Trash2,
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

type JsonMap = Record<string, unknown>;

type PageRow = {
  id: string;
  slug: string;
  title: string;
  route: string;
  status: "draft" | "published" | "archived";
  sort_order: number;
  is_home: boolean;
  draft_data: JsonMap;
  published_data: JsonMap;
};

type SectionRow = {
  id: string;
  page_id: string;
  section_key: string;
  name: string;
  type: string;
  sort_order: number;
  is_active: boolean;
  draft_data: JsonMap;
  published_data: JsonMap;
};

type ContentBlockRow = {
  id: string;
  section_id: string | null;
  block_key: string;
  type: string;
  label: string | null;
  sort_order: number;
  is_active: boolean;
  draft_content: JsonMap;
  published_content: JsonMap;
  style: JsonMap;
};

type ButtonRow = {
  id: string;
  section_id: string | null;
  button_key: string;
  label: string;
  destination_type: "url" | "anchor" | "whatsapp" | "page" | "email" | "phone";
  destination_value: string | null;
  open_new_tab: boolean;
  is_active: boolean;
  sort_order: number;
  style: JsonMap;
};

type MediaRow = {
  id: string;
  bucket: string;
  path: string;
  public_url: string | null;
  media_type: "image" | "video" | "logo" | "favicon" | "og_image" | "file";
  label: string | null;
  alt_text: string | null;
  caption: string | null;
  is_active: boolean;
  crop: JsonMap;
  metadata: JsonMap;
};

type FormRow = {
  id: string;
  page_id: string | null;
  section_id: string | null;
  name: string;
  form_key: string;
  fields: unknown[];
  success_message: string;
  is_active: boolean;
};

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
  id: string;
  event_name: string;
  page_path: string | null;
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
  tokens: JsonMap;
  fonts: JsonMap;
  assets: JsonMap;
};

type TrackingIntegration = {
  id: string;
  provider: string;
  name: string | null;
  public_config: JsonMap;
  secret_config: JsonMap;
  is_active: boolean;
};

type SeoSettings = {
  id: string;
  page_id: string | null;
  seo_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  indexable: boolean;
  og_title: string | null;
  og_description: string | null;
  redirects: unknown[];
};

type PublishedVersion = {
  id: string;
  version_number: number;
  note: string | null;
  created_at: string;
};

type AdminState = {
  pages: PageRow[];
  sections: SectionRow[];
  blocks: ContentBlockRow[];
  buttons: ButtonRow[];
  media: MediaRow[];
  forms: FormRow[];
  leads: Lead[];
  events: AnalyticsEvent[];
  whatsapp: WhatsAppSettings | null;
  identity: VisualIdentity | null;
  tracking: TrackingIntegration[];
  seo: SeoSettings[];
  versions: PublishedVersion[];
};

const emptyState: AdminState = {
  pages: [],
  sections: [],
  blocks: [],
  buttons: [],
  media: [],
  forms: [],
  leads: [],
  events: [],
  whatsapp: null,
  identity: null,
  tracking: [],
  seo: [],
  versions: [],
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

type MenuKey = (typeof menu)[number][0];

const leadStatuses = ["Novo", "Em contato", "Respondido", "Qualificado", "Convertido", "Arquivado"];
const destinationTypes = ["url", "anchor", "whatsapp", "page", "email", "phone"] as const;
const mediaTypes = ["image", "video", "logo", "favicon", "og_image", "file"] as const;

function AdminPanel() {
  const [token, setToken] = useState(() => getStoredAdminToken());
  const [password, setPassword] = useState("");
  const [active, setActive] = useState<MenuKey>("Dashboard");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("Tudo salvo");
  const [data, setData] = useState<AdminState>(emptyState);
  const [leadSearch, setLeadSearch] = useState("");
  const [security, setSecurity] = useState({ recoveryEmail: "", currentPassword: "", newPassword: "", confirmPassword: "" });
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [publishNote, setPublishNote] = useState("");

  const filteredLeads = useMemo(() => {
    const term = leadSearch.trim().toLowerCase();
    if (!term) return data.leads;
    return data.leads.filter((lead) =>
      [lead.name, lead.whatsapp, lead.email, lead.status, lead.source].filter(Boolean).some((value) => value!.toLowerCase().includes(term)),
    );
  }, [leadSearch, data.leads]);

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const pageViews = data.events.filter((event) => event.event_name === "PageView");
    const visitorIds = new Set(data.events.map((event) => event.visitor_id).filter(Boolean));
    const sessionIds = new Set(data.events.map((event) => event.session_id).filter(Boolean));
    const whatsappClicks = data.events.filter((event) => event.event_name === "WhatsAppClick").length;
    const topDevice = Object.entries(
      data.events.reduce<Record<string, number>>((acc, event) => {
        const key = event.device || "Indisponível";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1])[0]?.[0] || "Indisponível";

    return {
      views: pageViews.length,
      today: pageViews.filter((event) => event.created_at.startsWith(today)).length,
      sevenDays: pageViews.filter((event) => new Date(event.created_at).getTime() >= sevenDaysAgo).length,
      thirtyDays: pageViews.filter((event) => new Date(event.created_at).getTime() >= thirtyDaysAgo).length,
      visitors: visitorIds.size,
      sessions: sessionIds.size,
      leads: data.leads.length,
      newLeads: data.leads.filter((lead) => lead.status === "Novo").length,
      whatsappClicks,
      conversion: visitorIds.size ? `${Math.round((data.leads.length / visitorIds.size) * 100)}%` : "0%",
      topDevice,
    };
  }, [data.events, data.leads]);

  useEffect(() => {
    if (!token) return;
    void loadData(token);
    // loadData is intentionally called only when a stored/admin token appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadData(currentToken = token) {
    if (!currentToken) return;
    setLoading(true);
    try {
      const [pages, sections, blocks, buttons, media, forms, leads, events, whatsappRows, identityRows, tracking, seo, versions] = await Promise.all([
        adminTable<PageRow[]>("pages", { token: currentToken, query: "?select=*&order=sort_order.asc" }),
        adminTable<SectionRow[]>("sections", { token: currentToken, query: "?select=*&order=sort_order.asc" }),
        adminTable<ContentBlockRow[]>("content_blocks", { token: currentToken, query: "?select=*&order=sort_order.asc" }),
        adminTable<ButtonRow[]>("buttons", { token: currentToken, query: "?select=*&order=sort_order.asc" }),
        adminTable<MediaRow[]>("media", { token: currentToken, query: "?select=*&order=created_at.desc" }),
        adminTable<FormRow[]>("forms", { token: currentToken, query: "?select=*&order=created_at.desc" }),
        adminTable<Lead[]>("leads", { token: currentToken, query: "?select=*&deleted_at=is.null&order=created_at.desc" }),
        adminTable<AnalyticsEvent[]>("analytics_events", { token: currentToken, query: "?select=*&order=created_at.desc&limit=500" }),
        adminTable<WhatsAppSettings[]>("whatsapp_settings", { token: currentToken, query: "?select=*&limit=1" }),
        adminTable<VisualIdentity[]>("visual_identity", { token: currentToken, query: "?select=*&limit=1" }),
        adminTable<TrackingIntegration[]>("tracking_integrations", { token: currentToken, query: "?select=*&order=provider.asc" }),
        adminTable<SeoSettings[]>("seo_settings", { token: currentToken, query: "?select=*&order=created_at.desc" }),
        adminTable<PublishedVersion[]>("published_versions", { token: currentToken, query: "?select=id,version_number,note,created_at&order=version_number.desc&limit=20" }),
      ]);

      setData({
        pages,
        sections,
        blocks,
        buttons,
        media,
        forms,
        leads,
        events,
        whatsapp: whatsappRows[0] ?? null,
        identity: identityRows[0] ?? null,
        tracking,
        seo,
        versions,
      });
      setFeedback("Dados carregados");
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
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível entrar no painel.");
    } finally {
      setLoading(false);
    }
  }

  async function saveRow(table: Parameters<typeof adminTable>[0], id: string, body: unknown) {
    if (!token) return;
    setFeedback("Salvando...");
    await adminTable(table, { method: "PATCH", token, query: `?id=eq.${id}`, body });
    await loadData(token);
    setFeedback("Salvo no Supabase");
  }

  async function createRow(table: Parameters<typeof adminTable>[0], body: unknown) {
    if (!token) return;
    setFeedback("Criando...");
    await adminTable(table, { method: "POST", token, body });
    await loadData(token);
    setFeedback("Registro criado");
  }

  async function deleteRow(table: Parameters<typeof adminTable>[0], id: string) {
    if (!token || !window.confirm("Tem certeza que deseja excluir?")) return;
    setFeedback("Excluindo...");
    await adminTable(table, { method: "DELETE", token, query: `?id=eq.${id}` });
    await loadData(token);
    setFeedback("Registro excluído");
  }

  async function updateLeadStatus(id: string, status: string) {
    if (!token) return;
    await adminTable("leads", { method: "PATCH", token, query: `?id=eq.${id}`, body: { status } });
    setData((current) => ({ ...current, leads: current.leads.map((lead) => (lead.id === id ? { ...lead, status } : lead)) }));
    setFeedback("Lead atualizado");
  }

  async function archiveLead(id: string) {
    if (!token) return;
    await adminTable("leads", { method: "PATCH", token, query: `?id=eq.${id}`, body: { deleted_at: new Date().toISOString() } });
    await loadData(token);
    setFeedback("Lead removido da lista");
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

  async function publishSnapshot() {
    if (!token) return;
    setFeedback("Publicando...");
    const nextVersion = Math.max(0, ...data.versions.map((version) => version.version_number)) + 1;
    await Promise.all([
      ...data.pages.map((page) => adminTable("pages", { method: "PATCH", token, query: `?id=eq.${page.id}`, body: { published_data: page.draft_data, status: "published", published_at: new Date().toISOString() } })),
      ...data.sections.map((section) => adminTable("sections", { method: "PATCH", token, query: `?id=eq.${section.id}`, body: { published_data: section.draft_data } })),
      ...data.blocks.map((block) => adminTable("content_blocks", { method: "PATCH", token, query: `?id=eq.${block.id}`, body: { published_content: block.draft_content } })),
    ]);
    await adminTable("published_versions", {
      method: "POST",
      token,
      body: {
        version_number: nextVersion,
        note: publishNote || "Publicação manual pelo painel",
        snapshot: {
          pages: data.pages,
          sections: data.sections,
          blocks: data.blocks,
          buttons: data.buttons,
          media: data.media,
          forms: data.forms,
          whatsapp: data.whatsapp,
          identity: data.identity,
          tracking: data.tracking,
          seo: data.seo,
        },
      },
    });
    setPublishNote("");
    await loadData(token);
    setFeedback(`Publicado como versão ${nextVersion}`);
  }

  function exportLeads() {
    const header = ["Nome", "WhatsApp", "E-mail", "Origem", "Status", "Data"];
    const rows = filteredLeads.map((lead) => [lead.name, lead.whatsapp, lead.email, lead.source, lead.status, lead.created_at]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "leads.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const sectionOptions = data.sections.map((section) => ({ value: section.id, label: section.name }));
  const pageOptions = data.pages.map((page) => ({ value: page.id, label: page.title }));

  if (!token) {
    return (
      <main className="min-h-screen bg-[#F6F7F9] px-4 py-10 font-sans text-[#111827]">
        <form onSubmit={handleLogin} className="mx-auto mt-20 w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
          <Shield className="mb-5 h-10 w-10 text-[#2563EB]" />
          <h1 className="text-2xl font-semibold">PAINEL ADMINISTRATIVO</h1>
          <Field label="Senha" type="password" value={password} onChange={setPassword} />
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
              <span className="block text-xs text-gray-400">Ifrane Marrocos Tours</span>
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
            <button onClick={() => void loadData()} className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium">
              {loading ? "Carregando..." : "Recarregar"}
            </button>
          </div>

          {active === "Dashboard" && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Metric title="Visitas hoje" value={metrics.today} />
              <Metric title="Visitas em 7 dias" value={metrics.sevenDays} />
              <Metric title="Visitas em 30 dias" value={metrics.thirtyDays} />
              <Metric title="Leads novos" value={metrics.newLeads} />
              <Metric title="Total de leads" value={metrics.leads} />
              <Metric title="Cliques no WhatsApp" value={metrics.whatsappClicks} />
              <Metric title="Taxa de conversão" value={metrics.conversion} />
              <Shortcut label="EDITAR TEXTOS" onClick={() => setActive("Conteúdo")} />
              <Shortcut label="ALTERAR WHATSAPP" onClick={() => setActive("WhatsApp")} />
            </div>
          )}

          {active === "Conteúdo" && (
            <CrudSection
              title="Textos e blocos de conteúdo"
              onAdd={() => void createRow("content_blocks", { block_key: `bloco-${Date.now()}`, type: "text", label: "Novo bloco", draft_content: { title: "", text: "" }, published_content: {}, style: {}, sort_order: data.blocks.length + 1, is_active: true })}
            >
              {data.blocks.map((block) => (
                <EditorCard key={block.id} title={block.label || block.block_key}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <SelectField label="Seção" value={block.section_id ?? ""} options={[{ value: "", label: "Sem seção" }, ...sectionOptions]} onChange={(value) => updateBlock(block.id, { section_id: value || null })} />
                    <Field label="Chave" value={block.block_key} onChange={(value) => updateBlock(block.id, { block_key: value })} />
                    <Field label="Tipo" value={block.type} onChange={(value) => updateBlock(block.id, { type: value })} />
                  </div>
                  <Field label="Rótulo interno" value={block.label ?? ""} onChange={(value) => updateBlock(block.id, { label: value })} />
                  <JsonField label="Conteúdo editável" value={block.draft_content} onChange={(value) => updateBlock(block.id, { draft_content: value })} />
                  <JsonField label="Estilo" value={block.style} onChange={(value) => updateBlock(block.id, { style: value })} />
                  <RowActions onSave={() => void saveRow("content_blocks", block.id, cleanBlock(block))} onDelete={() => void deleteRow("content_blocks", block.id)} />
                </EditorCard>
              ))}
              {!data.blocks.length && <Empty text="Clique em ADICIONAR para criar o primeiro bloco de texto." />}
            </CrudSection>
          )}

          {active === "Seções" && (
            <CrudSection
              title="Seções do site"
              onAdd={() => void createRow("sections", { page_id: data.pages[0]?.id, section_key: `secao-${Date.now()}`, name: "Nova seção", type: "custom", sort_order: data.sections.length + 1, is_active: true, draft_data: {}, published_data: {} })}
            >
              {data.sections.map((section) => (
                <EditorCard key={section.id} title={section.name}>
                  <div className="grid gap-4 md:grid-cols-4">
                    <SelectField label="Página" value={section.page_id} options={pageOptions} onChange={(value) => updateSection(section.id, { page_id: value })} />
                    <Field label="Chave" value={section.section_key} onChange={(value) => updateSection(section.id, { section_key: value })} />
                    <Field label="Nome" value={section.name} onChange={(value) => updateSection(section.id, { name: value })} />
                    <NumberField label="Ordem" value={section.sort_order} onChange={(value) => updateSection(section.id, { sort_order: value })} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Tipo" value={section.type} onChange={(value) => updateSection(section.id, { type: value })} />
                    <ToggleField label="Ativa" checked={section.is_active} onChange={(value) => updateSection(section.id, { is_active: value })} />
                  </div>
                  <JsonField label="Dados editáveis da seção" value={section.draft_data} onChange={(value) => updateSection(section.id, { draft_data: value })} />
                  <RowActions onSave={() => void saveRow("sections", section.id, cleanSection(section))} onDelete={() => void deleteRow("sections", section.id)} />
                </EditorCard>
              ))}
              {!data.sections.length && <Empty text="Clique em ADICIONAR para criar seções editáveis do site." />}
            </CrudSection>
          )}

          {active === "Botões" && (
            <CrudSection
              title="Botões e CTAs"
              onAdd={() => void createRow("buttons", { section_id: data.sections[0]?.id ?? null, button_key: `botao-${Date.now()}`, label: "Novo botão", destination_type: "url", destination_value: "#", open_new_tab: false, is_active: true, sort_order: data.buttons.length + 1, style: {} })}
            >
              {data.buttons.map((button) => (
                <EditorCard key={button.id} title={button.label}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <SelectField label="Seção" value={button.section_id ?? ""} options={[{ value: "", label: "Sem seção" }, ...sectionOptions]} onChange={(value) => updateButton(button.id, { section_id: value || null })} />
                    <Field label="Chave" value={button.button_key} onChange={(value) => updateButton(button.id, { button_key: value })} />
                    <Field label="Texto do botão" value={button.label} onChange={(value) => updateButton(button.id, { label: value })} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    <SelectField label="Destino" value={button.destination_type} options={destinationTypes.map((item) => ({ value: item, label: item }))} onChange={(value) => updateButton(button.id, { destination_type: value as ButtonRow["destination_type"] })} />
                    <Field label="Valor do destino" value={button.destination_value ?? ""} onChange={(value) => updateButton(button.id, { destination_value: value })} />
                    <NumberField label="Ordem" value={button.sort_order} onChange={(value) => updateButton(button.id, { sort_order: value })} />
                    <ToggleField label="Ativo" checked={button.is_active} onChange={(value) => updateButton(button.id, { is_active: value })} />
                  </div>
                  <ToggleField label="Abrir em nova aba" checked={button.open_new_tab} onChange={(value) => updateButton(button.id, { open_new_tab: value })} />
                  <JsonField label="Estilo" value={button.style} onChange={(value) => updateButton(button.id, { style: value })} />
                  <RowActions onSave={() => void saveRow("buttons", button.id, cleanButton(button))} onDelete={() => void deleteRow("buttons", button.id)} />
                </EditorCard>
              ))}
              {!data.buttons.length && <Empty text="Clique em ADICIONAR para criar botões editáveis." />}
            </CrudSection>
          )}

          {active === "Mídia" && (
            <CrudSection
              title="Mídias por URL"
              onAdd={() => void createRow("media", { bucket: "site-media", path: `media-${Date.now()}`, public_url: "", media_type: "image", label: "Nova mídia", alt_text: "", caption: "", crop: {}, metadata: {}, is_active: true })}
            >
              {data.media.map((item) => (
                <EditorCard key={item.id} title={item.label || item.path}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <SelectField label="Tipo" value={item.media_type} options={mediaTypes.map((type) => ({ value: type, label: type }))} onChange={(value) => updateMedia(item.id, { media_type: value as MediaRow["media_type"] })} />
                    <Field label="Rótulo" value={item.label ?? ""} onChange={(value) => updateMedia(item.id, { label: value })} />
                    <Field label="Caminho/chave" value={item.path} onChange={(value) => updateMedia(item.id, { path: value })} />
                  </div>
                  <Field label="URL pública" value={item.public_url ?? ""} onChange={(value) => updateMedia(item.id, { public_url: value })} />
                  <Field label="Texto alternativo" value={item.alt_text ?? ""} onChange={(value) => updateMedia(item.id, { alt_text: value })} />
                  <Field label="Legenda" value={item.caption ?? ""} onChange={(value) => updateMedia(item.id, { caption: value })} />
                  {item.public_url && <img src={item.public_url} alt={item.alt_text ?? ""} className="max-h-48 rounded-lg border border-[#E5E7EB] object-contain" />}
                  <RowActions onSave={() => void saveRow("media", item.id, cleanMedia(item))} onDelete={() => void deleteRow("media", item.id)} />
                </EditorCard>
              ))}
              {!data.media.length && <Empty text="Clique em ADICIONAR para cadastrar imagens, logo, favicon, OG image ou vídeos por URL." />}
            </CrudSection>
          )}

          {active === "Formulários" && (
            <CrudSection
              title="Formulários"
              onAdd={() => void createRow("forms", { page_id: data.pages[0]?.id ?? null, section_id: data.sections[0]?.id ?? null, name: "Formulário de contato", form_key: `form-${Date.now()}`, fields: [{ name: "name", label: "Nome", type: "text", required: true }, { name: "whatsapp", label: "WhatsApp", type: "tel", required: true }], success_message: "Mensagem enviada com sucesso.", is_active: true })}
            >
              {data.forms.map((form) => (
                <EditorCard key={form.id} title={form.name}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Nome" value={form.name} onChange={(value) => updateForm(form.id, { name: value })} />
                    <Field label="Chave" value={form.form_key} onChange={(value) => updateForm(form.id, { form_key: value })} />
                    <ToggleField label="Ativo" checked={form.is_active} onChange={(value) => updateForm(form.id, { is_active: value })} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <SelectField label="Página" value={form.page_id ?? ""} options={[{ value: "", label: "Sem página" }, ...pageOptions]} onChange={(value) => updateForm(form.id, { page_id: value || null })} />
                    <SelectField label="Seção" value={form.section_id ?? ""} options={[{ value: "", label: "Sem seção" }, ...sectionOptions]} onChange={(value) => updateForm(form.id, { section_id: value || null })} />
                  </div>
                  <Field label="Mensagem de sucesso" value={form.success_message} onChange={(value) => updateForm(form.id, { success_message: value })} />
                  <JsonField label="Campos do formulário" value={form.fields} onChange={(value) => updateForm(form.id, { fields: Array.isArray(value) ? value : [] })} />
                  <RowActions onSave={() => void saveRow("forms", form.id, cleanForm(form))} onDelete={() => void deleteRow("forms", form.id)} />
                </EditorCard>
              ))}
              {!data.forms.length && <Empty text="Clique em ADICIONAR para criar um formulário ligado aos leads." />}
            </CrudSection>
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
                        <td className="space-x-3">
                          {lead.whatsapp && <a className="text-[#16A34A]" href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, "")}`} target="_blank">WhatsApp</a>}
                          <button className="text-[#DC2626]" onClick={() => void archiveLead(lead.id)}>Arquivar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filteredLeads.length && <Empty text="Ainda não existem leads. Os novos cadastros enviados pelos formulários aparecerão aqui." />}
            </div>
          )}

          {active === "WhatsApp" && data.whatsapp && (
            <EditorCard title="WhatsApp Global">
              <ToggleField label="Botão flutuante ativado" checked={data.whatsapp.floating_enabled} onChange={(value) => updateWhatsapp({ floating_enabled: value })} />
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Código do país" value={data.whatsapp.country_code} onChange={(value) => updateWhatsapp({ country_code: value })} />
                <Field label="DDD" value={data.whatsapp.ddd ?? ""} onChange={(value) => updateWhatsapp({ ddd: value })} />
                <Field label="Número" value={data.whatsapp.phone ?? ""} onChange={(value) => updateWhatsapp({ phone: value })} />
              </div>
              <Field label="Mensagem inicial" value={data.whatsapp.initial_message ?? ""} onChange={(value) => updateWhatsapp({ initial_message: value })} />
              <RowActions onSave={() => void saveRow("whatsapp_settings", data.whatsapp!.id, cleanWhatsapp(data.whatsapp!))} />
            </EditorCard>
          )}

          {active === "Identidade Visual" && data.identity && (
            <EditorCard title="Identidade visual">
              <JsonField label="Cores e tokens" value={data.identity.tokens} onChange={(value) => updateIdentity({ tokens: asMap(value) })} />
              <JsonField label="Fontes" value={data.identity.fonts} onChange={(value) => updateIdentity({ fonts: asMap(value) })} />
              <JsonField label="Assets globais" value={data.identity.assets} onChange={(value) => updateIdentity({ assets: asMap(value) })} />
              <RowActions onSave={() => void saveRow("visual_identity", data.identity!.id, cleanIdentity(data.identity!))} />
            </EditorCard>
          )}

          {active === "Métricas" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Metric title="Visualizações" value={metrics.views} />
                <Metric title="Visitantes únicos" value={metrics.visitors} />
                <Metric title="Sessões" value={metrics.sessions} />
                <Metric title="Cliques no WhatsApp" value={metrics.whatsappClicks} />
                <Metric title="Leads" value={metrics.leads} />
                <Metric title="Dispositivo principal" value={metrics.topDevice} />
              </div>
              <EditorCard title="Últimos eventos">
                <div className="max-h-96 overflow-auto text-sm">
                  {data.events.map((event) => (
                    <div key={event.id} className="grid gap-2 border-b border-[#E5E7EB] py-3 md:grid-cols-4">
                      <strong>{event.event_name}</strong>
                      <span>{event.page_path || "-"}</span>
                      <span>{event.device || "-"}</span>
                      <span>{new Date(event.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                  {!data.events.length && <Empty text="Nenhum evento registrado ainda." />}
                </div>
              </EditorCard>
            </div>
          )}

          {active === "Rastreamento" && (
            <CrudSection
              title="Pixels e integrações"
              onAdd={() => void createRow("tracking_integrations", { provider: "Meta Pixel", name: "Novo rastreamento", public_config: { pixel_id: "" }, secret_config: {}, is_active: false })}
            >
              {data.tracking.map((item) => (
                <EditorCard key={item.id} title={item.name || item.provider}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Provedor" value={item.provider} onChange={(value) => updateTracking(item.id, { provider: value })} />
                    <Field label="Nome" value={item.name ?? ""} onChange={(value) => updateTracking(item.id, { name: value })} />
                    <ToggleField label="Ativo" checked={item.is_active} onChange={(value) => updateTracking(item.id, { is_active: value })} />
                  </div>
                  <JsonField label="Configuração pública" value={item.public_config} onChange={(value) => updateTracking(item.id, { public_config: asMap(value) })} />
                  <JsonField label="Configuração secreta" value={item.secret_config} onChange={(value) => updateTracking(item.id, { secret_config: asMap(value) })} />
                  <RowActions onSave={() => void saveRow("tracking_integrations", item.id, cleanTracking(item))} onDelete={() => void deleteRow("tracking_integrations", item.id)} />
                </EditorCard>
              ))}
              {!data.tracking.length && <Empty text="Clique em ADICIONAR para configurar Meta Pixel, GA4, GTM, TikTok, Clarity ou Ads." />}
            </CrudSection>
          )}

          {active === "SEO e Compartilhamento" && (
            <CrudSection
              title="SEO por página"
              onAdd={() => void createRow("seo_settings", { page_id: data.pages[0]?.id ?? null, seo_title: "", meta_description: "", canonical_url: "", indexable: true, og_title: "", og_description: "", redirects: [] })}
            >
              {data.seo.map((item) => (
                <EditorCard key={item.id} title={item.seo_title || "SEO"}>
                  <SelectField label="Página" value={item.page_id ?? ""} options={[{ value: "", label: "Sem página" }, ...pageOptions]} onChange={(value) => updateSeo(item.id, { page_id: value || null })} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Título SEO" value={item.seo_title ?? ""} onChange={(value) => updateSeo(item.id, { seo_title: value })} />
                    <Field label="Canônica" value={item.canonical_url ?? ""} onChange={(value) => updateSeo(item.id, { canonical_url: value })} />
                  </div>
                  <TextAreaField label="Meta descrição" value={item.meta_description ?? ""} onChange={(value) => updateSeo(item.id, { meta_description: value })} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Título OG" value={item.og_title ?? ""} onChange={(value) => updateSeo(item.id, { og_title: value })} />
                    <ToggleField label="Indexável no Google" checked={item.indexable} onChange={(value) => updateSeo(item.id, { indexable: value })} />
                  </div>
                  <TextAreaField label="Descrição OG" value={item.og_description ?? ""} onChange={(value) => updateSeo(item.id, { og_description: value })} />
                  <JsonField label="Redirecionamentos" value={item.redirects} onChange={(value) => updateSeo(item.id, { redirects: Array.isArray(value) ? value : [] })} />
                  <RowActions onSave={() => void saveRow("seo_settings", item.id, cleanSeo(item))} onDelete={() => void deleteRow("seo_settings", item.id)} />
                </EditorCard>
              ))}
              {!data.seo.length && <Empty text="Clique em ADICIONAR para criar configuração SEO da página." />}
            </CrudSection>
          )}

          {active === "Publicações" && (
            <EditorCard title="Publicar alterações">
              <TextAreaField label="Observação da versão" value={publishNote} onChange={setPublishNote} />
              <button onClick={() => void publishSnapshot()} className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-5 py-3 font-semibold text-white">
                <Upload className="h-4 w-4" /> PUBLICAR AGORA
              </button>
              <div className="space-y-2">
                {data.versions.map((version) => (
                  <div key={version.id} className="rounded-lg border border-[#E5E7EB] p-3 text-sm">
                    <strong>Versão {version.version_number}</strong>
                    <span className="ml-2 text-[#6B7280]">{new Date(version.created_at).toLocaleString("pt-BR")}</span>
                    <p className="text-[#6B7280]">{version.note || "Sem observação"}</p>
                  </div>
                ))}
                {!data.versions.length && <Empty text="Nenhuma versão publicada ainda." />}
              </div>
            </EditorCard>
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

          <div className="fixed bottom-4 right-4 z-50 flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-lg">
            <span className="text-sm text-[#6B7280]">{feedback}</span>
            <button onClick={() => void publishSnapshot()} className="flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white">
              <Save className="h-4 w-4" /> PUBLICAR ALTERAÇÕES
            </button>
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

  function updatePage(id: string, patch: Partial<PageRow>) {
    setData((current) => ({ ...current, pages: current.pages.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  }

  function updateSection(id: string, patch: Partial<SectionRow>) {
    setData((current) => ({ ...current, sections: current.sections.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  }

  function updateBlock(id: string, patch: Partial<ContentBlockRow>) {
    setData((current) => ({ ...current, blocks: current.blocks.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  }

  function updateButton(id: string, patch: Partial<ButtonRow>) {
    setData((current) => ({ ...current, buttons: current.buttons.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  }

  function updateMedia(id: string, patch: Partial<MediaRow>) {
    setData((current) => ({ ...current, media: current.media.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  }

  function updateForm(id: string, patch: Partial<FormRow>) {
    setData((current) => ({ ...current, forms: current.forms.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  }

  function updateWhatsapp(patch: Partial<WhatsAppSettings>) {
    setData((current) => ({ ...current, whatsapp: current.whatsapp ? { ...current.whatsapp, ...patch } : current.whatsapp }));
  }

  function updateIdentity(patch: Partial<VisualIdentity>) {
    setData((current) => ({ ...current, identity: current.identity ? { ...current.identity, ...patch } : current.identity }));
  }

  function updateTracking(id: string, patch: Partial<TrackingIntegration>) {
    setData((current) => ({ ...current, tracking: current.tracking.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  }

  function updateSeo(id: string, patch: Partial<SeoSettings>) {
    setData((current) => ({ ...current, seo: current.seo.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  }
}

function cleanPage(row: PageRow) {
  return pick(row, ["slug", "title", "route", "status", "sort_order", "is_home", "draft_data", "published_data"]);
}

function cleanSection(row: SectionRow) {
  return pick(row, ["page_id", "section_key", "name", "type", "sort_order", "is_active", "draft_data", "published_data"]);
}

function cleanBlock(row: ContentBlockRow) {
  return pick(row, ["section_id", "block_key", "type", "label", "sort_order", "is_active", "draft_content", "published_content", "style"]);
}

function cleanButton(row: ButtonRow) {
  return pick(row, ["section_id", "button_key", "label", "destination_type", "destination_value", "open_new_tab", "is_active", "sort_order", "style"]);
}

function cleanMedia(row: MediaRow) {
  return pick(row, ["bucket", "path", "public_url", "media_type", "label", "alt_text", "caption", "crop", "metadata", "is_active"]);
}

function cleanForm(row: FormRow) {
  return pick(row, ["page_id", "section_id", "name", "form_key", "fields", "success_message", "is_active"]);
}

function cleanWhatsapp(row: WhatsAppSettings) {
  return pick(row, ["floating_enabled", "country_code", "ddd", "phone", "initial_message"]);
}

function cleanIdentity(row: VisualIdentity) {
  return pick(row, ["tokens", "fonts", "assets"]);
}

function cleanTracking(row: TrackingIntegration) {
  return pick(row, ["provider", "name", "public_config", "secret_config", "is_active"]);
}

function cleanSeo(row: SeoSettings) {
  return pick(row, ["page_id", "seo_title", "meta_description", "canonical_url", "indexable", "og_title", "og_description", "redirects"]);
}

function pick<T extends object, K extends keyof T>(row: T, keys: K[]) {
  return keys.reduce((acc, key) => ({ ...acc, [key]: row[key] }), {} as Pick<T, K>);
}

function asMap(value: unknown): JsonMap {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonMap : {};
}

function CrudSection({ title, onAdd, children }: { title: string; onAdd: () => void; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button onClick={onAdd} className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white">
          <Plus className="h-4 w-4" /> ADICIONAR
        </button>
      </div>
      {children}
    </section>
  );
}

function RowActions({ onSave, onDelete }: { onSave: () => void; onDelete?: () => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      <button onClick={onSave} className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white">
        <Save className="h-4 w-4" /> SALVAR
      </button>
      {onDelete && (
        <button onClick={onDelete} className="inline-flex items-center gap-2 rounded-lg border border-[#FCA5A5] px-4 py-2 font-semibold text-[#DC2626]">
          <Trash2 className="h-4 w-4" /> EXCLUIR
        </button>
      )}
    </div>
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

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label} type="number" value={String(value)} onChange={(next) => onChange(Number(next) || 0)} />;
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-28 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 outline-none focus:ring-2 focus:ring-[#2563EB]" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#E5E7EB] px-3 outline-none focus:ring-2 focus:ring-[#2563EB]">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-lg border border-[#E5E7EB] px-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

function JsonField({ label, value, onChange }: { label: string; value: unknown; onChange: (value: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = useState("");

  useEffect(() => {
    setText(JSON.stringify(value ?? {}, null, 2));
    setError("");
  }, [value]);

  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <textarea
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          try {
            onChange(JSON.parse(next || "{}"));
            setError("");
          } catch {
            setError("JSON inválido. Corrija antes de salvar.");
          }
        }}
        className="mt-2 min-h-36 w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-[#2563EB]"
      />
      {error && <span className="mt-1 block text-sm text-[#DC2626]">{error}</span>}
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F6F7F9] p-6 text-sm text-[#6B7280]">{text}</div>;
}

export default AdminPanel;
