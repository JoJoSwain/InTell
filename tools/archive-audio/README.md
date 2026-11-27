# archive-audio

Download the audio and image bytes for an InTell story archive that staff exported from the admin dashboard.

## Why

`export-archive` returns a zip of metadata, transcripts and Story Notes. The zip's `manifest.json` lists every asset with a **1-hour signed URL**. This tool reads that manifest, downloads the files into `audio/` and `images/`, and checks each sha256. It needs **no API keys or env**.

## Usage

1. In the admin Dashboard, **Export archive** and unzip the zip.
2. Within one hour of the export:

```bash
pnpm --filter @intell/archive-audio archive-audio -- /path/to/unzipped-archive
```

Or from this folder:

```bash
node src/cli.mjs /path/to/unzipped-archive
```

3. Files land as `{sha}.{ext}` under `audio/` and `images/`. Already-present files with a matching sha are skipped.

If a URL has expired (or returns 401/403), re-export from the admin and run again.
