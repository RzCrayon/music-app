A full-stack web application for digitizing, editing, practicing, and scoring sheet music in real-time.

Live Demo: https://music-app-test2.netlify.app

User Journey and Key Features:
  1. Authentication & Dashboard
    - Account Access: Secure JWT-based registration and password-protected sign-in.
    - Song Dashboard: Centralized workspace to view, organize, and manage your entire music library.
  
  2. Interactive Practice & Song Workspace
    - Audio Playback: Built-in audio controls at the top of the workspace with active playback positioning and interactive cursor tracking to skip to key sections.
    - Integrated Metronome: Configurable click track to practice rhythm and tempo accuracy.
    - Interactive Practice & AI Scoring: Turn on the microphone to play along on a live instrument. Recordings are analyzed and scored in real-time against the score to measure practice performance.
    - Attempt Tracking: Complete history of past performance attempts, complete with filtering options and attempt management.
  
  3. Digitization & OMR Scanning
    - Sheet Music Upload: Scan PNG or JPG images of physical sheet music.
    - Automated OMR Parsing: Integrated Audiveris engine analyzes the image and automatically converts it into an editable digital composition.
  
  4. Interactive Song Builder
    - Note-Level Editing: Add, edit, shift, or delete notes dynamically across measures.
    - Region Selection & Bulk Operations: Highlight full regions to copy, paste, or clear multiple notes simultaneously.
    - History Management: Full Ctrl + Z undo system to revert unwanted edits.
    - Composition Feasibility Validation: Processing systems check note ranges to guarantee compositions remain physically play-tested and feasible for the selected target instrument.
    - Instant Client-Side Preview: Preview edits live in the browser without backend API re-rendering calls.
    - State Persistence: Local storage integration prevents data loss during browser refreshes.
    - Reference Image View: Upload and split-screen a original image as a visual reference while building the score.
    - Instrument Conversion: Transpose and adjust sheet music written for one instrument directly into a compatible key and range for another.

Tech Stack & Architecture:

  Frontend
    - Language: TypeScript (.ts / .tsx)
    - Framework: React
    - Build Tool: Vite
    - Audio Synthesis: Tone.js
    - Pitch Detection & Analysis: Spotify Basic Pitch (transcribes audio recordings to score attempts)

  Backend
    - Language: Python (.py)
    - Web Server & WSGI: Flask, Gevent
    - Database: PostgreSQL
    - Task Queue & Caching: Celery, Redis
    - Optical Music Recognition: Audiveris (OMR)
    - Cloud Storage: Cloudflare R2 (S3-compatible storage for raw sheet music images)
    - Auth & Security: JWT Auth, Bcrypt, IP-based Rate Limiting

Repository Structure: 

```text
├── frontend/
│   ├── public/                      # Static assets, instrument images, SVG loaders
│   │   ├── fonts/                   # Web typography & custom music notation fonts
│   │   └── samples/                 # Instrument audio samples (via tonejs-instruments)
│   └── src/
│       ├── components/              # Shared UI components (dropdowns, modals, popups)
│       ├── services/                # API wrappers, TypeScript types, audio state & localStorage managers
│       └── SheetMusic/              # Core score rendering, interaction, and editor logic
│
└── backend/
    ├── app.py                       # REST API route handlers and endpoints
    ├── db_setup.py                  # PostgreSQL database initialization & migration setup
    ├── omr_processor.py             # Audiveris OMR integration utilities
    ├── tasks.py                     # Celery & Redis task queue worker implementations
    ├── token_supplier.py            # JWT authentication manager
    └── song_builder.py              # [DEPRECATED] Legacy Fluid_R3 rendering script
```
