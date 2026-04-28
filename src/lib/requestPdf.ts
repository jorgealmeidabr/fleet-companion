import jsPDF from "jspdf";
import { supabase } from "@/lib/supabase";
import type { Request, Veiculo } from "@/lib/types";
import brqLogo from "@/assets/brq-logo.jpg";

const GOLD = "#f5c400";
const BLACK = "#0a0c0f";

const URGENCY_LABEL: Record<string, string> = {
  low: "Baixa", medium: "Média", high: "Alta",
};

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(brqLogo);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export interface BuildPdfInput {
  request: Request;
  veiculo: Veiculo | null;
  solicitante: string;
}

export async function buildRequestPdf({ request, veiculo, solicitante }: BuildPdfInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ======= HEADER =======
  doc.setFillColor(BLACK);
  doc.rect(0, 0, pageWidth, 90, "F");

  const logoData = await loadLogoDataUrl();
  if (logoData) {
    try { doc.addImage(logoData, "JPEG", 32, 18, 54, 54); } catch { /* ignora falha */ }
  }

  const titulo = request.type === "maintenance"
    ? "SOLICITAÇÃO DE MANUTENÇÃO VEICULAR"
    : "SOLICITAÇÃO DE ABASTECIMENTO";

  doc.setTextColor(GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(titulo, 100, 44);

  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const dt = new Date(request.created_at);
  const dtStr = dt.toLocaleString("pt-BR");
  doc.text(`Protocolo: ${request.protocol}`, 100, 62);
  doc.text(`Emitido em: ${dtStr}`, 100, 76);

  // faixa dourada
  doc.setFillColor(GOLD);
  doc.rect(0, 90, pageWidth, 4, "F");

  // ======= CORPO =======
  let y = 130;
  doc.setTextColor(BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("DADOS GERAIS", 40, y);
  doc.setDrawColor(GOLD);
  doc.setLineWidth(1.2);
  doc.line(40, y + 4, pageWidth - 40, y + 4);
  y += 22;

  const rowLabel = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(BLACK);
    doc.text(label, 40, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor("#333333");
    const lines = doc.splitTextToSize(value || "—", pageWidth - 200);
    doc.text(lines, 180, y);
    y += 16 * Math.max(1, lines.length);
  };

  rowLabel("Solicitante:", solicitante);
  rowLabel("Veículo:", veiculo ? `${veiculo.placa} — ${veiculo.marca} ${veiculo.modelo}` : "—");
  rowLabel("Quilometragem:", `${request.km.toLocaleString("pt-BR")} km`);

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(BLACK);
  doc.text(request.type === "maintenance" ? "DETALHES DA MANUTENÇÃO" : "DETALHES DO ABASTECIMENTO", 40, y);
  doc.setDrawColor(GOLD);
  doc.line(40, y + 4, pageWidth - 40, y + 4);
  y += 22;

  if (request.type === "maintenance") {
    rowLabel("Urgência:", URGENCY_LABEL[request.urgency ?? ""] ?? "—");
    rowLabel("Descrição do problema:", request.problem_description ?? "—");
  } else {
    rowLabel("Tipo de combustível:", request.fuel_type ?? "—");
    rowLabel("Litros solicitados:", request.liters ? `${request.liters} L` : "—");
  }

  if (request.observations) {
    rowLabel("Observações:", request.observations);
  }

  // Caixa de assinatura
  y = Math.max(y + 30, pageHeight - 160);
  doc.setDrawColor("#888888");
  doc.setLineWidth(0.6);
  doc.line(60, y, 260, y);
  doc.line(pageWidth - 260, y, pageWidth - 60, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#555555");
  doc.text("Assinatura do solicitante", 160, y + 14, { align: "center" });
  doc.text("Assinatura do responsável", pageWidth - 160, y + 14, { align: "center" });

  // ======= FOOTER =======
  doc.setFillColor(BLACK);
  doc.rect(0, pageHeight - 40, pageWidth, 40, "F");
  doc.setFillColor(GOLD);
  doc.rect(0, pageHeight - 44, pageWidth, 4, "F");
  doc.setTextColor("#ffffff");
  doc.setFontSize(8);
  doc.text("Documento gerado automaticamente — BRQ Frota Interna", pageWidth / 2, pageHeight - 18, { align: "center" });

  return doc.output("blob");
}

export async function uploadRequestPdf(request: Request, pdfBlob: Blob): Promise<string | null> {
  const path = `${request.user_id}/${request.id}-${request.protocol}.pdf`;
  const { error } = await supabase.storage.from("requests").upload(path, pdfBlob, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) {
    console.error("Upload PDF falhou:", error);
    return null;
  }
  const { data } = supabase.storage.from("requests").getPublicUrl(path);
  return data.publicUrl ?? null;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
