# mothra-evaluator

A browser-based tool for evaluating Kraken BLLA line segmentation results on medieval manuscript folios.

## Usage (for Gen)

1. Open **Chrome or Edge** and go to `https://ddmal.github.io/mothra-evaluator/`
2. Click **"Open project folder"** and select your local `mothra-text` directory
3. The app reads segmentation JSON from `outputs/kraken_blla/segmentation/` and images from `data/folios/`
4. Click any line polygon on the image to select it, then add tags and comments in the right panel
5. Evaluations auto-save to `evaluations.json` in your project folder — push this file to GitHub to back it up

**Keyboard shortcuts:** press `?` in the app for the full reference.

## For developers

### Requirements

- Node 20+
- Chrome or Edge (File System Access API required)

### Setup

```bash
npm install
npm run dev
```

### Data format

The app reads files produced by `run_kraken.py` in [mothra-text](https://github.com/DDMAL/mothra-text):

```
mothra-text/
├── data/folios/              # source images (jpg, png, …)
└── outputs/kraken_blla/
    └── segmentation/
        └── {stem}_kraken.json
```

Evaluations are written to `evaluations.json` at the project root.

### Adding a new model

Write an adapter in `src/data/` converting the model's output to `CanonicalPage` (defined in `src/types.ts`). No other files need to change.

### Deployment

Pushing to `main` triggers the GitHub Actions workflow which deploys to GitHub Pages automatically.
