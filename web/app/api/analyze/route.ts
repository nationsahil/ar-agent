import { NextRequest, NextResponse } from "next/server";
import { config } from "dotenv";
import Groq from "groq-sdk";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

export const runtime = "nodejs";

type ArAnalysis = {
  claim_summary: string;
  denial_codes: string[];
  cpt_codes: string[];
  balance: string;
  payer: string;
  patient_responsibility: string;
  user_context_considered: string;
  recommended_action: string;
  reasoning: string;
  billing_note: string;
  queue: string;
  needs_human_review: boolean;
  missing_information: string[];
};

config({ path: path.join(process.cwd(), "../ar-agent/.env"), quiet: true });

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "GROQ_API_KEY was not found. Add it to ar-agent/.env or web/.env.local." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("eob");
    const context = String(formData.get("context") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload an EOB PDF." }, { status: 400 });
    }

    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length === 0) {
      return NextResponse.json({ error: "The uploaded PDF is empty." }, { status: 400 });
    }

    const eobText = await extractPdfText(buffer);

    if (!eobText.trim()) {
      return NextResponse.json(
        { error: "No readable text was found in the PDF." },
        { status: 422 },
      );
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are an accounts receivable workflow assistant for healthcare EOB review. Use only the EOB text and user-provided operational context. Return strict JSON only.",
        },
        {
          role: "user",
          content: buildPrompt(eobText, context),
        },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const analysis = normalizeAnalysis(parseJson(raw));

    return NextResponse.json({
      analysis,
      raw,
      extractedCharacters: eobText.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while analyzing the EOB.",
      },
      { status: 500 },
    );
  }
}

async function extractPdfText(buffer: Buffer) {
  const tempPath = path.join(os.tmpdir(), `ar-agent-${randomUUID()}.pdf`);
  const script = `
import sys
import pdfplumber

text = ""
with pdfplumber.open(sys.argv[1]) as pdf:
    for page in pdf.pages:
        text += (page.extract_text() or "") + "\\n"

print(text)
`;

  try {
    await fs.writeFile(tempPath, buffer);
    const { stdout } = await execFileAsync("python3", ["-c", script, tempPath], {
      maxBuffer: 1024 * 1024 * 8,
    });

    return stdout || "";
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

function buildPrompt(eobText: string, context: string) {
  return `
Analyze this EOB and the AR rep context. Decide the next AR action.

Required JSON shape:
{
  "claim_summary": "short plain-English summary",
  "denial_codes": ["code"],
  "cpt_codes": ["code"],
  "balance": "amount or Not found",
  "payer": "payer or Not found",
  "patient_responsibility": "amount or Not found",
  "user_context_considered": "how the rep's notes affected the decision",
  "recommended_action": "one crisp next action",
  "reasoning": "short explanation based on EOB + context",
  "billing_note": "ready-to-paste note for the billing system",
  "queue": "Patient Billing | Adjust | Registration | Check SOP for Condition Code | Adjustment Queue | Manual Review | Other",
  "needs_human_review": true,
  "missing_information": ["item"]
}

Routing hints from repo rules:
- PR denial -> Patient Billing.
- OA-18 -> Adjust.
- PI-140 -> Registration.
- M44 -> Check SOP for Condition Code.
- Balance over 1000 -> Adjustment Queue.
- Otherwise Manual Review.

AR rep context:
${context || "Not provided"}

EOB text:
${eobText.slice(0, 24000)}
`;
}

function parseJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("Groq returned a non-JSON response.");
    }

    return JSON.parse(match[0]);
  }
}

function normalizeAnalysis(value: Partial<ArAnalysis>): ArAnalysis {
  return {
    claim_summary: clean(value.claim_summary),
    denial_codes: cleanList(value.denial_codes),
    cpt_codes: cleanList(value.cpt_codes),
    balance: clean(value.balance),
    payer: clean(value.payer),
    patient_responsibility: clean(value.patient_responsibility),
    user_context_considered: clean(value.user_context_considered),
    recommended_action: clean(value.recommended_action),
    reasoning: clean(value.reasoning),
    billing_note: clean(value.billing_note),
    queue: clean(value.queue),
    needs_human_review: Boolean(value.needs_human_review),
    missing_information: cleanList(value.missing_information),
  };
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "Not found";
}

function cleanList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}
