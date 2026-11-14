import { describe, expect, it, vi } from "vitest";
import { ARES_TWIN_PROTOCOL } from "@/lib/clinicalThresholds";
import { GET, OPTIONS, POST } from "@/app/api/twin-simulate/route";

describe("/api/twin-simulate REST contract", () => {
  it("handles CORS preflight OPTIONS and GET schema cleanly", async () => {
    const optRes = await OPTIONS();
    expect(optRes.status).toBe(204);
    expect(optRes.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const getRes = await GET();
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = await getRes.json();
    expect(body.protocol).toBe(ARES_TWIN_PROTOCOL);
    expect(body.capabilities.serverUrlForwarding).toBe(false);
  });

  it("ignores externalOpenAiUrl / externalApiKey without SSRF outbound fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const req = new Request("http://localhost:3000/api/twin-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: "ares_1_vance",
          envId: "iss_orbit",
          externalOpenAiUrl: "http://169.254.169.254/latest/meta-data",
          externalApiKey: "sk-should-not-be-forwarded",
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns strict 400, 404, 413, and 422 status codes for malformed or invalid inputs", async () => {
    const badJsonRes = await POST(
      new Request("http://localhost:3000/api/twin-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad json",
      })
    );
    expect(badJsonRes.status).toBe(400);

    const unknownProfileRes = await POST(
      new Request("http://localhost:3000/api/twin-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: "nonexistent_astronaut" }),
      })
    );
    expect(unknownProfileRes.status).toBe(404);

    const unknownEnvRes = await POST(
      new Request("http://localhost:3000/api/twin-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: "ares_1_vance",
          envId: "pluto_orbit",
        }),
      })
    );
    expect(unknownEnvRes.status).toBe(400);

    const unknownActionRes = await POST(
      new Request("http://localhost:3000/api/twin-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: "ares_1_vance",
          actionId: "fake_drug_999",
        }),
      })
    );
    expect(unknownActionRes.status).toBe(422);

    const oversizedBody = JSON.stringify({
      profileId: "ares_1_vance",
      padding: "x".repeat(70_000),
    });
    const tooLargeRes = await POST(
      new Request("http://localhost:3000/api/twin-simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(oversizedBody, "utf8")),
        },
        body: oversizedBody,
      })
    );
    expect(tooLargeRes.status).toBe(413);
  });

  it("simulates Chen + neuro_acetazolamide_rx with contraindication and stateful drug cascade", async () => {
    const res = await POST(
      new Request("http://localhost:3000/api/twin-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: "ares_2_chen",
          envId: "iss_orbit",
          actionId: "neuro_acetazolamide_rx",
        }),
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const json = await res.json();
    expect(json.protocol).toBe(ARES_TWIN_PROTOCOL);
    expect(json.drugSimulation.contraindicationSeverity).toBe(
      "contraindicated"
    );
    expect(
      json.postActionEvaluation.activeCascades.some(
        (c: { id: string }) => c.id === "drug_acetazolamide_renal"
      )
    ).toBe(true);
  });
});
