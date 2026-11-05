import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminPanel from "@/pages/AdminPanel";

const section = {
  id: "packages-section",
  page_id: "home",
  section_key: "cms-pacotes",
  name: "Pacotes de viagem",
  type: "cms",
  sort_order: 4,
  is_active: true,
  draft_data: {},
  published_data: {},
};

const blocks = Array.from({ length: 20 }, (_, index) => ({
  id: `block-${index + 1}`,
  section_id: section.id,
  block_key: `cms-text-pacotes-${String(index + 1).padStart(3, "0")}`,
  type: index === 4 || index === 13 ? "textarea" : "text",
  label: `Texto ${index + 1}`,
  sort_order: index + 1,
  is_active: true,
  draft_content: { text: `Conteúdo ${index + 1}` },
  published_content: { text: `Conteúdo ${index + 1}` },
  style: {},
}));

const buttons = [1, 2].map((index) => ({
  id: `button-${index}`,
  section_id: section.id,
  button_key: `cms-link-pacotes-${String(index).padStart(2, "0")}`,
  label: "Quero esse roteiro",
  destination_type: "whatsapp",
  destination_value: null,
  open_new_tab: true,
  is_active: true,
  sort_order: index,
}));

describe("package text editor UI", () => {
  beforeEach(() => {
    window.localStorage.setItem("admin-session-token", "test-session");
    window.fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      const data = url.includes("/table/sections") ? [section]
        : url.includes("/table/content_blocks") ? blocks
          : url.includes("/table/buttons") ? buttons
            : [];
      return { ok: true, json: async () => data } as Response;
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows both package cards with every editable text group", async () => {
    render(<AdminPanel />);
    await waitFor(() => expect(screen.getByText("Tudo carregado")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Textos do site/i }));

    expect(screen.getByText("Pacote 1 — Marrocos Completo")).toBeInTheDocument();
    expect(screen.getByText("Pacote 2 — Marrocos Imperial")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Selo acima da imagem")).toHaveLength(2);
    expect(screen.getAllByLabelText("Descrição")).toHaveLength(2);
    expect(screen.getAllByLabelText("Item 6")).toHaveLength(2);
    expect(screen.getAllByLabelText("Texto do botão")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Salvar e publicar pacotes" })).toBeInTheDocument();
  });
});
