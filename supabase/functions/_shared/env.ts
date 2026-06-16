export function cleanEnvValue(value: string | undefined | null): string | undefined {
  const cleaned = value?.replace(/\uFEFF/g, "").trim();
  return cleaned || undefined;
}

export function getEnv(name: string): string | undefined {
  return cleanEnvValue(Deno.env.get(name));
}
