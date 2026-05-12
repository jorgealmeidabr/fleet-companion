import jsPDF from "jspdf";
import { supabase } from "@/lib/supabase";
import type { Request, Veiculo } from "@/lib/types";
import brqLogo from "@/assets/brq-logo.jpg";

const GOLD = "#f5c400";
const BLACK = "#0a0c0f";

const URGENCY_LABEL: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const TYPE_TITLE: Record<string, string> = {
  maintenance: "SOLICITAÇÃO DE MANUTENÇÃO VEICULAR",
  fuel: "SOLICITAÇÃO DE ABASTECIMENTO",
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
  } catch {
    return null;
  }
}

export interface BuildPdfInput {
  request: Request;
  veiculo: Veiculo | null;
  solicitante: string;
}

export async function buildRequestPdf({
  request,
  veiculo,
  solicitante,
}: BuildPdfInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const MARGIN_X = 40;
  const LABEL_X = MARGIN_X;
  const VALUE_X = 180;
  const VALUE_MAX_WIDTH = pageWidth - VALUE_X - MARGIN_X;
  const FOOTER_H = 44;
  const SIGNATURE_BLOCK_H = 110;
  const BOTTOM_LIMIT = pageHeight - FOOTER_H - SIGNATURE_BLOCK_H - 20;

  // ===== HEADER (desenhado em cada página) =====
  const logoData = await loadLogoDataUrl();
  const titulo = TYPE_TITLE[request.type] ?? "SOLICITAÇÃO";

  const drawHeader = () => {
    doc.setFillColor(BLACK);
    doc.rect(0, 0, pageWidth, 90, "F");

    if (logoData) {
      try {
        doc.addImage(logoData, "JPEG", 32, 18, 54, 54);
      } catch {
        /* ignora */
      }
    }

    doc.setTextColor(GOLD);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(titulo, 100, 44);

    doc.setTextColor("#ffffff");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const dt = new Date(request.created_at);
    const dtStr = isNaN(dt.getTime()) ? "—" : dt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    doc.text(`Protocolo: ${request.protocol ?? "—"}`, 100, 62);
    doc.text(`Emitido em: ${dtStr}`, 100, 76);

    // faixa dourada
    doc.setFillColor(GOLD);
    doc.rect(0, 90, pageWidth, 4, "F");
  };

  const drawFooter = () => {
    doc.setFillColor(GOLD);
    doc.rect(0, pageHeight - FOOTER_H, pageWidth, 4, "F");
    doc.setFillColor(BLACK);
    doc.rect(0, pageHeight - FOOTER_H + 4, pageWidth, FOOTER_H - 4, "F");
    doc.setTextColor("#ffffff");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      "Documento gerado automaticamente — BRQ Frota Interna",
      pageWidth / 2,
      pageHeight - 18,
      { align: "center" }
    );
  };

  drawHeader();

  let y = 130;

  const ensureSpace = (needed: number) => {
    if (y + needed > BOTTOM_LIMIT) {
      drawFooter();
      doc.addPage();
      drawHeader();
      y = 130;
    }
  };

  const sectionTitle = (label: string) => {
    ensureSpace(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(BLACK);
    doc.text(label, MARGIN_X, y);
    doc.setDrawColor(GOLD);
    doc.setLineWidth(1.2);
    doc.line(MARGIN_X, y + 4, pageWidth - MARGIN_X, y + 4);
    y += 22;
  };

  const rowLabel = (label: string, value: string) => {
    const safeValue = (value ?? "").toString().trim() || "—";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(safeValue, VALUE_MAX_WIDTH) as string[];
    const lineH = 14;
    const blockH = Math.max(lineH, lineH * lines.length);

    ensureSpace(blockH + 4);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(BLACK);
    doc.text(label, LABEL_X, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor("#333333");
    doc.text(lines, VALUE_X, y);

    y += blockH + 4;
  };

  // ===== DADOS GERAIS =====
  sectionTitle("DADOS GERAIS");
  rowLabel("Solicitante:", solicitante);
  rowLabel(
    "Veículo:",
    veiculo
      ? `${veiculo.placa} — ${veiculo.marca ?? ""} ${veiculo.modelo ?? ""}`.trim()
      : "—"
  );
  rowLabel(
    "Quilometragem:",
    request.km != null ? `${Number(request.km).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} km` : "—"
  );

  // ===== DETALHES =====
  y += 8;
  sectionTitle(
    request.type === "maintenance"
      ? "DETALHES DA MANUTENÇÃO"
      : "DETALHES DO ABASTECIMENTO"
  );

  if (request.type === "maintenance") {
    rowLabel("Urgência:", URGENCY_LABEL[request.urgency ?? ""] ?? "—");
    rowLabel("Descrição do problema:", request.problem_description ?? "—");
  } else {
    rowLabel("Tipo de combustível:", request.fuel_type ?? "—");
    rowLabel(
      "Litros solicitados:",
      request.liters != null ? `${request.liters} L` : "—"
    );
  }

  if (request.observations) {
    rowLabel("Observações:", request.observations);
  }

  // ===== ASSINATURAS =====
  // Garante que cabem na página atual; senão cria nova
  if (y + SIGNATURE_BLOCK_H > pageHeight - FOOTER_H - 20) {
    drawFooter();
    doc.addPage();
    drawHeader();
    y = 130;
  }

  const signY = pageHeight - FOOTER_H - 70;
  doc.setDrawColor("#888888");
  doc.setLineWidth(0.6);
  doc.line(60, signY, 260, signY);
  doc.line(pageWidth - 260, signY, pageWidth - 60, signY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#555555");
  doc.text("Assinatura do solicitante", 160, signY + 14, { align: "center" });
  doc.text("Assinatura do responsável", pageWidth - 160, signY + 14, {
    align: "center",
  });

  drawFooter();

  return doc.output("blob");
}

export async function uploadRequestPdf(
  request: Request,
  pdfBlob: Blob
): Promise<string | null> {
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
