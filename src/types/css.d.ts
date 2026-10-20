// Lets TypeScript accept plain side-effect CSS imports (e.g. `import "./globals.css"`).
// Needed on TS 5.9+/6, which type-checks side-effect imports. Next only declares `*.module.css`.
declare module "*.css";
