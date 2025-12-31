# Icon Setup Instructions

To change the app icon to your custom image (the cat with glasses holding a newspaper):

## Steps:

1. **Prepare your icon image:**
   - Save your cat icon image as a PNG file
   - Recommended size: **1024x1024 pixels** (square, transparent background works best)
   - Name it: `app-icon.png`

2. **Place the icon file:**
   - Copy `app-icon.png` to the `GithubReleasesManager/src-tauri/` directory

3. **Generate all icon formats:**
   - Run this command in the `GithubReleasesManager` directory:
   ```bash
   npm run tauri icon
   ```
   Or directly:
   ```bash
   npx @tauri-apps/cli icon src-tauri/app-icon.png
   ```

4. **This will automatically generate:**
   - `icon.ico` (Windows)
   - `icon.icns` (macOS)
   - `icon.png` (Linux)
   - Various PNG sizes (32x32, 128x128, etc.)
   - All files will be placed in `src-tauri/icons/`

5. **Rebuild the app:**
   - The icons will be used automatically in the next build
   - For development: `npm run tauri dev`
   - For production: `npm run tauri build`

6. **Update web favicon (optional):**
   - Copy `src-tauri/icons/icon.png` to `GithubReleasesManager/public/icon.png`
   - This will be used as the favicon in the browser/webview

## Note:
- The icon generator will automatically update all the icon files
- The configuration in `tauri.conf.json` is already set up correctly
- The HTML favicon has been updated to use the new icon
- After generating icons, you may need to copy `icon.png` to the `public/` folder for the web favicon

