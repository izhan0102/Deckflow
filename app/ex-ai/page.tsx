import type { Metadata } from "next";
import ExAiChat from "@/components/ExAiChat";
import { SITE_URL } from "@/lib/seo";

const PATH = "/ex-ai";
const TITLE = "Ask EX-AI — Your AI Guide to EXdeck";
const DESCRIPTION =
  "Chat with EX-AI, the built-in assistant that knows every EXdeck tool. Ask it to make a presentation, document, spreadsheet, resume, or analyse files — it guides you and takes you straight there.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}${PATH}`, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function ExAiPage() {
  return <ExAiChat />;
}
