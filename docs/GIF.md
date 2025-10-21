# Screen Recording → GIF Conversion Guide

This guide explains how to turn a `.mov` screen recording into a high-quality, fast-playing GIF for GitHub or documentation use.

## Requirements

- macOS with Terminal
- [Homebrew](https://brew.sh) installed
- FFmpeg installed:
  ```bash
  brew install ffmpeg
  ```
- (Optional) Gifsicle for final optimization:
  ```bash
  brew install gifsicle
  ```

## Steps

### 1. Record Your Screen

Use the built-in macOS **Screenshot** tool (`Shift + Command + 5`) and choose **Record Entire Screen** or **Record Selected Portion**.  
When finished, macOS saves a `.mov` file to your Desktop.

### 2. Generate a Color Palette

From Terminal (in the same folder as your `.mov` file):

```bash
cd ~/Desktop
ffmpeg -i your-video.mov -vf "fps=15,scale=800:-1:flags=lanczos,palettegen" palette.png
```

This creates `palette.png` — a custom color table that improves GIF quality and reduces size.

### 3. Create the GIF

Use this command to create a high-quality GIF with faster playback:

```bash
ffmpeg -i your-video.mov -i palette.png -filter_complex "setpts=0.5*PTS,fps=15,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a" extension-demo.gif
```

**Parameters explained:**

- `setpts=0.5*PTS` → doubles playback speed (use smaller for faster GIFs)
- `fps=15` → frame rate (adjust for smoothness vs. size)
- `scale=800:-1` → width of 800px, height auto-scaled
- `paletteuse=dither=sierra2_4a` → dithering for smooth motion

### 4. (Optional) Optimize the GIF

Compress the GIF to make it lightweight for GitHub:

```bash
gifsicle -O3 extension-demo.gif -o extension-demo-optimized.gif
```

### 5. Add to Your GitHub Repo

Move the GIF into your repository, commit, and push:

```bash
git add extension-demo.gif
git commit -m "Add extension demo GIF"
git push
```

Reference it in your `README.md`:

```markdown
![Extension Demo](extension-demo.gif)
```

## Notes

- You can tweak parameters for speed or size:
  - For smoother GIFs: increase `fps` to 20.
  - For smaller GIFs: reduce `scale` to 600 or lower.
  - For slower playback: increase `setpts` to `1.0*PTS`.
- Works with `.mov`, `.mp4`, or any video format supported by ffmpeg.
