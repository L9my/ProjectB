# Birthday Page

A lightweight, frontend-only birthday surprise. Visitors see a simple "Enter" button over a black background; after clicking, a 3D birthday cake appears with orbit controls and optional looping music. Built with Three.js and ready for GitHub Pages deployment.

## Running locally
Open `index.html` in a modern browser or serve the folder with any static server (e.g., `python -m http.server`).

## Customizing
- Place your cake model at `assets/cake.glb` (GLB/GLTF). Draco-compressed GLBs are supported via the bundled decoder; if a
  model fails to load, the app falls back to a stylized placeholder.
- Add your own audio track at `assets/birthday-melody.wav` if you want background music. The page will run without the file.
