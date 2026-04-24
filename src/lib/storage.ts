import { supabase } from "./supabase";

export type Bucket = "veiculos" | "motoristas" | "checklists";

export async function uploadFile(bucket: Bucket, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFiles(bucket: Bucket, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const f of files) urls.push(await uploadFile(bucket, f));
  return urls;
}
