export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function publicSiteUrl(): string {
  return process.env.PUBLIC_SITE_URL ?? "http://localhost:3000";
}
