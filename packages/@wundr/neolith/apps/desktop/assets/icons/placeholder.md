# App Icons

Place your application icons in this directory:

## Required Icons

### macOS
- `icon.icns` - Main app icon (all sizes from 16x16 to 1024x1024)
- `tray-icon.png` - Menu bar tray icon (16x16, should be monochrome)
- `notification-info.png` - Info notification icon
- `notification-warning.png` - Warning notification icon  
- `notification-error.png` - Error notification icon
- `notification-success.png` - Success notification icon

### Windows
- `icon.ico` - Main app icon (multiple sizes: 16, 32, 48, 256)
- `tray-icon.ico` - System tray icon

### Linux
- `icon.png` - Main app icon (512x512)
- Various sizes: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256, 512x512

## Icon Guidelines

### Design Principles
- Use clear, recognizable imagery
- Maintain consistent style across all icons
- Ensure good visibility at small sizes (16x16)
- Use appropriate contrast ratios

### Technical Requirements
- **Format**: PNG for most, ICNS for macOS, ICO for Windows
- **Color Space**: sRGB
- **Transparency**: Supported where appropriate
- **Naming**: Use exact names as listed above

### Tray Icon Specific
- Should be monochrome (black/white)
- Must work on both light and dark backgrounds
- Template images preferred (will adapt to system appearance)
- Keep design simple and recognizable at 16x16

## Generation Tools

You can generate icons from a source image using:
- [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder)
- [icon-gen](https://www.npmjs.com/package/icon-gen) 
- Online tools like [icoconvert.com](https://icoconvert.com)

## Build Integration

The build process will automatically:
1. Look for icons in this directory
2. Use them in the final application bundle
3. Fall back to default Electron icons if not found
4. Warn if required icons are missing