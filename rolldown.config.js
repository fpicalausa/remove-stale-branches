export default {
  input: 'src/index.js', // Your main entry point (same as ncc's input)
  output: {
    file: 'dist/index.js', // Target output file
    format: 'esm',
    minify: "dce-only",
  },
  external: [],
  platform: 'node',        // Ensures Node.js built-ins aren't treated as web assets
};