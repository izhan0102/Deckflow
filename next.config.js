/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdfjs-dist and tesseract.js reference optional Node-only modules
    // ("canvas", "fs", etc.) that aren't needed in the browser. Tell
    // webpack to resolve them to nothing so the client build doesn't fail.
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      canvas: false,
      fs: false,
      path: false,
    };
    return config;
  },
};
module.exports = nextConfig;
