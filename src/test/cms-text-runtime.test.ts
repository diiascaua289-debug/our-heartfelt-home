import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const pageHtml = readFileSync(join(process.cwd(), "public/ifrane-marrocos-tours.html"), "utf8");
const runtimeScript = pageHtml.match(/<script id="cms-runtime">([\s\S]*?)<\/script>/)?.[1];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CMS text runtime", () => {
  it("removes original copy and inserts new text with the section style", async () => {
    expect(runtimeScript).toBeTruthy();
    document.body.innerHTML = `
      <header data-cms-section="header">
        <nav><a class="nav-link" data-cms-button="cms-link-header-02">Sobre</a></nav>
      </header>
      <section data-cms-section="sobre">
        <p class="about-copy"><span data-cms-key="cms-text-about-copy">Texto original</span></p>
      </section>
      <footer data-cms-section="contato">
        <p class="footer-desc"><span data-cms-key="cms-text-footer-copy">Rodapé original</span></p>
      </footer>
    `;

    Object.defineProperty(window, "CSS", {
      configurable: true,
      value: { escape: (value: string) => value },
    });

    const blocks = [
      {
        block_key: "cms-text-about-copy",
        published_content: { text: "Texto original", removed: true },
        style: { removed: true },
        is_active: true,
        sort_order: 1,
      },
      {
        block_key: "cms-text-user-header",
        published_content: { text: "Novo item" },
        style: { dynamic: true, section_key: "cms-header" },
        is_active: true,
        sort_order: 2,
      },
      {
        block_key: "cms-text-user-footer",
        published_content: { text: "Novo texto do rodapé" },
        style: { dynamic: true, section_key: "cms-contato", inherit_from: "cms-text-footer-copy" },
        is_active: true,
        sort_order: 3,
      },
    ];

    window.fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      const data = url.includes("/content_blocks?") ? blocks : [];
      return { ok: true, json: async () => data } as Response;
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    window.eval(runtimeScript!);
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(document.querySelector(".about-copy")).toHaveAttribute("hidden");
    const headerText = document.querySelector("header .cms-added-text");
    expect(headerText).toHaveClass("nav-link");
    expect(headerText).toHaveTextContent("Novo item");
    const footerText = document.querySelector("footer p.cms-added-text");
    expect(footerText).toHaveClass("footer-desc");
    expect(footerText).toHaveTextContent("Novo texto do rodapé");
  });
});
