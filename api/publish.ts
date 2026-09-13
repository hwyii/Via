import { Buffer } from "node:buffer";
import { createHash, timingSafeEqual } from "node:crypto";

const OWNER = "hwyii";
const REPO = "Via";
const BRANCH = "main";
const DATA_PATH = "public/footprints.json";
const GITHUB_API_VERSION = "2026-03-10";

type PublishedData = {
  version: 2;
  tags: string[];
  trips: unknown[];
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function secretsMatch(submitted: string, expected: string) {
  const submittedHash = createHash("sha256").update(submitted).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(submittedHash, expectedHash);
}

function isPublishedData(value: unknown): value is PublishedData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<PublishedData>;
  return (
    data.version === 2 &&
    Array.isArray(data.tags) &&
    data.tags.length > 0 &&
    data.tags.every((tag) => typeof tag === "string" && tag.trim().length > 0) &&
    Array.isArray(data.trips)
  );
}

async function githubRequest(path: string, init: RequestInit, token: string) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": "via-publisher",
      ...init.headers,
    },
  });
}

export default {
  async fetch(request: Request) {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const githubToken = process.env.VIA_GITHUB_TOKEN;
    const publishSecret = process.env.VIA_PUBLISH_SECRET;
    if (!githubToken || !publishSecret) {
      return json({ error: "Publishing is not configured on this deployment." }, 503);
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return json({ error: "Expected a JSON request." }, 415);
    }

    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (declaredSize > 1_000_000) {
      return json({ error: "Published data is too large." }, 413);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON request." }, 400);
    }

    if (!body || typeof body !== "object") {
      return json({ error: "Invalid publish request." }, 400);
    }

    const requestBody = body as { secret?: unknown; data?: unknown };
    if (
      typeof requestBody.secret !== "string" ||
      !secretsMatch(requestBody.secret, publishSecret)
    ) {
      return json({ error: "Incorrect publish password." }, 401);
    }

    if (!isPublishedData(requestBody.data)) {
      return json({ error: "Invalid footprint data." }, 400);
    }

    const contentsPath = `/repos/${OWNER}/${REPO}/contents/${DATA_PATH}`;
    const currentResponse = await githubRequest(
      `${contentsPath}?ref=${encodeURIComponent(BRANCH)}`,
      { method: "GET", cache: "no-store" },
      githubToken,
    );

    if (!currentResponse.ok) {
      return json({ error: `Could not read the current published data (${currentResponse.status}).` }, 502);
    }

    const current = (await currentResponse.json()) as { sha?: unknown };
    if (typeof current.sha !== "string") {
      return json({ error: "GitHub did not return the current file version." }, 502);
    }

    const content = `${JSON.stringify(requestBody.data, null, 2)}\n`;
    const updateResponse = await githubRequest(
      contentsPath,
      {
        method: "PUT",
        body: JSON.stringify({
          message: "Publish travel footprints",
          content: Buffer.from(content, "utf8").toString("base64"),
          sha: current.sha,
          branch: BRANCH,
        }),
      },
      githubToken,
    );

    if (!updateResponse.ok) {
      const status = updateResponse.status === 409 ? 409 : 502;
      const message = updateResponse.status === 409
        ? "The published file changed while saving. Please try again."
        : `GitHub could not update the published data (${updateResponse.status}).`;
      return json({ error: message }, status);
    }

    const result = (await updateResponse.json()) as {
      commit?: { html_url?: unknown };
    };
    return json({
      ok: true,
      commitUrl: typeof result.commit?.html_url === "string" ? result.commit.html_url : null,
    });
  },
};
