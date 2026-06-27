/**
 * Registry of all client-side converters. Each entry drives:
 *   - a dedicated SEO page at /converter/{slug} (metadata + JSON-LD + content)
 *   - the converter tool UI (accept/multiple + the run function)
 * Run functions live in lib/convert.ts and execute entirely in the browser.
 */
import {
  convertImage, imagesToPdf, pdfToImages, mergePdfs, splitPdf, ocrToText,
  svgToRaster, pdfToText, txtToPdf, pptxToText, docxToText,
  csvToJson, jsonToCsv, csvToExcel, excelToCsv, excelToJson, jsonToExcel,
  heicToImage, addPagesToPdf,
  type ConvertResult, type ProgressCb,
} from "./convert";

export type ConverterCategory = "Images" | "PDF" | "Data" | "Documents" | "Text";

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

  {
    slug: "gif-to-png", category: "Images", name: "GIF to PNG",
    title: "GIF to PNG Converter — Free, In Your Browser",
    h1: "Convert GIF to PNG", tagline: "Turn a GIF into a lossless PNG image.",
    description: "Free GIF to PNG converter. Convert a GIF to a lossless PNG in your browser — no upload, no watermark, no sign-up.",
    keywords: ["gif to png", "convert gif to png", "gif to png converter", "save gif as png"],
    accept: "image/gif", note: "Animated GIFs convert their first frame.",
    steps: STEPS("Convert to PNG", "PNG"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => convertImage(f[0], "image/png", "png"),
  },
  {
    slug: "gif-to-jpg", category: "Images", name: "GIF to JPG",
    title: "GIF to JPG Converter — Free Online",
    h1: "Convert GIF to JPG", tagline: "Turn a GIF into a compact JPG image.",
    description: "Free GIF to JPG converter. Convert a GIF to JPG in your browser — private, instant, no watermark or sign-up.",
    keywords: ["gif to jpg", "gif to jpeg", "convert gif to jpg", "gif to jpg converter"],
    accept: "image/gif", note: "Animated GIFs convert their first frame.",
    steps: STEPS("Convert to JPG", "JPG"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => convertImage(f[0], "image/jpeg", "jpg"),
  },
  {
    slug: "bmp-to-png", category: "Images", name: "BMP to PNG",
    title: "BMP to PNG Converter — Free & Private",
    h1: "Convert BMP to PNG", tagline: "Turn bitmap BMP images into compact PNG.",
    description: "Free BMP to PNG converter. Convert BMP bitmap images to PNG in your browser — no upload, instant, no watermark.",
    keywords: ["bmp to png", "convert bmp to png", "bmp to png converter", "bitmap to png"],
    accept: "image/bmp,.bmp",
    steps: STEPS("Convert to PNG", "PNG"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => convertImage(f[0], "image/png", "png"),
  },
  {
    slug: "bmp-to-jpg", category: "Images", name: "BMP to JPG",
    title: "BMP to JPG Converter — Free Online",
    h1: "Convert BMP to JPG", tagline: "Turn bitmap BMP images into compact JPG.",
    description: "Free BMP to JPG converter. Convert BMP bitmap images to JPG in your browser — private, instant, no sign-up.",
    keywords: ["bmp to jpg", "bmp to jpeg", "convert bmp to jpg", "bitmap to jpg"],
    accept: "image/bmp,.bmp",
    steps: STEPS("Convert to JPG", "JPG"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => convertImage(f[0], "image/jpeg", "jpg"),
  },
  {
    slug: "svg-to-png", category: "Images", name: "SVG to PNG",
    title: "SVG to PNG Converter — Free, Crisp Raster Export",
    h1: "Convert SVG to PNG", tagline: "Rasterize SVG vector graphics into PNG.",
    description: "Free SVG to PNG converter. Rasterize SVG vector graphics to a crisp PNG in your browser — private, instant, no sign-up.",
    keywords: ["svg to png", "convert svg to png", "svg to png converter", "rasterize svg", "svg to image"],
    accept: "image/svg+xml,.svg", note: "Vector SVG is rendered to a high-resolution PNG.",
    steps: STEPS("Convert to PNG", "PNG"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => svgToRaster(f[0], "image/png", "png"),
  },
  {
    slug: "svg-to-jpg", category: "Images", name: "SVG to JPG",
    title: "SVG to JPG Converter — Free Online",
    h1: "Convert SVG to JPG", tagline: "Rasterize SVG vector graphics into JPG.",
    description: "Free SVG to JPG converter. Rasterize SVG vector graphics to JPG in your browser — private, instant, no watermark.",
    keywords: ["svg to jpg", "svg to jpeg", "convert svg to jpg", "svg to jpg converter"],
    accept: "image/svg+xml,.svg", note: "Transparent areas are flattened onto a white background.",
    steps: STEPS("Convert to JPG", "JPG"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => svgToRaster(f[0], "image/jpeg", "jpg"),
  },
  {
    slug: "avif-to-jpg", category: "Images", name: "AVIF to JPG",
    title: "AVIF to JPG Converter — Free, In Your Browser",
    h1: "Convert AVIF to JPG", tagline: "Turn modern AVIF images into compatible JPG.",
    description: "Free AVIF to JPG converter. Convert AVIF images to widely-supported JPG in your browser — private, instant, no sign-up.",
    keywords: ["avif to jpg", "avif to jpeg", "convert avif to jpg", "avif to jpg converter"],
    accept: "image/avif,.avif", note: "Needs a browser that can decode AVIF (recent Chrome, Edge, Firefox).",
    steps: STEPS("Convert to JPG", "JPG"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => convertImage(f[0], "image/jpeg", "jpg"),
  },
  {
    slug: "avif-to-png", category: "Images", name: "AVIF to PNG",
    title: "AVIF to PNG Converter — Free & Private",
    h1: "Convert AVIF to PNG", tagline: "Turn modern AVIF images into lossless PNG.",
    description: "Free AVIF to PNG converter. Convert AVIF images to PNG in your browser — private, instant, no watermark.",
    keywords: ["avif to png", "convert avif to png", "avif to png converter"],
    accept: "image/avif,.avif", note: "Needs a browser that can decode AVIF (recent Chrome, Edge, Firefox).",
    steps: STEPS("Convert to PNG", "PNG"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => convertImage(f[0], "image/png", "png"),
  },
  {
    slug: "compress-jpg", category: "Images", name: "Compress JPG",
    title: "Compress JPG — Free Image Compressor, In Your Browser",
    h1: "Compress a JPG", tagline: "Shrink JPG file size while keeping it sharp.",
    description: "Free JPG compressor. Reduce JPG/JPEG file size in your browser with smart re-encoding — private, instant, no watermark or sign-up.",
    keywords: ["compress jpg", "compress jpeg", "jpg compressor", "reduce jpg size", "shrink jpg", "compress image"],
    accept: "image/jpeg", note: "Re-encodes at ~55% quality for a much smaller file.",
    steps: STEPS("Compress the image", "JPG"), faq: [FREE_FAQ, PRIVACY_FAQ, { q: "Will it look worse?", a: "Compression is tuned to stay visually close to the original while cutting file size significantly. For photos and screenshots the difference is hard to notice." }],
    run: (f) => convertImage(f[0], "image/jpeg", "jpg", 0.55),
  },

  {
    slug: "heic-to-jpg", category: "Images", name: "HEIC to JPG",
    title: "HEIC to JPG Converter — iPhone Photos to JPG, Free",
    h1: "Convert HEIC to JPG", tagline: "Turn iPhone HEIC photos into universal JPG.",
    description: "Free HEIC to JPG converter. Convert Apple iPhone HEIC/HEIF photos to widely-supported JPG right in your browser — private, instant, no upload, no watermark.",
    keywords: ["heic to jpg", "heic to jpeg", "iphone photo to jpg", "convert heic to jpg", "heic to jpg converter", "heic converter", "apple heic to jpg", "iphone heic to jpg"],
    accept: "image/heic,image/heif,.heic,.heif", note: "iPhone .heic/.heif photos are decoded right on your device.",
    steps: STEPS("Convert to JPG", "JPG"),
    faq: [FREE_FAQ, PRIVACY_FAQ, { q: "What is HEIC?", a: "HEIC (HEIF) is the high-efficiency photo format iPhones use by default. JPG is supported everywhere, so converting makes your photos easy to share and open on any device." }],
    run: (f) => heicToImage(f[0], "image/jpeg", "jpg"),
  },
  {
    slug: "heic-to-png", category: "Images", name: "HEIC to PNG",
    title: "HEIC to PNG Converter — iPhone Photos to PNG, Free",
    h1: "Convert HEIC to PNG", tagline: "Turn iPhone HEIC photos into lossless PNG.",
    description: "Free HEIC to PNG converter. Convert Apple iPhone HEIC/HEIF photos to lossless PNG in your browser — private, instant, no upload or sign-up.",
    keywords: ["heic to png", "iphone photo to png", "convert heic to png", "heic to png converter", "apple heic to png"],
    accept: "image/heic,image/heif,.heic,.heif", note: "iPhone .heic/.heif photos are decoded right on your device.",
    steps: STEPS("Convert to PNG", "PNG"),
    faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => heicToImage(f[0], "image/png", "png"),
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
    slug: "pdf-to-webp", category: "PDF", name: "PDF to WebP",
    title: "PDF to WebP Converter — Free, Small Page Images",
    h1: "Convert PDF to WebP", tagline: "Turn every PDF page into a compact WebP.",
    description: "Free PDF to WebP converter. Render each PDF page to a small, modern WebP in your browser, downloaded as a ZIP — private and instant.",
    keywords: ["pdf to webp", "convert pdf to webp", "pdf to webp converter", "pdf page to webp"],
    accept: "application/pdf", note: "Each page becomes a WebP; you get them all in a ZIP.",
    steps: STEPS("Render to WebP", "ZIP of WebPs"),
    faq: [FREE_FAQ, PRIVACY_FAQ, { q: "Why WebP?", a: "WebP pages are typically 25–35% smaller than PNG or JPG at the same quality — handy for the web." }],
    run: (f, p) => pdfToImages(f[0], "image/webp", "webp", p),
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
    slug: "add-pages-to-pdf", category: "PDF", name: "Add Pages to PDF",
    title: "Add Pages to PDF — Insert Pages & Images Free, In Browser",
    h1: "Add pages to a PDF", tagline: "Combine PDFs and images into one PDF, in order.",
    description: "Free add-pages-to-PDF tool. Append pages from other PDFs or add images (JPG, PNG, and more) as new pages into one PDF — in your browser, private, no watermark or sign-up.",
    keywords: ["add pages to pdf", "insert pages into pdf", "add page to pdf", "combine pdf and images", "append pages to pdf", "add image to pdf", "insert pdf into pdf"],
    accept: "application/pdf,image/*", multiple: true, note: "Add PDFs and/or images — combined into one PDF in the order you add them.",
    steps: STEPS("Add the pages", "PDF"),
    faq: [FREE_FAQ, PRIVACY_FAQ, { q: "Can I mix PDFs and images?", a: "Yes — add any combination of PDF files and images. PDF pages are copied as-is and each image becomes a full page, in the order you add them." }],
    run: (f, p) => addPagesToPdf(f, p),
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

  /* ------------------------------- Data ------------------------------- */
  {
    slug: "csv-to-json", category: "Data", name: "CSV to JSON",
    title: "CSV to JSON Converter — Free, In Your Browser",
    h1: "Convert CSV to JSON", tagline: "Turn a CSV table into a JSON array of objects.",
    description: "Free CSV to JSON converter. Turn CSV rows into a clean JSON array of objects (first row becomes the keys) in your browser — private, instant, no sign-up.",
    keywords: ["csv to json", "convert csv to json", "csv to json converter", "csv to json online"],
    accept: "text/csv,.csv", note: "The first row is used as the JSON keys.",
    steps: STEPS("Convert to JSON", "JSON file"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => csvToJson(f[0]),
  },
  {
    slug: "json-to-csv", category: "Data", name: "JSON to CSV",
    title: "JSON to CSV Converter — Free Online",
    h1: "Convert JSON to CSV", tagline: "Flatten a JSON array of objects into a CSV.",
    description: "Free JSON to CSV converter. Turn a JSON array of objects into a spreadsheet-ready CSV (keys become columns) in your browser — private and instant.",
    keywords: ["json to csv", "convert json to csv", "json to csv converter", "json array to csv"],
    accept: "application/json,.json", note: "Works on a JSON array of objects (keys become columns).",
    steps: STEPS("Convert to CSV", "CSV file"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => jsonToCsv(f[0]),
  },
  {
    slug: "csv-to-excel", category: "Data", name: "CSV to Excel",
    title: "CSV to Excel (XLSX) Converter — Free, In Your Browser",
    h1: "Convert CSV to Excel", tagline: "Turn a CSV into a real .xlsx workbook.",
    description: "Free CSV to Excel converter. Turn a CSV file into a real .xlsx workbook (opens in Excel, Google Sheets, Numbers) in your browser — private, instant, no sign-up.",
    keywords: ["csv to excel", "csv to xlsx", "convert csv to excel", "csv to excel converter", "csv to xlsx online"],
    accept: "text/csv,.csv", note: "The first row is bolded as a header.",
    steps: STEPS("Convert to Excel", "XLSX file"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => csvToExcel(f[0]),
  },
  {
    slug: "excel-to-csv", category: "Data", name: "Excel to CSV",
    title: "Excel (XLSX) to CSV Converter — Free Online",
    h1: "Convert Excel to CSV", tagline: "Turn the first sheet of an .xlsx into CSV.",
    description: "Free Excel to CSV converter. Turn the first worksheet of an .xlsx file into a clean CSV in your browser — private, instant, no watermark.",
    keywords: ["excel to csv", "xlsx to csv", "convert excel to csv", "excel to csv converter", "xlsx to csv online"],
    accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", note: "The first worksheet is exported.",
    steps: STEPS("Convert to CSV", "CSV file"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => excelToCsv(f[0]),
  },
  {
    slug: "excel-to-json", category: "Data", name: "Excel to JSON",
    title: "Excel (XLSX) to JSON Converter — Free, In Your Browser",
    h1: "Convert Excel to JSON", tagline: "Turn an .xlsx sheet into a JSON array.",
    description: "Free Excel to JSON converter. Turn the first worksheet of an .xlsx into a JSON array of objects (header row becomes keys) in your browser — private and instant.",
    keywords: ["excel to json", "xlsx to json", "convert excel to json", "excel to json converter"],
    accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", note: "The first row is used as the JSON keys.",
    steps: STEPS("Convert to JSON", "JSON file"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => excelToJson(f[0]),
  },
  {
    slug: "json-to-excel", category: "Data", name: "JSON to Excel",
    title: "JSON to Excel (XLSX) Converter — Free Online",
    h1: "Convert JSON to Excel", tagline: "Turn a JSON array of objects into an .xlsx.",
    description: "Free JSON to Excel converter. Turn a JSON array of objects into a real .xlsx workbook (keys become columns) in your browser — private, instant, no sign-up.",
    keywords: ["json to excel", "json to xlsx", "convert json to excel", "json to excel converter"],
    accept: "application/json,.json", note: "Works on a JSON array of objects (keys become columns).",
    steps: STEPS("Convert to Excel", "XLSX file"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => jsonToExcel(f[0]),
  },

  /* ---------------------------- Documents ----------------------------- */
  {
    slug: "txt-to-pdf", category: "Documents", name: "TXT to PDF",
    title: "TXT to PDF Converter — Free, In Your Browser",
    h1: "Convert TXT to PDF", tagline: "Turn a plain-text file into a clean PDF.",
    description: "Free TXT to PDF converter. Turn a plain-text (.txt) file into a clean, paginated A4 PDF in your browser — private, instant, no watermark or sign-up.",
    keywords: ["txt to pdf", "text to pdf", "convert txt to pdf", "txt to pdf converter", "text file to pdf"],
    accept: "text/plain,.txt", note: "Lines are wrapped and paginated automatically.",
    steps: STEPS("Build the PDF", "PDF"), faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => txtToPdf(f[0]),
  },
  {
    slug: "pdf-to-text", category: "Documents", name: "PDF to Text",
    title: "PDF to Text Converter — Extract Text Free, In Browser",
    h1: "Convert PDF to text", tagline: "Pull the text layer out of a PDF, fast.",
    description: "Free PDF to text converter. Extract the embedded text from a PDF to a .txt file in your browser — fast, private, no OCR needed. For scanned PDFs, use the OCR tool.",
    keywords: ["pdf to text", "extract text from pdf", "pdf to txt", "convert pdf to text", "pdf text extractor"],
    accept: "application/pdf", note: "Extracts the real text layer (not OCR). Scanned PDFs: use OCR PDF.",
    steps: STEPS("Extract the text", "TXT file"), faq: [FREE_FAQ, PRIVACY_FAQ, { q: "What about scanned PDFs?", a: "This pulls the embedded text layer, which scanned/image PDFs don't have. For those, use the OCR PDF tool, which reads text from the page images." }],
    run: (f, p) => pdfToText(f[0], p),
  },

  {
    slug: "pptx-to-text", category: "Documents", name: "PPTX to Text",
    title: "PPTX to Text — Extract PowerPoint Text Free, In Browser",
    h1: "Convert PPTX to text", tagline: "Pull all the text out of a PowerPoint.",
    description: "Free PPTX to text extractor. Pull every slide's text out of a PowerPoint (.pptx) into a clean .txt file in your browser — private, instant, no upload, no sign-up.",
    keywords: ["pptx to text", "powerpoint to text", "extract text from pptx", "ppt to text", "pptx text extractor", "extract powerpoint text"],
    accept: ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation", note: "Reads the real slide text, slide by slide. No OCR needed.",
    steps: STEPS("Extract the text", "TXT file"),
    faq: [FREE_FAQ, PRIVACY_FAQ, { q: "Does it keep slide order?", a: "Yes — text is extracted slide by slide, in order, and each slide is labelled so you can tell them apart." }],
    run: (f, p) => pptxToText(f[0], p),
  },
  {
    slug: "docx-to-text", category: "Documents", name: "DOCX to Text",
    title: "DOCX to Text — Extract Word Text Free, In Your Browser",
    h1: "Convert DOCX to text", tagline: "Pull the text out of a Word document.",
    description: "Free DOCX to text extractor. Pull the text out of a Word (.docx) document into a clean .txt file in your browser — private, instant, no upload or sign-up.",
    keywords: ["docx to text", "word to text", "extract text from docx", "doc to text", "docx text extractor", "word document to text"],
    accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document", note: "Reads the document body, headers, and footers.",
    steps: STEPS("Extract the text", "TXT file"),
    faq: [FREE_FAQ, PRIVACY_FAQ],
    run: (f) => docxToText(f[0]),
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

export const CONVERTER_CATEGORIES: ConverterCategory[] = ["Images", "PDF", "Data", "Documents", "Text"];

export function getConverter(slug: string): Converter | undefined {
  return CONVERTERS.find((c) => c.slug === slug);
}
