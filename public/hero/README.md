# Hero images

Drop landscape photographs here, then name them in
`lib/data/hero-slides.ts`. A file alone does nothing — the manifest is
what puts it on the page, and it is also where each slide's alt text and
optional headline live.

- **Format**: JPEG or WebP. WebP is roughly 30% smaller at the same
  quality and every browser this site supports reads it.
- **Size**: at least 1600px wide, 16:9 or wider. `next/image` serves a
  resized copy per device, so a larger original costs nothing at request
  time — but keep the file under about 1MB so the repository stays small.
- **Composition**: the headline sits centred on top. A photograph with a
  busy centre reads badly however the scrim is tuned; leave the middle
  quiet and put the subject to one side.

With no files listed, the hero renders its copy over the inspection grid,
exactly as it did before. One file is a still hero with that photograph
behind it. Two or more make it a carousel.
