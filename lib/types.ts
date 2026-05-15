import type { Theme } from "./themes";

export type SlideLayout =
  | "title-hero"
  | "bullets"
  | "table"
  | "two-column"
  | "quote"
  | "section"
  | "references"
  | "closing";

export type Anchor =
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "middle-center" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export type Annotation = {
  id: string;
  text: string;
  anchor: Anchor;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
};

export type ContentDensity = "concise" | "balanced" | "detailed" | "comprehensive";

export type ElementId = "title" | "subtitle" | "bullets" | "body" | "table" | "quote";
export type ElementOffset = { dx: number; dy: number };

export type TableData = {
  headers: string[];
  rows: string[][];
  source?: string;
};

export type Reference = {
  id?: string;
  text: string;
  url?: string;
};

export type UploadedImage = {
  id: string;
  dataUrl: string;     // base64 data: URL
  x: number;           // inches from left
  y: number;           // inches from top
  w: number;           // inches
  h: number;           // inches
};

export type Slide = {
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  body?: string;
  notes?: string;
  table?: TableData;
  references?: Reference[];

  // Per-slide style overrides set via the chat box.
  titleScale?: number;
  bodyScale?: number;
  fontOverride?: "sans" | "serif" | "mono";
  textColorOverride?: string;
  accentColorOverride?: string;
  backgroundColorOverride?: string;

  // Per-element offsets (drag), scales (size menu), and hidden flags
  elementOffsets?: Partial<Record<ElementId, ElementOffset>>;
  elementScales?: Partial<Record<ElementId, number>>;       // multiplier (legacy)
  elementFontSizes?: Partial<Record<ElementId, number>>;     // absolute pt size override
  elementHidden?: Partial<Record<ElementId, boolean>>;

  annotations?: Annotation[];
  uploadedImages?: UploadedImage[];
};

export type Deck = {
  title: string;
  subtitle?: string;
  slides: Slide[];
  topic?: string;
  audience?: string;
  tone?: string;
  density?: ContentDensity;
  references?: Reference[];
  includeReferences?: boolean;
};

export type GenerateRequest = {
  prompt: string;
  theme: Theme;
  slideCount: number;
  audience?: string;
  tone?: string;
  density?: ContentDensity;
  includeReferences?: boolean;
};
