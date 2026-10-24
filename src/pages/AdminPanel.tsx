import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3, Check, ChevronDown, ExternalLink, FileText, Image, LayoutDashboard,
  Link2, Loader2, LogOut, MessageCircle, Palette, RefreshCw, Save, Search,
  Plus, Settings, Shield, Trash2, Upload, Users,
} from "lucide-react";
import {
  adminRpc, adminTable, clearAdminToken, getStoredAdminToken, loginAdmin, storeAdminToken,
  uploadAdminMedia, uploadNewAdminImage,
} from "@/lib/adminApi";

type JsonMap = Record<string, unknown>;
type SectionRow = { id: string; section_key: string; name: string; sort_order: number; is_active: boolean; draft_data: JsonMap };
type ContentBlockRow = { id: string; section_id: string | null; block_key: string; type: string; label: string | null; sort_order: number; is_active: boolean; draft_content: JsonMap; style: JsonMap };
type ButtonRow = { id: string; section_id: string | null; button_key: string; label: string; destination_type: "url" | "anchor" | "whatsapp" | "page" | "email" | "phone"; destination_value: string | null; open_new_tab: boolean; is_active: boolean; sort_order: number };
type MediaRow = { id: string; bucket: string; path: string; public_url: string | null; media_type: "image" | "video" | "logo" | "favicon" | "og_image" | "file"; label: string | null; alt_text: string | null; caption: string | null; is_active: boolean };
type UploadedImage = { public_url: string; path: string; media_type: "image"; label: string; alt_text: string };
type FormField = { name?: string; label?: string; type?: string; required?: boolean };
type FormRow = { id: string; name: string; form_key: string; fields: FormField[]; success_message: string; is_active: boolean };
type Lead = { id: string; name: string | null; whatsapp: string | null; email: string | null; status: string; source: string | null; created_at: string };
type AnalyticsEvent = { id: string; event_name: string; visitor_id: string | null; session_id: string | null; device: string | null; created_at: string };
type WhatsAppSettings = { id: string; floating_enabled: boolean; country_code: string; ddd: string | null; phone: string | null; initial_message: string | null };
type VisualIdentity = { id: string; tokens: JsonMap; fonts: JsonMap; assets: JsonMap };
type TrackingIntegration = { id: string; provider: string; name: string | null; public_config: JsonMap; is_active: boolean };
type SeoSettings = { id: string; seo_title: string | null; meta_description: string | null; canonical_url: string | null; indexable: boolean; og_title: string | null; og_description: string | null };
type AdminState = { sections: SectionRow[]; blocks: ContentBlockRow[]; buttons: ButtonRow[]; media: MediaRow[]; forms: FormRow[]; leads: Lead[]; events: AnalyticsEvent[]; whatsapp: WhatsAppSettings | null; identity: VisualIdentity | null; tracking: TrackingIntegration[]; seo: SeoSettings | null };

const emptyState: AdminState = { sections: [], blocks: [], buttons: [], media: [], forms: [], leads: [], events: [], whatsapp: null, identity: null, tracking: [], seo: null };
const navigation = [
  ["resumo", "Resumo", LayoutDashboard], ["textos", "Textos do site", FileText],
  ["botoes", "Botões e links", Link2], ["imagens", "Imagens e vídeos", Image],
  ["formulario", "Formulário", FileText], ["leads", "Leads", Users],
  ["whatsapp", "WhatsApp", MessageCircle], ["aparencia", "Aparência", Palette],
  ["seo", "SEO e pixels", BarChart3], ["seguranca", "Segurança", Settings],
] as const;
type PageKey = (typeof navigation)[number][0];
const leadStatuses = ["Novo", "Em contato", "Respondido", "Qualificado", "Convertido", "Arquivado"];
type TextComposer = { sectionId: string; text: string; imageUrl: string; imageAlt: string; afterBlockKey: string | null };

const pairedImageSections = new Set(["hoteis", "galeria", "pacotes"]);
const inclusionDefaults = [
  { key: "cms-text-incluso-020", text: "Reservas de hotéis", order: 20 },
  { key: "cms-text-incluso-021", text: "Reservas de cruzeiros", order: 21 },
  { key: "cms-text-incluso-022", text: "Passagens aéreas", order: 22 },
];

function sectionNameFromKey(sectionKey: string) {
  return sectionKey.replace(/^cms-/, "");
}

function pairedImagePathForBlock(block: ContentBlockRow) {
  const match = block.block_key.match(/^cms-text-(hoteis|galeria|pacotes)-(\d+)$/);
  if (!match) return null;
  const section = match[1];
  const index = Number(match[2]);
  const mediaIndex = section === "hoteis" && index >= 4 && index <= 9
    ? index - 3
    : section === "galeria" && index >= 3 && index <= 22
      ? index - 2
      : section === "pacotes" && index === 4
        ? 1
        : section === "pacotes" && index === 13
          ? 2
          : null;
  return mediaIndex === null ? null : `cms-media-${section}-${String(mediaIndex).padStart(2, "0")}`;
}

function supportsPairedImages(sectionKey: string) {
  return pairedImageSections.has(sectionNameFromKey(sectionKey));
}

function AdminPanel() {
  const [token, setToken] = useState(() => getStoredAdminToken());
  const [password, setPassword] = useState("");
  const [active, setActive] = useState<PageKey>("resumo");
  const [data, setData] = useState<AdminState>(emptyState);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("Pronto para editar");
  const [search, setSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [textComposer, setTextComposer] = useState<TextComposer | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [security, setSecurity] = useState({ recoveryEmail: "", currentPassword: "", newPassword: "", confirmPassword: "" });

  useEffect(() => {
    if (token) void loadData(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const blocksBySection = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return data.sections.map((section) => ({
      section,
      blocks: data.blocks.filter((block) => {
        if (block.section_id !== section.id) return false;
        if (!term) return true;
        return `${block.label ?? ""} ${String(block.draft_content.text ?? "")}`.toLocaleLowerCase("pt-BR").includes(term);
      }).sort((first, second) => first.sort_order - second.sort_order),
    })).filter((group) => group.blocks.length > 0 || group.section.name.toLocaleLowerCase("pt-BR").includes(term));
  }, [data.blocks, data.sections, search]);

  const buttonsBySection = useMemo(() => data.sections.map((section) => ({
    section, buttons: data.buttons.filter((button) => button.section_id === section.id),
  })).filter((group) => group.buttons.length), [data.buttons, data.sections]);

  const filteredLeads = useMemo(() => {
    const term = leadSearch.trim().toLocaleLowerCase("pt-BR");
    if (!term) return data.leads;
    return data.leads.filter((lead) => [lead.name, lead.whatsapp, lead.email, lead.status, lead.source]
      .filter(Boolean).some((value) => value!.toLocaleLowerCase("pt-BR").includes(term)));
  }, [data.leads, leadSearch]);

  const metrics = useMemo(() => {
    const pageViews = data.events.filter((event) => event.event_name === "PageView");
    const today = new Date().toISOString().slice(0, 10);
    return {
      today: pageViews.filter((event) => event.created_at.startsWith(today)).length,
      views: pageViews.length,
      visitors: new Set(data.events.map((event) => event.visitor_id).filter(Boolean)).size,
      sessions: new Set(data.events.map((event) => event.session_id).filter(Boolean)).size,
      leads: data.leads.length,
      whatsapp: data.events.filter((event) => event.event_name === "WhatsAppClick").length,
    };
  }, [data.events, data.leads]);

  async function loadData(currentToken = token) {
    if (!currentToken) return;
    setLoading(true);
    try {
      const [sections, blocks, buttons, media, forms, leads, events, whatsappRows, identityRows, tracking, seoRows] = await Promise.all([
        adminTable<SectionRow[]>("sections", { token: currentToken, query: "?select=*&section_key=like.cms-*&is_active=eq.true&order=sort_order.asc" }),
        adminTable<ContentBlockRow[]>("content_blocks", { token: currentToken, query: "?select=*&block_key=like.cms-text-*&is_active=eq.true&order=sort_order.asc" }),
        adminTable<ButtonRow[]>("buttons", { token: currentToken, query: "?select=*&button_key=like.cms-link-*&is_active=eq.true&order=sort_order.asc" }),
        adminTable<MediaRow[]>("media", { token: currentToken, query: "?select=*&is_active=eq.true&order=created_at.asc" }),
        adminTable<FormRow[]>("forms", { token: currentToken, query: "?select=*&order=created_at.asc" }),
        adminTable<Lead[]>("leads", { token: currentToken, query: "?select=*&deleted_at=is.null&order=created_at.desc" }),
        adminTable<AnalyticsEvent[]>("analytics_events", { token: currentToken, query: "?select=*&order=created_at.desc&limit=500" }),
        adminTable<WhatsAppSettings[]>("whatsapp_settings", { token: currentToken, query: "?select=*&limit=1" }),
        adminTable<VisualIdentity[]>("visual_identity", { token: currentToken, query: "?select=*&limit=1" }),
        adminTable<TrackingIntegration[]>("tracking_integrations", { token: currentToken, query: "?select=*&order=provider.asc" }),
        adminTable<SeoSettings[]>("seo_settings", { token: currentToken, query: "?select=*&limit=1" }),
      ]);
      const includedSection = sections.find((section) => sectionNameFromKey(section.section_key) === "incluso");
      const missingInclusions = includedSection
        ? inclusionDefaults.filter((item) => !blocks.some((block) => block.block_key === item.key)).map((item) => ({
          id: `pending:${item.key}`,
          section_id: includedSection.id,
          block_key: item.key,
          type: "text",
          label: item.text,
          sort_order: item.order,
          is_active: true,
          draft_content: { text: item.text },
          style: { section_key: includedSection.section_key },
        } satisfies ContentBlockRow))
        : [];
      setData({ sections, blocks: [...blocks.filter((block) => block.style?.removed !== true), ...missingInclusions], buttons, media, forms, leads, events, whatsapp: whatsappRows[0] ?? null, identity: identityRows[0] ?? null, tracking, seo: seoRows[0] ?? null });
      setFeedback("Tudo carregado");
    } catch (error) {
      setFeedback(messageFrom(error, "Não foi possível carregar o painel."));
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
      setFeedback("Você entrou no painel");
    } catch (error) {
      setFeedback(messageFrom(error, "Não foi possível entrar."));
    } finally {
      setLoading(false);
    }
  }

  async function saveAction(key: string, action: () => Promise<unknown>, success = "Alterações salvas no site") {
    setSaving(key);
    setFeedback("Salvando...");
    try {
      await action();
      setFeedback(success);
      await loadData();
      return true;
    } catch (error) {
      setFeedback(messageFrom(error, "Não foi possível salvar."));
      return false;
    } finally {
      setSaving(null);
    }
  }

  async function saveTextSection(section: SectionRow, blocks: ContentBlockRow[]) {
    if (!token) return;
    await saveAction(`section-${section.id}`, async () => {
      await Promise.all([
        adminTable("sections", { method: "PATCH", token, query: `?id=eq.${section.id}`, body: { name: section.name, sort_order: section.sort_order, is_active: section.is_active, draft_data: section.draft_data, published_data: section.draft_data } }),
        ...blocks.map((block) => block.id.startsWith("pending:")
          ? adminTable("content_blocks", { method: "POST", token, body: { section_id: block.section_id, block_key: block.block_key, type: block.type, label: block.label, sort_order: block.sort_order, is_active: block.is_active, draft_content: block.draft_content, published_content: block.draft_content, style: block.style } })
          : adminTable("content_blocks", { method: "PATCH", token, query: `?id=eq.${block.id}`, body: { label: block.label, sort_order: block.sort_order, is_active: block.is_active, draft_content: block.draft_content, published_content: block.draft_content, style: block.style } })),
      ]);
    });
  }

  function startAddingText(section: SectionRow, afterBlock: ContentBlockRow | null) {
    setTextComposer({ sectionId: section.id, text: "", imageUrl: "", imageAlt: "", afterBlockKey: afterBlock?.block_key ?? null });
  }

  async function addTextBlock(section: SectionRow) {
    if (!token || textComposer?.sectionId !== section.id) return;
    const text = textComposer.text.trim();
    if (!text) {
      setFeedback("Escreva o novo texto antes de adicionar.");
      return;
    }
    if (supportsPairedImages(section.section_key) && !textComposer.imageUrl) {
      setFeedback("Escolha a imagem que corresponde a este novo item.");
      return;
    }

    const sectionBlocks = data.blocks
      .filter((block) => block.section_id === section.id)
      .sort((first, second) => first.sort_order - second.sort_order);
    const inheritedBlock = sectionBlocks.find((block) => block.block_key === textComposer.afterBlockKey) ?? null;
    const sortOrder = inheritedBlock
      ? inheritedBlock.sort_order + 1
      : Math.max(0, ...sectionBlocks.map((block) => block.sort_order)) + 1;
    const blocksToMove = sectionBlocks.filter((block) => block.sort_order >= sortOrder);
    const blockKey = `cms-text-user-${crypto.randomUUID().replace(/-/g, "")}`;

    const saved = await saveAction(`text-add-${section.id}`, async () => {
      await Promise.all(blocksToMove.map((block) => adminTable("content_blocks", {
        method: "PATCH",
        token,
        query: `?id=eq.${block.id}`,
        body: { sort_order: block.sort_order + 1 },
      })));
      await adminTable<ContentBlockRow[]>("content_blocks", {
        method: "POST",
        token,
        body: {
          section_id: section.id,
          block_key: blockKey,
          type: text.length > 90 ? "textarea" : "text",
          label: `Novo texto ${sectionBlocks.filter((block) => block.style?.dynamic === true).length + 1}`,
          sort_order: sortOrder,
          is_active: true,
          draft_content: { text, ...(textComposer.imageUrl ? { image_url: textComposer.imageUrl, image_alt: textComposer.imageAlt || text } : {}) },
          published_content: { text, ...(textComposer.imageUrl ? { image_url: textComposer.imageUrl, image_alt: textComposer.imageAlt || text } : {}) },
          style: {
            dynamic: true,
            section_key: section.section_key,
            inherit_from: inheritedBlock?.block_key ?? null,
            placement: "after",
          },
        },
      });
    }, "Novo texto adicionado ao site");
    if (saved) setTextComposer(null);
  }

  async function removeTextBlock(block: ContentBlockRow) {
    if (!token || !window.confirm("Remover este texto do site?")) return;
    const removedContent = { ...block.draft_content, removed: true };
    const body = {
      section_id: block.section_id,
      block_key: block.block_key,
      type: block.type,
      label: block.label,
      sort_order: block.sort_order,
      is_active: true,
      draft_content: removedContent,
      published_content: removedContent,
      style: { ...block.style, removed: true },
    };
    await saveAction(`text-remove-${block.id}`, () => adminTable("content_blocks", block.id.startsWith("pending:")
      ? { method: "POST", token, body }
      : { method: "PATCH", token, query: `?id=eq.${block.id}`, body }), "Texto removido do site");
  }

  async function updateLeadStatus(id: string, status: string) {
    if (!token) return;
    try {
      await adminTable("leads", { method: "PATCH", token, query: `?id=eq.${id}`, body: { status } });
      setData((current) => ({ ...current, leads: current.leads.map((lead) => lead.id === id ? { ...lead, status } : lead) }));
      setFeedback("Lead atualizado");
    } catch (error) {
      setFeedback(messageFrom(error, "Não foi possível atualizar o lead."));
    }
  }

  async function replaceMedia(item: MediaRow, file: File, blockId?: string) {
    if (!token) return;
    const expectsVideo = item.media_type === "video";
    if ((expectsVideo && !file.type.startsWith("video/")) || (!expectsVideo && !file.type.startsWith("image/"))) {
      setFeedback(expectsVideo ? "Escolha um arquivo de vídeo." : "Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setFeedback("O arquivo deve ter no máximo 50 MB.");
      return;
    }
    const key = `media-upload-${item.id}`;
    setSaving(key);
    setFeedback("Enviando mídia...");
    try {
      const updated = await uploadAdminMedia<MediaRow>(item.id, file, token);
      setData((current) => ({
        ...current,
        media: current.media.map((media) => media.id === updated.id ? { ...media, ...updated } : media),
        blocks: blockId ? current.blocks.map((block) => block.id === blockId ? {
          ...block,
          draft_content: { ...block.draft_content, image_url: updated.public_url, image_alt: updated.alt_text ?? block.draft_content.text ?? "" },
        } : block) : current.blocks,
      }));
      setFeedback("Imagem atualizada e vinculada ao texto");
    } catch (error) {
      setFeedback(messageFrom(error, "Não foi possível enviar a imagem."));
    } finally {
      setSaving(null);
    }
  }

  async function removeMedia(item: MediaRow) {
    if (!token || !window.confirm(`Remover ${item.media_type === "video" ? "este vídeo" : "esta imagem"} do site?`)) return;
    await saveAction(`media-remove-${item.id}`, () => adminTable("media", {
      method: "PATCH",
      token,
      query: `?id=eq.${item.id}`,
      body: { is_active: false },
    }), "Mídia removida do site");
  }

  async function saveSecurity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (security.newPassword && security.newPassword !== security.confirmPassword) {
      setFeedback("A confirmação da senha não confere.");
      return;
    }
    await saveAction("security", async () => {
      if (security.recoveryEmail) await adminRpc("admin_save_recovery_email", token, { recoveryEmail: security.recoveryEmail });
      if (security.currentPassword && security.newPassword) {
        const result = await adminRpc<{ ok: boolean; error?: string }>("admin_change_password", token, { currentPassword: security.currentPassword, newPassword: security.newPassword });
        if (!result.ok) throw new Error(result.error || "Não foi possível trocar a senha.");
        setMustChangePassword(false);
      }
      setSecurity((current) => ({ ...current, currentPassword: "", newPassword: "", confirmPassword: "" }));
    }, "Segurança atualizada");
  }

  function updateBlock(id: string, text: string) {
    setData((current) => ({ ...current, blocks: current.blocks.map((block) => block.id === id ? { ...block, draft_content: { ...block.draft_content, text } } : block) }));
  }
  function updateBlockImage(id: string, image: Pick<MediaRow, "public_url" | "alt_text"> | null) {
    setData((current) => ({ ...current, blocks: current.blocks.map((block) => block.id === id ? {
      ...block,
      draft_content: { ...block.draft_content, image_url: image?.public_url ?? null, image_alt: image?.alt_text ?? "" },
    } : block) }));
  }
  async function uploadContentImage(file: File, onUploaded: (image: UploadedImage) => void) {
    if (!token) return;
    setSaving("content-image-upload");
    setFeedback("Enviando imagem...");
    try {
      const image = await uploadNewAdminImage<UploadedImage>(file, token);
      onUploaded(image);
      setFeedback("Imagem enviada e vinculada ao texto");
    } catch (error) {
      setFeedback(messageFrom(error, "Não foi possível enviar a imagem."));
    } finally {
      setSaving(null);
    }
  }
  function updateButton(id: string, patch: Partial<ButtonRow>) {
    setData((current) => ({ ...current, buttons: current.buttons.map((button) => button.id === id ? { ...button, ...patch } : button) }));
  }
  function updateForm(id: string, patch: Partial<FormRow>) {
    setData((current) => ({ ...current, forms: current.forms.map((form) => form.id === id ? { ...form, ...patch } : form) }));
  }
  function updateTracking(id: string, patch: Partial<TrackingIntegration>) {
    setData((current) => ({ ...current, tracking: current.tracking.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-[#f4f1eb] px-4 py-12 text-[#162d3d]">
        <form onSubmit={handleLogin} className="mx-auto mt-12 w-full max-w-md rounded-3xl border border-[#ded7cb] bg-white p-8 shadow-[0_24px_80px_rgba(22,45,61,.12)]">
          <img src="/ifrane-logo-header.png" alt="Ifrane Marrocos Tours" className="mb-8 h-20 w-auto object-contain" />
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c77832]">Área administrativa</p>
          <h1 className="mt-2 text-3xl font-semibold">Entre para editar o site</h1>
          <p className="mt-2 text-sm text-[#65727a]">Use sua senha do painel. Depois, escolha uma área e altere somente o que precisa.</p>
          <Field label="Senha" type="password" value={password} onChange={setPassword} autoFocus />
          <button disabled={loading || !password} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#163d5a] font-semibold text-white transition hover:bg-[#0e3049] disabled:opacity-50">{loading && <Loader2 className="h-4 w-4 animate-spin" />} ENTRAR</button>
          <p className="mt-4 rounded-lg bg-[#f7f5f1] px-3 py-2 text-sm text-[#65727a]">{feedback}</p>
        </form>
      </main>
    );
  }

  const activeLabel = navigation.find(([key]) => key === active)?.[1];
  const imageLibrary = data.media.filter((item) => item.media_type === "image" && Boolean(item.public_url));
  return (
    <main className="min-h-screen bg-[#f5f3ef] text-[#162d3d]">
      <div className="min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#102f45] px-4 py-5 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between lg:block">
            <div className="flex items-center gap-3 px-2"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#d58b43]"><Shield className="h-5 w-5" /></div><div><strong className="block">Painel simples</strong><span className="text-xs text-white/55">Ifrane Marrocos Tours</span></div></div>
            <button onClick={() => { clearAdminToken(); setToken(null); }} className="rounded-lg p-2 text-white/70 hover:bg-white/10 lg:hidden" aria-label="Sair"><LogOut className="h-5 w-5" /></button>
          </div>
          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
            {navigation.map(([key, label, Icon]) => <button key={key} onClick={() => setActive(key)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition lg:w-full ${active === key ? "bg-white text-[#163d5a] shadow-sm" : "text-white/72 hover:bg-white/10 hover:text-white"}`}><Icon className="h-4 w-4" /> {label}</button>)}
          </nav>
          <div className="mt-6 hidden border-t border-white/10 pt-5 lg:block"><a href="/ifrane-marrocos-tours.html" target="_blank" className="flex items-center gap-2 px-3 text-sm text-white/70 hover:text-white"><ExternalLink className="h-4 w-4" /> Ver site</a><button onClick={() => { clearAdminToken(); setToken(null); }} className="mt-4 flex items-center gap-2 px-3 text-sm text-white/70 hover:text-white"><LogOut className="h-4 w-4" /> Sair</button></div>
        </aside>

        <section className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-9">
          {mustChangePassword && <button onClick={() => setActive("seguranca")} className="mb-5 w-full rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-900">Sua senha ainda é a padrão. Clique aqui para trocar e proteger o painel.</button>}
          <header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-medium text-[#c77832]">Área administrativa</p><h1 className="text-3xl font-semibold md:text-4xl">{activeLabel}</h1></div><button onClick={() => void loadData()} disabled={loading} className="flex items-center gap-2 rounded-xl border border-[#d9d3c8] bg-white px-4 py-2.5 text-sm font-semibold shadow-sm disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</button></header>

          {active === "resumo" && <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Metric label="Visitas hoje" value={metrics.today} /><Metric label="Total de visitas" value={metrics.views} /><Metric label="Visitantes" value={metrics.visitors} /><Metric label="Sessões" value={metrics.sessions} /><Metric label="Leads" value={metrics.leads} /><Metric label="Cliques no WhatsApp" value={metrics.whatsapp} /></div><Panel title="O que você quer mudar?" subtitle="Acesse direto as áreas mais usadas."><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Shortcut icon={<FileText />} label="Editar textos" onClick={() => setActive("textos")} /><Shortcut icon={<Link2 />} label="Editar botões" onClick={() => setActive("botoes")} /><Shortcut icon={<Image />} label="Trocar imagens" onClick={() => setActive("imagens")} /><Shortcut icon={<MessageCircle />} label="Alterar WhatsApp" onClick={() => setActive("whatsapp")} /></div></Panel></div>}

          {active === "textos" && <div className="space-y-4">
            <Panel title="Editar textos" subtitle="Abra uma seção e altere o texto. Para criar outro, clique em Novo abaixo no lugar onde ele deve aparecer.">
              <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-[#879198]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar um texto..." className="h-11 w-full rounded-xl border border-[#d9d3c8] pl-10 pr-3 outline-none focus:border-[#d58b43]" /></div>
            </Panel>
            {blocksBySection.map(({ section, blocks }, index) => {
              const composer = textComposer?.sectionId === section.id ? textComposer : null;
              const composing = Boolean(composer);
              const allSectionBlocks = data.blocks.filter((block) => block.section_id === section.id);
              return <details key={section.id} open={index === 0 || composing} className="group rounded-2xl border border-[#ded8ce] bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5"><div><h2 className="text-lg font-semibold">{section.name}</h2><p className="text-sm text-[#778188]">{blocks.length} {blocks.length === 1 ? "texto" : "textos"}</p></div><ChevronDown className="h-5 w-5 transition group-open:rotate-180" /></summary>
                <div className="space-y-3 border-t border-[#eee9e1] p-4 md:p-5">
                  {blocks.map((block, blockIndex) => {
                    const value = String(block.draft_content.text ?? "");
                    const addingBelow = composer?.afterBlockKey === block.block_key;
                    const pairedImagePath = pairedImagePathForBlock(block);
                    const pairedMedia = data.media.find((item) => item.path === pairedImagePath) ?? null;
                    const selectedImageUrl = String(block.draft_content.image_url ?? pairedMedia?.public_url ?? "");
                    const canEditImage = Boolean(pairedImagePath || (block.style.dynamic === true && supportsPairedImages(section.section_key)));
                    const inputClassName = "w-full rounded-xl border border-[#d9d3c8] bg-white px-3 outline-none transition focus:border-[#d58b43] focus:ring-2 focus:ring-[#d58b43]/15";
                    return <div key={block.id} className="rounded-xl border border-[#e7e1d8] bg-[#fcfbf9] p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full bg-[#edf1f3] px-3 py-1 text-xs font-semibold text-[#536875]">Texto {blockIndex + 1}</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => addingBelow ? setTextComposer(null) : startAddingText(section, block)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#b9cbd5] bg-white px-3 text-xs font-semibold text-[#163d5a] transition hover:bg-[#edf5f9]"><Plus className="h-3.5 w-3.5" /> Novo abaixo</button>
                          <button type="button" disabled={saving === `text-remove-${block.id}`} onClick={() => void removeTextBlock(block)} className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:opacity-50" aria-label={`Remover texto ${blockIndex + 1}`} title="Remover texto">{saving === `text-remove-${block.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>
                        </div>
                      </div>
                      {block.type === "textarea" || value.length > 90
                        ? <textarea aria-label={`Texto ${blockIndex + 1}`} value={value} onChange={(event) => updateBlock(block.id, event.target.value)} className={`${inputClassName} min-h-24 resize-y py-3`} />
                        : <input aria-label={`Texto ${blockIndex + 1}`} value={value} onChange={(event) => updateBlock(block.id, event.target.value)} className={`${inputClassName} h-11`} />}
                      {canEditImage && <ImageField
                        images={imageLibrary}
                        value={selectedImageUrl}
                        label="Imagem correspondente"
                        onChange={(url) => updateBlockImage(block.id, imageLibrary.find((item) => item.public_url === url) ?? null)}
                        onUpload={(file) => void uploadContentImage(file, (image) => updateBlockImage(block.id, image))}
                        busy={saving === "content-image-upload"}
                      />}
                      {addingBelow && <NewTextBox value={composer.text} onChange={(text) => setTextComposer({ ...composer, text })} imageUrl={composer.imageUrl} images={imageLibrary} showImagePicker={supportsPairedImages(section.section_key)} onImageChange={(image) => setTextComposer({ ...composer, imageUrl: image?.public_url ?? "", imageAlt: image?.alt_text ?? "" })} onImageUpload={(file) => void uploadContentImage(file, (image) => setTextComposer((current) => current?.sectionId === section.id ? { ...current, imageUrl: image.public_url, imageAlt: image.alt_text } : current))} uploadBusy={saving === "content-image-upload"} onAdd={() => void addTextBlock(section)} onCancel={() => setTextComposer(null)} busy={saving === `text-add-${section.id}`} />}
                    </div>;
                  })}
                  {!blocks.length && allSectionBlocks.length > 0 && <Empty text="Nenhum texto desta seção corresponde à busca." />}
                  {!allSectionBlocks.length && !composer && <><Empty text="Esta seção ainda não tem textos." /><button type="button" onClick={() => startAddingText(section, null)} className="inline-flex items-center gap-2 rounded-xl bg-[#163d5a] px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Adicionar primeiro texto</button></>}
                  {!allSectionBlocks.length && composer && <NewTextBox value={composer.text} onChange={(text) => setTextComposer({ ...composer, text })} imageUrl={composer.imageUrl} images={imageLibrary} showImagePicker={supportsPairedImages(section.section_key)} onImageChange={(image) => setTextComposer({ ...composer, imageUrl: image?.public_url ?? "", imageAlt: image?.alt_text ?? "" })} onImageUpload={(file) => void uploadContentImage(file, (image) => setTextComposer((current) => current?.sectionId === section.id ? { ...current, imageUrl: image.public_url, imageAlt: image.alt_text } : current))} uploadBusy={saving === "content-image-upload"} onAdd={() => void addTextBlock(section)} onCancel={() => setTextComposer(null)} busy={saving === `text-add-${section.id}`} />}
                  {allSectionBlocks.length > 0 && <div className="flex justify-end border-t border-[#eee9e1] pt-4"><SaveButton busy={saving === `section-${section.id}`} onClick={() => void saveTextSection(section, allSectionBlocks)} label="Salvar alterações" /></div>}
                </div>
              </details>;
            })}
          </div>}

          {active === "botoes" && <div className="space-y-5"><Help text="Altere o texto e o destino de cada botão. Os botões de WhatsApp usam o número definido na área WhatsApp." />{buttonsBySection.map(({ section, buttons }) => <Panel key={section.id} title={section.name} subtitle={`${buttons.length} botões ou links`}><div className="space-y-4">{buttons.map((button) => <div key={button.id} className="rounded-xl border border-[#e4ded4] bg-[#fbfaf7] p-4"><div className="grid gap-4 md:grid-cols-2"><Field label="Texto que aparece" value={button.label} onChange={(value) => updateButton(button.id, { label: value })} /><SelectField label="Tipo de destino" value={button.destination_type} onChange={(value) => updateButton(button.id, { destination_type: value as ButtonRow["destination_type"] })} options={[["whatsapp", "WhatsApp"], ["anchor", "Seção do site"], ["url", "Outro link"], ["email", "E-mail"], ["phone", "Telefone"], ["page", "Página"]]} /></div>{button.destination_type !== "whatsapp" && <Field label="Link ou destino" value={button.destination_value ?? ""} onChange={(value) => updateButton(button.id, { destination_value: value })} />}<div className="mt-4 flex flex-wrap items-center justify-between gap-3"><Toggle label="Abrir em nova aba" checked={button.open_new_tab} onChange={(checked) => updateButton(button.id, { open_new_tab: checked })} /><SaveButton compact busy={saving === `button-${button.id}`} onClick={() => token && void saveAction(`button-${button.id}`, () => adminTable("buttons", { method: "PATCH", token, query: `?id=eq.${button.id}`, body: { label: button.label, destination_type: button.destination_type, destination_value: button.destination_value, open_new_tab: button.open_new_tab, is_active: button.is_active } }))} label="Salvar botão" /></div></div>)}</div></Panel>)}</div>}

          {active === "imagens" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.media.filter((item) => Boolean(item.public_url)).map((item) => { const changing = saving === `media-upload-${item.id}`; const removing = saving === `media-remove-${item.id}`; return <article key={item.id} className="group overflow-hidden rounded-2xl border border-[#ded8ce] bg-white shadow-sm"><div className="relative aspect-[4/3] overflow-hidden bg-[#e9e5de]">{item.media_type === "video" ? <video src={item.public_url ?? ""} controls preload="metadata" className="h-full w-full object-cover" /> : <img src={item.public_url ?? ""} alt={item.alt_text || item.label || "Imagem do site"} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />}{(changing || removing) && <div className="absolute inset-0 grid place-items-center bg-[#102f45]/65 text-white"><Loader2 className="h-7 w-7 animate-spin" /></div>}<span className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">{item.label || (item.media_type === "video" ? "Vídeo" : "Imagem")}</span></div><div className="flex items-center gap-3 p-3"><label className={`flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#163d5a] px-4 text-sm font-semibold text-white transition hover:bg-[#0e3049] ${(changing || removing) ? "pointer-events-none opacity-60" : ""}`}><Upload className="h-4 w-4" />Trocar<input type="file" className="sr-only" disabled={changing || removing} accept={item.media_type === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp,image/gif,image/svg+xml"} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void replaceMedia(item, file); }} /></label><button type="button" disabled={changing || removing} onClick={() => void removeMedia(item)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-red-200 text-red-600 transition hover:bg-red-50 disabled:opacity-50" aria-label={`Remover ${item.media_type === "video" ? "vídeo" : "imagem"}`} title="Remover"><Trash2 className="h-5 w-5" /></button></div></article>; })}{!data.media.some((item) => Boolean(item.public_url)) && <div className="sm:col-span-2 xl:col-span-3"><Empty text="Nenhuma imagem ou vídeo cadastrado." /></div>}</div>}

          {active === "formulario" && <div className="space-y-5">{data.forms.map((form) => <Panel key={form.id} title={form.name} subtitle="Campos recebidos dos clientes"><div className="grid gap-4 md:grid-cols-2"><Field label="Nome do formulário" value={form.name} onChange={(value) => updateForm(form.id, { name: value })} /><Toggle label="Formulário ativo" checked={form.is_active} onChange={(checked) => updateForm(form.id, { is_active: checked })} /></div><TextAreaField label="Mensagem depois do envio" value={form.success_message} onChange={(value) => updateForm(form.id, { success_message: value })} /><div className="space-y-3"><p className="text-sm font-semibold">Campos do formulário</p>{form.fields.map((field, index) => <div key={`${field.name}-${index}`} className="grid gap-3 rounded-xl bg-[#f7f5f1] p-3 md:grid-cols-[1fr_160px_auto]"><Field label={`Campo ${index + 1}`} value={field.label ?? ""} onChange={(value) => updateForm(form.id, { fields: form.fields.map((item, itemIndex) => itemIndex === index ? { ...item, label: value } : item) })} /><SelectField label="Tipo" value={field.type ?? "text"} onChange={(value) => updateForm(form.id, { fields: form.fields.map((item, itemIndex) => itemIndex === index ? { ...item, type: value } : item) })} options={[["text", "Texto"], ["tel", "Telefone"], ["email", "E-mail"], ["textarea", "Texto longo"]]} /><Toggle label="Obrigatório" checked={Boolean(field.required)} onChange={(checked) => updateForm(form.id, { fields: form.fields.map((item, itemIndex) => itemIndex === index ? { ...item, required: checked } : item) })} /></div>)}</div><SaveButton busy={saving === `form-${form.id}`} onClick={() => token && void saveAction(`form-${form.id}`, () => adminTable("forms", { method: "PATCH", token, query: `?id=eq.${form.id}`, body: { name: form.name, fields: form.fields, success_message: form.success_message, is_active: form.is_active } }))} label="Salvar formulário" /></Panel>)}{!data.forms.length && <Empty text="Nenhum formulário cadastrado." />}</div>}

          {active === "leads" && <Panel title="Pessoas que entraram em contato" subtitle={`${filteredLeads.length} registros`}><div className="relative mb-4"><Search className="absolute left-3 top-3.5 h-4 w-4 text-[#879198]" /><input value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} placeholder="Buscar nome, telefone ou e-mail" className="h-11 w-full rounded-xl border border-[#d9d3c8] pl-10 pr-3 outline-none" /></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-[#778188]"><tr><th className="pb-3">Nome</th><th>WhatsApp</th><th>E-mail</th><th>Data</th><th>Status</th></tr></thead><tbody>{filteredLeads.map((lead) => <tr key={lead.id} className="border-t border-[#eee9e1]"><td className="py-4 font-medium">{lead.name || "Sem nome"}</td><td>{lead.whatsapp ? <a className="text-emerald-700 underline" href={leadWhatsapp(lead.whatsapp)} target="_blank">{lead.whatsapp}</a> : "-"}</td><td>{lead.email || "-"}</td><td>{new Date(lead.created_at).toLocaleDateString("pt-BR")}</td><td><select value={lead.status} onChange={(event) => void updateLeadStatus(lead.id, event.target.value)} className="rounded-lg border border-[#d9d3c8] bg-white px-2 py-1.5">{leadStatuses.map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>{!filteredLeads.length && <Empty text="Ainda não há leads cadastrados." />}</Panel>}

          {active === "whatsapp" && (data.whatsapp ? <Panel title="WhatsApp do site" subtitle="Esse número será usado em todos os botões de WhatsApp."><div className="grid gap-4 md:grid-cols-[120px_140px_1fr]"><Field label="País" value={data.whatsapp.country_code} onChange={(value) => setData((current) => ({ ...current, whatsapp: current.whatsapp ? { ...current.whatsapp, country_code: value } : null }))} /><Field label="DDD" value={data.whatsapp.ddd ?? ""} onChange={(value) => setData((current) => ({ ...current, whatsapp: current.whatsapp ? { ...current.whatsapp, ddd: value } : null }))} /><Field label="Número" value={data.whatsapp.phone ?? ""} onChange={(value) => setData((current) => ({ ...current, whatsapp: current.whatsapp ? { ...current.whatsapp, phone: value } : null }))} /></div><TextAreaField label="Mensagem automática" value={data.whatsapp.initial_message ?? ""} onChange={(value) => setData((current) => ({ ...current, whatsapp: current.whatsapp ? { ...current.whatsapp, initial_message: value } : null }))} /><Toggle label="Mostrar botão flutuante" checked={data.whatsapp.floating_enabled} onChange={(checked) => setData((current) => ({ ...current, whatsapp: current.whatsapp ? { ...current.whatsapp, floating_enabled: checked } : null }))} /><SaveButton busy={saving === "whatsapp"} onClick={() => token && data.whatsapp && void saveAction("whatsapp", () => adminTable("whatsapp_settings", { method: "PATCH", token, query: `?id=eq.${data.whatsapp!.id}`, body: { country_code: data.whatsapp!.country_code, ddd: data.whatsapp!.ddd, phone: data.whatsapp!.phone, initial_message: data.whatsapp!.initial_message, floating_enabled: data.whatsapp!.floating_enabled } }))} label="Salvar WhatsApp" /></Panel> : <Empty text="As configurações de WhatsApp não foram encontradas." />)}

          {active === "aparencia" && <Panel title="Aparência do site" subtitle="Cores, fontes e elementos visuais cadastrados.">{data.identity && (Object.keys(data.identity.tokens).length || Object.keys(data.identity.fonts).length) ? <><ObjectFields title="Cores" value={data.identity.tokens} onChange={(tokens) => setData((current) => ({ ...current, identity: current.identity ? { ...current.identity, tokens } : null }))} /><ObjectFields title="Fontes" value={data.identity.fonts} onChange={(fonts) => setData((current) => ({ ...current, identity: current.identity ? { ...current.identity, fonts } : null }))} /><SaveButton busy={saving === "identity"} onClick={() => token && data.identity && void saveAction("identity", () => adminTable("visual_identity", { method: "PATCH", token, query: `?id=eq.${data.identity!.id}`, body: { tokens: data.identity!.tokens, fonts: data.identity!.fonts, assets: data.identity!.assets } }))} label="Salvar aparência" /></> : <Help text="A identidade atual está definida diretamente no design do site. As imagens podem ser alteradas na área Imagens e vídeos." />}</Panel>}

          {active === "seo" && <div className="space-y-5">{data.seo && <Panel title="Como o site aparece no Google" subtitle="Textos de busca e compartilhamento."><Field label="Título do site" value={data.seo.seo_title ?? ""} onChange={(value) => setData((current) => ({ ...current, seo: current.seo ? { ...current.seo, seo_title: value } : null }))} /><TextAreaField label="Descrição do site" value={data.seo.meta_description ?? ""} onChange={(value) => setData((current) => ({ ...current, seo: current.seo ? { ...current.seo, meta_description: value } : null }))} /><Field label="Endereço oficial" value={data.seo.canonical_url ?? ""} onChange={(value) => setData((current) => ({ ...current, seo: current.seo ? { ...current.seo, canonical_url: value } : null }))} /><Toggle label="Permitir aparecer no Google" checked={data.seo.indexable} onChange={(checked) => setData((current) => ({ ...current, seo: current.seo ? { ...current.seo, indexable: checked } : null }))} /><SaveButton busy={saving === "seo"} onClick={() => token && data.seo && void saveAction("seo", () => adminTable("seo_settings", { method: "PATCH", token, query: `?id=eq.${data.seo!.id}`, body: data.seo }))} label="Salvar SEO" /></Panel>}<Panel title="Pixels e métricas" subtitle="Ative apenas o serviço que você usa."><div className="space-y-4">{data.tracking.map((item) => <div key={item.id} className="rounded-xl border border-[#e4ded4] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{item.name || item.provider}</strong><p className="text-sm text-[#778188]">{item.provider}</p></div><Toggle label="Ativo" checked={item.is_active} onChange={(checked) => updateTracking(item.id, { is_active: checked })} /></div><ObjectFields value={item.public_config} onChange={(public_config) => updateTracking(item.id, { public_config })} /><div className="mt-3"><SaveButton compact busy={saving === `tracking-${item.id}`} onClick={() => token && void saveAction(`tracking-${item.id}`, () => adminTable("tracking_integrations", { method: "PATCH", token, query: `?id=eq.${item.id}`, body: { name: item.name, provider: item.provider, public_config: item.public_config, is_active: item.is_active } }))} label="Salvar integração" /></div></div>)}</div></Panel></div>}

          {active === "seguranca" && <Panel title="Senha e recuperação" subtitle="Mantenha uma senha que só você conhece."><form onSubmit={saveSecurity} className="space-y-4"><Field label="E-mail de recuperação" type="email" value={security.recoveryEmail} onChange={(value) => setSecurity({ ...security, recoveryEmail: value })} /><div className="grid gap-4 md:grid-cols-3"><Field label="Senha atual" type="password" value={security.currentPassword} onChange={(value) => setSecurity({ ...security, currentPassword: value })} /><Field label="Nova senha" type="password" value={security.newPassword} onChange={(value) => setSecurity({ ...security, newPassword: value })} /><Field label="Confirmar senha" type="password" value={security.confirmPassword} onChange={(value) => setSecurity({ ...security, confirmPassword: value })} /></div><SaveButton busy={saving === "security"} label="Salvar segurança" submit /></form></Panel>}
        </section>
      </div>
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#ded8ce] bg-white px-4 py-2.5 text-sm shadow-xl"><Check className="h-4 w-4 text-emerald-600" /><span>{feedback}</span></div>
    </main>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-[#ded8ce] bg-white p-5 shadow-sm md:p-6"><div className="mb-5"><h2 className="text-xl font-semibold">{title}</h2>{subtitle && <p className="mt-1 text-sm text-[#778188]">{subtitle}</p>}</div><div className="space-y-4">{children}</div></section>;
}
function Field({ label, value, onChange, type = "text", autoFocus = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoFocus?: boolean }) {
  return <label className="block"><span className="text-sm font-semibold text-[#354b59]">{label}</span><input autoFocus={autoFocus} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#d9d3c8] bg-white px-3 outline-none transition focus:border-[#d58b43] focus:ring-2 focus:ring-[#d58b43]/15" /></label>;
}
function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-sm font-semibold text-[#354b59]">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-28 w-full resize-y rounded-xl border border-[#d9d3c8] bg-white px-3 py-3 outline-none transition focus:border-[#d58b43] focus:ring-2 focus:ring-[#d58b43]/15" /></label>;
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[] }) {
  return <label className="block"><span className="text-sm font-semibold text-[#354b59]">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#d9d3c8] bg-white px-3 outline-none focus:border-[#d58b43]">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-11 items-center gap-3"><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-[#d58b43]" : "bg-[#c8c8c8]"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} /></button><span className="text-sm font-medium">{label}</span></label>;
}
function SaveButton({ onClick, busy, label, compact = false, submit = false }: { onClick?: () => void; busy: boolean; label: string; compact?: boolean; submit?: boolean }) {
  return <button type={submit ? "submit" : "button"} onClick={onClick} disabled={busy} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#163d5a] font-semibold text-white transition hover:bg-[#0e3049] disabled:opacity-60 ${compact ? "px-4 py-2.5 text-sm" : "px-5 py-3"}`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{label}</button>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-[#ded8ce] bg-white p-5 shadow-sm"><p className="text-sm text-[#778188]">{label}</p><strong className="mt-2 block text-3xl">{value}</strong></div>; }
function Shortcut({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) { return <button onClick={onClick} className="flex items-center gap-3 rounded-xl border border-[#e4ded4] bg-[#fbfaf7] p-4 text-left font-semibold transition hover:border-[#d58b43] hover:bg-[#fffaf2]"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e7eef2] text-[#163d5a] [&>svg]:h-4 [&>svg]:w-4">{icon}</span>{label}</button>; }
function Help({ text }: { text: string }) { return <div className="rounded-2xl border border-[#cbdce6] bg-[#edf5f9] p-4 text-sm text-[#274b60]">{text}</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-[#d9d3c8] bg-[#faf9f6] p-6 text-center text-sm text-[#778188]">{text}</div>; }
function ImageField({ images, value, label, onChange, onUpload, busy = false }: {
  images: MediaRow[];
  value: string;
  label: string;
  onChange: (value: string) => void;
  onUpload?: (file: File) => void;
  busy?: boolean;
}) {
  const hasCurrentImage = Boolean(value && !images.some((image) => image.public_url === value));
  return <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
    <label className="block min-w-0"><span className="text-sm font-semibold text-[#354b59]">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#d9d3c8] bg-white px-3 outline-none focus:border-[#d58b43]">
      <option value="">{onUpload ? "Usar imagem original" : "Selecione uma imagem"}</option>
      {hasCurrentImage && <option value={value}>Imagem atual</option>}
      {images.map((image) => <option key={image.id} value={image.public_url ?? ""}>{image.label || image.alt_text || image.path}</option>)}
    </select></label>
    {onUpload && <label className={`mt-6 inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#b9cbd5] bg-white px-4 text-sm font-semibold text-[#163d5a] transition hover:bg-[#edf5f9] ${busy ? "pointer-events-none opacity-60" : ""}`}><Upload className="h-4 w-4" />{busy ? "Enviando…" : "Enviar nova foto"}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) onUpload(file); }} /></label>}
    {value && <img src={value} alt="Prévia da imagem correspondente" className="col-span-full h-32 w-48 rounded-xl border border-[#e7e1d8] object-cover" loading="lazy" />}
  </div>;
}

function NewTextBox({ value, onChange, imageUrl, images, showImagePicker, onImageChange, onImageUpload, uploadBusy, onAdd, onCancel, busy }: {
  value: string;
  onChange: (value: string) => void;
  imageUrl: string;
  images: MediaRow[];
  showImagePicker: boolean;
  onImageChange: (image: MediaRow | null) => void;
  onImageUpload: (file: File) => void;
  uploadBusy: boolean;
  onAdd: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return <div className="mt-4 rounded-xl border-2 border-dashed border-[#b9cbd5] bg-[#f1f7fa] p-4">
    <label className="block"><span className="text-sm font-semibold text-[#354b59]">Novo texto</span><textarea autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder="Digite aqui..." className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[#cbd8df] bg-white px-3 py-3 outline-none focus:border-[#d58b43] focus:ring-2 focus:ring-[#d58b43]/15" /></label>
    {showImagePicker && <ImageField images={images} value={imageUrl} label="Imagem correspondente" onChange={(url) => onImageChange(images.find((image) => image.public_url === url) ?? null)} onUpload={onImageUpload} busy={uploadBusy} />}
    <p className="mt-2 text-xs text-[#657780]">Ele será criado como um item próprio logo abaixo, com a imagem escolhida quando a seção tiver fotos.</p>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={onAdd} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#163d5a] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar texto</button><button type="button" onClick={onCancel} disabled={busy} className="rounded-xl border border-[#d9d3c8] bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-60">Cancelar</button></div>
  </div>;
}
function ObjectFields({ title, value, onChange }: { title?: string; value: JsonMap; onChange: (value: JsonMap) => void }) {
  const entries = Object.entries(value).filter(([, item]) => ["string", "number", "boolean"].includes(typeof item));
  if (!entries.length) return null;
  return <div className="space-y-3">{title && <h3 className="font-semibold">{title}</h3>}<div className="grid gap-4 md:grid-cols-2">{entries.map(([key, item]) => typeof item === "boolean" ? <Toggle key={key} label={friendlyLabel(key)} checked={item} onChange={(checked) => onChange({ ...value, [key]: checked })} /> : <Field key={key} label={friendlyLabel(key)} value={String(item ?? "")} onChange={(next) => onChange({ ...value, [key]: next })} />)}</div></div>;
}
function friendlyLabel(key: string) { const labels: Record<string, string> = { pixel_id: "ID do pixel", project_id: "ID do projeto", measurement_id: "ID de medição", container_id: "ID do contêiner" }; return labels[key] || key.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()); }
function leadWhatsapp(value: string) { const digits = value.replace(/\D/g, ""); return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`; }
function messageFrom(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

export default AdminPanel;
