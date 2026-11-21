import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { hashMarkerCode } from "@/lib/markers/code";
import { linkDomain } from "@/lib/maps/config";
import { l10nEn } from "@/lib/geo";

type Props = { params: Promise<{ fragmentId: string }> };

export default async function PrintMarkerPage({ params }: Props) {
  const { fragmentId } = await params;
  const supabase = await createClient();

  const { data: frag } = await supabase
    .from("fragments")
    .select("id, title, marker_code, visibility")
    .eq("id", fragmentId)
    .maybeSingle();

  if (!frag || !frag.marker_code) notFound();

  // Never put the code in the URL query — path is fragment id only.
  const code = frag.marker_code as string;
  const domain = linkDomain();
  const qrPayload = `https://${domain}/f/${code}`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });

  const workingHash = await hashMarkerCode(code);
  const { data: snap } = await supabase
    .from("published_snapshots")
    .select("data")
    .eq("entity", "fragment")
    .eq("entity_id", fragmentId)
    .maybeSingle();

  const snapHash =
    snap?.data &&
    typeof snap.data === "object" &&
    snap.data !== null &&
    "markerHash" in (snap.data as object)
      ? String((snap.data as { markerHash?: string }).markerHash ?? "")
      : "";

  const needsRelease = !snapHash || snapHash !== workingHash;
  const title = l10nEn(frag.title) || "Fragment";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        .marker-print {
          max-width: 28rem;
          margin: 2rem auto;
          text-align: center;
          font-family: Georgia, "Times New Roman", serif;
        }
        .marker-qr {
          width: 2.2in;
          height: 2.2in;
          margin: 0 auto;
        }
        .marker-code {
          font-family: ui-monospace, monospace;
          font-size: 1.5rem;
          letter-spacing: 0.12em;
          margin-top: 0.75rem;
        }
      `}</style>
      <main className="marker-print">
        <p className="no-print mb-6 text-sm">
          <Link href="/story/groves" className="underline">
            Back to groves
          </Link>
          {" · "}
          Use your browser Print dialog. This page has no sidebar.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="QR code for physical marker"
          className="marker-qr"
          width={512}
          height={512}
        />
        <p className="marker-code" aria-label="Marker code">
          {code}
        </p>
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        {needsRelease ? (
          <p className="mt-4 text-sm" role="status">
            This code works once the fragment is released.
          </p>
        ) : null}
      </main>
    </>
  );
}
