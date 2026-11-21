const MAILPIT =
  process.env.MAILPIT_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:54324";

type MailpitMessageSummary = {
  ID: string;
  To: { Address: string }[];
  Subject: string;
  Created: string;
};

type MailpitMessage = {
  ID: string;
  HTML: string;
  Text: string;
};

export async function waitForMail(
  toEmail: string,
  subjectIncludes: string,
  timeoutMs = 20_000,
): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  const needle = toEmail.toLowerCase();
  while (Date.now() < deadline) {
    const listRes = await fetch(`${MAILPIT}/api/v1/messages`);
    if (!listRes.ok) throw new Error(`mailpit list ${listRes.status}`);
    const list = (await listRes.json()) as { messages: MailpitMessageSummary[] };
    const hit = (list.messages ?? []).find(
      (m) =>
        m.Subject.includes(subjectIncludes) &&
        m.To.some((t) => t.Address.toLowerCase() === needle),
    );
    if (hit) {
      const msgRes = await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`);
      if (!msgRes.ok) throw new Error(`mailpit message ${msgRes.status}`);
      return (await msgRes.json()) as MailpitMessage;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `No Mailpit message to ${toEmail} with subject containing "${subjectIncludes}"`,
  );
}

export function extractConfirmLink(htmlOrText: string): string {
  const match = htmlOrText.match(
    /https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/i,
  );
  if (!match?.[0]) {
    throw new Error("No /auth/confirm link found in email");
  }
  return match[0].replace(/&amp;/g, "&");
}
