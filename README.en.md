# FB Notes Extended

[Tiếng Việt](./README.md)

A Chrome extension that allows writing unlimited-length Facebook notes with custom durations in minutes.

## Features

- **Bypass 60 character limit**: Write notes up to 10,000 characters instead of Facebook's default 60 character limit
- **Custom duration**: Choose display time from 1 hour to 3 days, or enter any number of minutes
- **Audience selection**: Share publicly, with friends, contacts, or customize specific friend lists
- **Attach music**: Add your favorite songs to notes
- **Dark mode**: Minimalist, easy-to-read design
- **Multilingual**: Supports Vietnamese and English

<img src="screenshots/image.png" width="300"/>

## Installation

### Method 1: Download pre-built extension (Recommended)

1. Download `FB-Notes-Extended.zip` from [Releases](https://github.com/DuckCIT/FB-Notes-Extended/releases)
2. Unzip the file to any folder
3. Open Chrome, go to `chrome://extensions/`
4. Enable **Developer mode** in the top right corner
5. Click **Load unpacked**
6. Select the unzipped folder
7. Extension is ready to use!

### Method 2: Build from source

Requirements: Node.js 18+

1. Clone the repository to your machine
2. Open terminal in the project folder
3. Run `npm install` to install dependencies
4. Run `npm run build` to build the extension
5. Load the `dist` folder as an unpacked extension in Chrome

## Usage

### Creating a new note

1. Open [Facebook](https://facebook.com) and log in
2. Click the extension icon on the Chrome toolbar
3. Write your note content in the composer
4. Select options:
   - **Audience**: Public, Friends, Contacts, or Custom
   - **Duration**: 1h, 6h, 24h, 3d, or enter custom minutes
   - **Music**: Search and select a song to attach
5. Click **Share**

### Deleting current note

When a note is currently displayed, a delete button (trash icon) will appear in the top right corner of the popup. Click it to delete the current note.

## Notes

- Extension only works when you're on facebook.com
- Actual character limit is 10,000 (due to Facebook API limits)
- Maximum duration can exceed 3 days by entering custom minutes

## Project structure

```
├── dist/                  # Built extension (load this folder into Chrome)
├── public/
│   ├── icons/            # Extension icons
│   └── manifest.json     # Chrome extension manifest
├── src/
│   ├── background/       # Service worker handling API calls
│   ├── content/          # Content script
│   ├── lib/              # Utilities
│   └── popup/            # Popup UI (React)
├── popup.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Development

- `npm install` - Install dependencies
- `npm run dev` - Development mode with hot reload
- `npm run build` - Production build

## Contributing

All contributions are welcome! Please create a Pull Request or Issue on GitHub.

## License

MIT License

---

**Tiếng Việt**: [README.md](./README.md)
