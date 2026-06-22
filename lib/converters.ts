/**
 * Registry of all client-side converters. Each entry drives:
 *   - a dedicated SEO page at /converter/{slug} (metadata + JSON-LD + content)
 *   - the converter tool UI (accept/multiple + the run function)
 * Run functions live in lib/convert.ts and execute entirely in the browser.
 */
import {
  convertImage, imagesToPdf, pdfToImages, mergePdfs, splitPdf, ocrToText,
  type ConvertResult, type ProgressCb,
} from "./convert";

export type ConverterCategory = "Images" | "PDF" | "Text";

export type Converter = {
  slug: string;
  category: ConverterCategory;
  /** Card label, e.g. "PNG to JPG". */
  name: string;
  /** Absolute <title>. */
  title: string;
  h1: string;
  tagline: string;
  description: string;
  keywords: string[];
  /** input accept attribute */
  accept: string;
  /** allow multiple files (image-to-pdf, merge) */
  multiple?: boolean;
  /** interactive tools (organize-pdf) render their own component, not the generic engine */
  interactive?: boolean;
  /** short note shown under the dropzone */
  note?: string;
  steps: { name: string; text: string }[];
  faq: { q: string; a: string }[];
  run?: (files: File[], onProgress?: ProgressCb) => Promise<ConvertResult>;
};

const STEPS = (verb: string, out: string): { name: string; text: string }[] => [
  { name: "Upload your file", text: "Drag and drop or pick your file. It's read locally in your browser — nothing is uploaded to a server." },
  { name: verb, text: `We ${verb.toLowerCase()} it right on your device, instantly and privately.` },
  { name: `Download the ${out}`, text: `Save your ${out}. No watermark, no sign-up, no limits.` },
];

const PRIVACY_FAQ = { q: "Are my files uploaded anywhere?", a: "No. The conversion runs entirely in your browser using on-device processing — your files never leave your computer, so it's safe for private documents." };
const FREE_FAQ = { q: "Is it free?", a: "Yes, completely free and unlimited, with no sign-up and no watermark." };

export const CONVERTERS: Converter[] = [
  /* ------------------------------ Images ------------------------------ */
  {
    slug: "png-to-jpg", category: "Images", name: "PNG to JPG",
    title: "PNG to JPG Converter — Free, Private, In Your Browser",
    h1: "Convert PNG to JPG", tagline: "Turn PNG images into compact JPG files.",
    description: "Free PNG to JPG converter. Convert PNG images to high-quality JPG right in your browser — no upload, no watermark, no sign-up. Fast and private.",
    keywords: ["png to jpg", "png to jpeg", "convert png to jpg", "png to jpg converter", "change png to jpg", "png to jpg free"],
    accept: "image/png", note: "PNG transparency is flattened onto a white background.",
    steps: STEPS("Convert to JPG", "JPG"),
    faq: [FREE_FAQ, PRIVACY_FAQ, { q: "Will the quality drop?", a: "JPG is compressed at 92% quality — visually indistinguishable for photos and screenshots, with a much smaller file size than PNG." }],
    run: (f) => convertImage(f[0], "image/jpeg", "jpg"),
  },
  {
    slug: "jpg-to-png", category: "Images", name: "JPG to PNG",
    title: "JPG to PNG Converter — Free Online, No Upload",
    h1: "Convert JPG to PNG", tagline: "Turn JPG photos into lossless PNG images.",
    description: "Free JPG to PNG converter. Convert JPG/JPEG to lossless PNG in your browser — private, instant, no watermark or sign-up.",
    keywords: ["jpg to png", "jpeg to png", "convert jpg to png", "jpg to png converter", "change jpg to png"],
    accept: "image/jpeg",
    steps: STEPS("Convert to PNG", "PNG"),
    faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => convertImage(f[0], "image/png", "png"),
  },
  {
    slug: "webp-to-png", category: "Images", name: "WebP to PNG",
    title: "WebP to PNG Converter — Free & Private",
    h1: "Convert WebP to PNG", tagline: "Turn WebP images into widely-supported PNG.",
    description: "Free WebP to PNG converter. Convert WebP to lossless PNG in your browser — no upload, instant, no watermark.",
    keywords: ["webp to png", "convert webp to png", "webp to png converter", "save webp as png"],
    accept: "image/webp",
    steps: STEPS("Convert to PNG", "PNG"),
    faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => convertImage(f[0], "image/png", "png"),
  },
  {
    slug: "webp-to-jpg", category: "Images", name: "WebP to JPG",
    title: "WebP to JPG Converter — Free Online",
    h1: "Convert WebP to JPG", tagline: "Turn WebP images into compact JPG files.",
    description: "Free WebP to JPG converter. Convert WebP to JPG in your browser — private, instant, no watermark or sign-up.",
    keywords: ["webp to jpg", "webp to jpeg", "convert webp to jpg", "webp to jpg converter"],
    accept: "image/webp",
    steps: STEPS("Convert to JPG", "JPG"),
    faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => convertImage(f[0], "image/jpeg", "jpg"),
  },
  {
    slug: "png-to-webp", category: "Images", name: "PNG to WebP",
    title: "PNG to WebP Converter — Free, Smaller Images",
    h1: "Convert PNG to WebP", tagline: "Shrink PNGs into modern WebP images.",
    description: "Free PNG to WebP converter. Convert PNG to WebP for smaller files in your browser — private, instant, no sign-up.",
    keywords: ["png to webp", "convert png to webp", "png to webp converter"],
    accept: "image/png",
    steps: STEPS("Convert to WebP", "WebP"),
    faq: [FREE_FAQ, PRIVACY_FAQ, { q: "Why WebP?", a: "WebP files are typically 25–35% smaller than PNG/JPG at the same quality, which speeds up websites." }],
    run: (f) => convertImage(f[0], "image/webp", "webp"),
  },
  {
    slug: "jpg-to-webp", category: "Images", name: "JPG to WebP",
    title: "JPG to WebP Converter — Free Online",
    h1: "Convert JPG to WebP", tagline: "Shrink JPGs into modern WebP images.",
    description: "Free JPG to WebP converter. Convert JPG/JPEG to WebP for smaller files in your browser — private and instant.",
    keywords: ["jpg to webp", "jpeg to webp", "convert jpg to webp", "jpg to webp converter"],
    accept: "image/jpeg",
    steps: STEPS("Convert to WebP", "WebP"),
    faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => convertImage(f[0], "image/webp", "webp"),
  },
  {
    slug: "image-to-pdf", category: "Images", name: "Image to PDF",
    title: "Image to PDF Converter — Combine JPG/PNG into a PDF",
    h1: "Convert images to PDF", tagline: "Turn one or many images into a single PDF.",
    description: "Free image to PDF converter. Combine JPG, PNG, and WebP images into a single PDF in your browser — private, no watermark, no sign-up.",
    keywords: ["image to pdf", "jpg to pdf", "png to pdf", "images to pdf", "convert image to pdf", "photo to pdf", "jpg to pdf converter"],
    accept: "image/*", multiple: true, note: "Add multiple images — each becomes one PDF page, in order.",
    steps: STEPS("Build the PDF", "PDF"),
    faq: [FREE_FAQ, PRIVACY_FAQ, { q: "Can I combine several images?", a: "Yes — select multiple images and they'll be added as pages in the order you choose." }],
    run: (f) => imagesToPdf(f),
  },

  /* -------------------------------- PDF ------------------------------- */
  {
    slug: "pdf-to-jpg", category: "PDF", name: "PDF to JPG",
    title: "PDF to JPG Converter — Free, Each Page as an Image",
    h1: "Convert PDF to JPG", tagline: "Turn every PDF page into a JPG image.",
    description: "Free PDF to JPG converter. Turn each PDF page into a high-resolution JPG image in your browser — downloaded as a ZIP. Private, no sign-up.",
    keywords: ["pdf to jpg", "pdf to jpeg", "convert pdf to jpg", "pdf to image", "pdf to jpg converter", "extract images from pdf"],
    accept: "application/pdf", note: "Each page becomes a JPG; you get them all in a ZIP.",
    steps: STEPS("Render to JPG", "ZIP of JPGs"),
    faq: [FREE_FAQ, PRIVACY_FAQ, { q: "How are the images delivered?", a: "Each page is rendered to a high-resolution JPG and bundled into a single ZIP download." }],
    run: (f, p) => pdfToImages(f[0], "image/jpeg", "jpg", p),
  },
  {
    slug: "pdf-to-png", category: "PDF", name: "PDF to PNG",
    title: "PDF to PNG Converter — Free, Crisp Page Images",
    h1: "Convert PDF to PNG", tagline: "Turn every PDF page into a lossless PNG.",
    description: "Free PDF to PNG converter. Render each PDF page to a crisp PNG in your browser, downloaded as a ZIP — private and instant.",
    keywords: ["pdf to png", "convert pdf to png", "pdf to png converter", "pdf page to png", "pdf to image"],
    accept: "application/pdf", note: "Each page becomes a PNG; you get them all in a ZIP.",
    steps: STEPS("Render to PNG", "ZIP of PNGs"),
    faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f, p) => pdfToImages(f[0], "image/png", "png", p),
  },
  {
    slug: "merge-pdf", category: "PDF", name: "Merge PDF",
    title: "Merge PDF — Combine PDFs Free, In Your Browser",
    h1: "Merge PDF files", tagline: "Combine multiple PDFs into one document.",
    description: "Free merge PDF tool. Combine multiple PDF files into a single document in your browser — text and quality preserved, private, no sign-up.",
    keywords: ["merge pdf", "combine pdf", "join pdf", "merge pdf files", "pdf merger", "combine pdf files free"],
    accept: "application/pdf", multiple: true, note: "Add two or more PDFs — they're joined in order.",
    steps: STEPS("Merge the PDFs", "merged PDF"),
    faq: [FREE_FAQ, PRIVACY_FAQ, { q: "Is the text still selectable?", a: "Yes — merging preserves the original vector text and quality of every page (it isn't flattened to images)." }],
    run: (f) => mergePdfs(f),
  },
  {
    slug: "split-pdf", category: "PDF", name: "Split PDF",
    title: "Split PDF — Free, Every Page as Its Own PDF",
    h1: "Split a PDF", tagline: "Break a PDF into one file per page.",
    description: "Free split PDF tool. Split a PDF into separate single-page PDFs in your browser, downloaded as a ZIP — private and instant.",
    keywords: ["split pdf", "split pdf pages", "separate pdf pages", "pdf splitter", "extract pdf pages", "split pdf free"],
    accept: "application/pdf", note: "Every page becomes its own PDF, bundled in a ZIP.",
    steps: STEPS("Split the pages", "ZIP of PDFs"),
    faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f, p) => splitPdf(f[0], p),
  },
  {
    slug: "organize-pdf", category: "PDF", name: "Organize PDF",
    title: "Organize PDF — Reorder, Rotate & Delete Pages Free",
    h1: "Organize PDF pages", tagline: "Reorder, rotate, and delete pages, then save.",
    description: "Free organize PDF tool. Rearrange, rotate, and remove pages inside a PDF visually in your browser, then download the new PDF — private, no sign-up.",
    keywords: ["organize pdf", "reorder pdf pages", "rearrange pdf", "rotate pdf pages", "delete pdf pages", "edit pdf pages", "reorganize pdf"],
    accept: "application/pdf", interactive: true, note: "Drag-free: move pages up/down, rotate, or delete, then download.",
    steps: [
      { name: "Upload your PDF", text: "Pick your PDF — its pages are rendered locally as thumbnails. Nothing is uploaded." },
      { name: "Reorder, rotate, delete", text: "Move pages up or down, rotate them, or remove the ones you don't want." },
      { name: "Download the new PDF", text: "Save the reorganized PDF. Page content stays sharp and selectable." },
    ],
    faq: [FREE_FAQ, PRIVACY_FAQ, { q: "Does it keep the text?", a: "Yes — pages are copied as-is (vector text and images preserved), only reordered/rotated. Nothing is flattened to an image." }],
  },

  /* ------------------------------- Text ------------------------------- */
  {
    slug: "ocr-pdf", category: "Text", name: "OCR PDF",
    title: "OCR PDF — Extract Text from Scanned PDFs Free",
    h1: "OCR a PDF to text", tagline: "Pull editable text out of scanned PDFs.",
    description: "Free OCR PDF tool. Extract text from scanned or image PDFs in your browser using on-device OCR — download a .txt file. Private, no sign-up.",
    keywords: ["ocr pdf", "pdf to text", "extract text from pdf", "scanned pdf to text", "pdf ocr", "ocr pdf free", "convert scanned pdf to text"],
    accept: "application/pdf,image/*", note: "Works on scanned PDFs and images. Larger files take longer.",
    steps: [
      { name: "Upload your file", text: "Pick a scanned PDF or image. It's processed locally — nothing is uploaded." },
      { name: "Run OCR", text: "On-device optical character recognition reads the text from every page." },
      { name: "Download the text", text: "Save the recognized text as a .txt file." },
    ],
    faq: [FREE_FAQ, PRIVACY_FAQ, { q: "Which languages?", a: "English is supported out of the box. Recognition quality depends on the scan resolution and clarity." }],
    run: (f, p) => ocrToText(f[0], p),
  },
  {
    slug: "image-to-text", category: "Text", name: "Image to Text",
    title: "Image to Text (OCR) — Free, Private, In Browser",
    h1: "Extract text from an image", tagline: "OCR a photo or screenshot into text.",
    description: "Free image to text OCR. Extract text from JPG, PNG, or WebP images in your browser using on-device OCR — download a .txt file. Private, no sign-up.",
    keywords: ["image to text", "photo to text", "ocr image", "extract text from image", "picture to text", "jpg to text", "png to text"],
    accept: "image/*", note: "Works best on clear, high-contrast images.",
    steps: [
      { name: "Upload your image", text: "Pick a JPG, PNG, or WebP. It's processed locally — nothing is uploaded." },
      { name: "Run OCR", text: "On-device optical character recognition reads the text from the image." },
      { name: "Download the text", text: "Save the recognized text as a .txt file." },
    ],
    faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f, p) => ocrToText(f[0], p),
  },
];

export const CONVERTER_CATEGORIES: ConverterCategory[] = ["Images", "PDF", "Text"];

export function getConverter(slug: string): Converter | undefined {
  return CONVERTERS.find((c) => c.slug === slug);
}
