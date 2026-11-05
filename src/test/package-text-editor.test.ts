import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminSource = readFileSync(join(process.cwd(), "src/pages/AdminPanel.tsx"), "utf8");

describe("package text editor", () => {
  it("keeps all twenty package text slots available in the admin panel", () => {
    const defaults = adminSource.match(/const packageTextDefaults = \[([\s\S]*?)\] as const;/)?.[1] ?? "";

    for (let position = 1; position <= 20; position += 1) {
      expect(defaults).toContain(`cms-text-pacotes-${String(position).padStart(3, "0")}`);
    }
  });

  it("groups both travel packages and publishes their buttons with the text", () => {
    expect(adminSource).toContain("Pacote 1 — Marrocos Completo");
    expect(adminSource).toContain("Pacote 2 — Marrocos Imperial");
    expect(adminSource).toContain("Salvar e publicar pacotes");
    expect(adminSource).toContain("buttons.map((button)");
  });
});
