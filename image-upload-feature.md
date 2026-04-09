# Feature: Image Upload Overhaul

## Summary
Fixes a broken image upload flow caused by misconfigured AWS credentials/bucket, adds server-side PNG conversion for all uploaded images, and redesigns the image input UI to support pasting directly from the clipboard via a split button (primary: paste, secondary dropdown: upload from file).

## Scope
- **In scope**: Fix S3 upload failure (infrastructure prerequisite noted below), PNG conversion on the server, clipboard paste support, extract shared `ImageUploader` component, apply changes to both `MediaFormPage` and `ActorFormPage`
- **Out of scope**: Drag-and-drop upload, image cropping/resizing, uploading from a URL

## Data Model Changes
No data model changes required.

## API Changes
No new endpoints. The existing `POST /api/upload` behavior changes internally:

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| POST | /api/upload | EDITOR+ | Accepts any supported image type; now converts to PNG before storing in S3. Response `url` will always end in `.png`. |

**Server-side change detail:**
- Add `sharp` as a server dependency
- In the upload route handler, after multer receives the file and before calling `uploadToS3`, convert the buffer to PNG using `sharp`
- Override `file.mimetype` to `image/png` and `file.originalname` to use `.png` extension before passing to `uploadToS3`

## Frontend Changes

| Route | Component | Change Type | Description |
|-------|-----------|-------------|-------------|
| `/movies/new`, `/movies/:id/edit` | `MediaFormPage.tsx` | Modified | Replace inline `ImageUploader` with shared component |
| `/actors/new`, `/actors/:id/edit` | `ActorFormPage.tsx` | Modified | Replace inline `ImageUploader` with shared component |
| N/A | `client/src/components/ImageUploader.tsx` | New | Shared component extracted from both form pages |

**`ImageUploader` component redesign:**

*Empty state (no image set):*
- The dashed box remains but is now clickable to trigger clipboard paste (not file upload)
- Inside the box: `Clipboard` icon (lucide) + "Click to paste image" text
- Below the box (outside it): a small muted text link "or upload from file →" that triggers the hidden file input
- Loading spinner renders inside the box during upload (same as before)

*Filled state (image already loaded — edit form or after upload):*
- Image renders in the dashed box with the X button in the top-right to clear it (unchanged)
- Below the box: a small ghost-style **"Replace image"** button (with `↺` / `RefreshCw` icon) — clicking triggers clipboard paste
- Next to it: a smaller muted text link **"· or upload"** — clicking triggers the hidden file input
- When loading (replacing), spinner renders inside the box over the existing image

**Implementation notes:**
- Use shadcn/ui `Button` (variant `ghost`, size `sm`) for the "Replace image" button
- The "or upload from file →" and "· or upload" links are plain `<button>` elements styled with `text-xs text-muted-foreground hover:text-foreground underline`
- Use `Clipboard` icon for paste actions, `RefreshCw` icon for the replace button, `Upload` icon is no longer needed in this component

## Acceptance Criteria
- [ ] Uploading a JPEG, WebP, or GIF converts it to PNG before storage; the returned S3 URL ends in `.png`
- [ ] Uploading a PNG passes through correctly (still stored as PNG)
- [ ] The image input area shows a split button: left = "Paste Image", right = chevron dropdown with "Upload from file"
- [ ] Clicking "Paste Image" reads from the clipboard and uploads the image if one is present
- [ ] If the clipboard contains no image, a toast error appears: "No image found in clipboard"
- [ ] If clipboard permission is denied by the browser, a toast error appears: "Clipboard access denied"
- [ ] Selecting "Upload from file" opens the OS file picker and uploads the selected file
- [ ] Both paths show a loading spinner in the preview box during upload
- [ ] After a successful upload, the image preview renders in the box
- [ ] The X button still clears the image
- [ ] Both `MediaFormPage` and `ActorFormPage` use the shared `ImageUploader` component
- [ ] Cast role image fields in `MediaFormPage` are not affected

## Edge Cases & Error States
- **No image in clipboard:** Toast "No image found in clipboard"
- **Clipboard permission denied:** Toast "Clipboard access denied"
- **Clipboard API not available** (non-secure context): The paste button should still render; if clicked, show toast "Clipboard paste is not supported in this browser"
- **Upload fails (S3 error):** Toast "Upload failed" (unchanged from current behavior)
- **Non-image file in clipboard:** `ClipboardItem` types filter; only process `image/*` items — show "No image found in clipboard" if none match

## Non-Obvious Notes
- **Infrastructure prerequisite (upload bug fix):** The upload failure is caused by the S3 bucket `mymdb-dev-assets` not existing or the IAM user (credentials in `server/.env`) lacking `s3:PutObject` and `s3:DeleteObject` permissions on it. The bucket must exist in `us-east-2` (matching `AWS_REGION` in `server/.env`) before uploads will work. The code requires no changes for this — only bucket creation and IAM policy attachment. **This must be resolved before local testing.**
- **`ImageUploader` is currently duplicated:** `MediaFormPage.tsx` and `ActorFormPage.tsx` each define their own `ImageUploader` function. Extract into `client/src/components/ImageUploader.tsx` with the full prop signature from `MediaFormPage` (`value`, `onChange`, `label`, `aspect`).
- **`sharp` needs a server install:** Run `npm install sharp` from `server/`. The `@types/sharp` types are bundled with the package (no separate `@types` package needed).
- **PNG conversion placement:** Convert in the upload route handler (not inside `uploadToS3`) so `uploadToS3` stays a thin S3 wrapper. Pass the converted buffer and overridden mimetype/filename as a modified file object.
- **Clipboard API returns a Blob, not a File:** `ClipboardItem.getType('image/png')` returns a `Promise<Blob>`. Convert to `File` with `new File([blob], 'clipboard-image.png', { type: blob.type })` before passing to `handleFile`.
