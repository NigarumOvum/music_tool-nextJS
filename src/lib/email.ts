type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function getResendApiKey() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  return apiKey;
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
}

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; code: "recipient_not_allowed" | "error"; message: string };

export async function sendEmail(payload: EmailPayload): Promise<SendEmailResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromEmail(),
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    const message = (await response.text().catch(() => "")) || "Failed to send email";
    const isRecipientRestriction =
      response.status === 403 && message.includes("testing emails") && message.includes("validation_error");
    return isRecipientRestriction
      ? { ok: false, code: "recipient_not_allowed", message }
      : { ok: false, code: "error", message };
  }

  const json = (await response.json().catch(() => null)) as { id?: string } | null;
  return { ok: true, id: json?.id };
}