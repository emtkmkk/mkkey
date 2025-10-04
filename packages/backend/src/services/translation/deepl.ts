import { URLSearchParams } from "node:url";
import fetch from "node-fetch";

import config from "@/config/index.js";
import { getAgentByUrl } from "@/misc/fetch.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import type { Meta } from "@/models/entities/meta.js";

export interface DeeplTranslationResult {
  text: string;
  sourceLang: string | null;
}

export function formatDeeplTranslationPrefix(sourceLang: string | null): string {
  if (!sourceLang) {
    return "??から翻訳:";
  }

  const normalized = sourceLang.trim().toLowerCase();
  const base = normalized.split("-")[0] || normalized;
  const short = base.length > 2 ? base.slice(0, 2) : base;

  if (!short) {
    return "??から翻訳:";
  }

  return `${short.toUpperCase()}から翻訳:`;
}

export async function translateWithDeepl(
  text: string,
  targetLang: string,
  instance?: Meta,
): Promise<DeeplTranslationResult | null> {
  const meta = instance ?? (await fetchMeta());

  if (!meta.deeplAuthKey) {
    return null;
  }

  const normalizedTarget = targetLang.toUpperCase();

  const params = new URLSearchParams();
  params.append("auth_key", meta.deeplAuthKey ?? "");
  params.append("text", text);
  params.append("target_lang", normalizedTarget);

  const endpoint = meta.deeplIsPro
    ? "https://api.deepl.com/v2/translate"
    : "https://api-free.deepl.com/v2/translate";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": config.userAgent,
      Accept: "application/json, */*",
    },
    body: params,
    agent: getAgentByUrl,
  });

  if (!res.ok) {
    return null;
  }

  const json = (await res.json()) as {
    translations: {
      detected_source_language: string;
      text: string;
    }[];
  };

  if (!json.translations?.length) {
    return null;
  }

  return {
    sourceLang: json.translations[0].detected_source_language,
    text: json.translations[0].text,
  };
}
