export function cleanEnvValue(value: string | undefined | null): string | undefined {
  const cleaned = value?.replace(/\uFEFF/g, "").trim();
  return cleaned || undefined;
}

export function requireCleanValue(value: string | undefined | null, name: string): string {
  const cleaned = cleanEnvValue(value);
  if (!cleaned) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return cleaned;
}

export function requireEnv(name: string): string {
  return requireCleanValue(process.env[name], name);
}

export function publicSiteUrl(): string {
  return cleanEnvValue(process.env.PUBLIC_SITE_URL) ?? "http://localhost:3000";
}
