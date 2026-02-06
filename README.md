# Rose Day Surprise 🌹

An interactive 3D web experience for a special surprise.

## How to Run locally

Since this project uses ES Modules for Three.js, you cannot simply open `index.html` directly in the browser (due to CORS security policies). You need a local server.

### Option 1: VS Code Live Server (Recommended)
1.  Install the **Live Server** extension in VS Code.
2.  Right-click `index.html` and select **"Open with Live Server"**.

### Option 2: Python
If you have Python installed, run this in the project folder:
```bash
python -m http.server
```
Then open `http://localhost:8000`.

## How to Customize

1.  **Text**: Edit `index.html` to change the wishes and the letter content.
2.  **Photos**: Replace the `.photo-placeholder` divs in `index.html` with actual `<img>` tags.
    ```html
    <img src="path/to/your/photo.jpg" class="memory-photo">
    ```
3.  **Audio**: Replace the source URL in the `<audio id="bg-music">` tag with your own music file.
4.  **Final Rose**: By default, a procedural generative rose is shown. To use a real 3D model:
    - Put your `.glb` or `.gltf` model in the folder.
    - Edit `script.js` in the `spawnSpecialRose` function to use `GLTFLoader`.

## Deployment
Simply upload `index.html`, `style.css`, and `script.js` to GitHub and enable **GitHub Pages** from the repository settings.
