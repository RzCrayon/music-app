FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# --- System deps ---
# python3 + pip: your Flask/Celery app
# wget: to grab the Audiveris .deb at build time
# libgl1 / libglib2.0-0: runtime deps for opencv-python (cv2) on a headless image
# libfluidsynth3: native library required by the pyfluidsynth Python binding
#   (song_builder.py does `import fluidsynth`, which loads this .so at import
#   time — without it the whole app fails to even start, not just MIDI
#   rendering). This was implicitly present on your Windows machine but isn't
#   installed on a bare Ubuntu image by default.
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    wget \
    libgl1 \
    libglib2.0-0 \
    libfluidsynth3 \
    && rm -rf /var/lib/apt/lists/*

# --- Audiveris ---
# 5.9.0 ships a .deb with a bundled JRE, so no separate `apt install openjdk` needed.
# It installs itself to /opt/audiveris/ and drops a launcher at /opt/audiveris/bin/Audiveris
# If a newer version comes out, bump the version/filename here.
#
# The .deb's postinst script tries to register a desktop menu entry via
# xdg-desktop-menu, which fails in a headless container (exit status 3,
# "No writable system menu directory found") because there's no desktop
# environment. We only need the OMR binary, not the icon — so we stub out
# xdg-desktop-menu (and its siblings) as no-ops before installing, which lets
# the postinst script complete without error. The app files themselves are
# unaffected either way.
RUN apt-get update && apt-get install -y xdg-utils \
    && for cmd in xdg-desktop-menu xdg-desktop-icon xdg-icon-resource xdg-mime; do \
         printf '#!/bin/sh\nexit 0\n' > /usr/bin/$cmd && chmod +x /usr/bin/$cmd; \
       done \
    && wget -O /tmp/audiveris.deb \
       https://github.com/Audiveris/audiveris/releases/download/5.9.0/Audiveris-5.9.0-ubuntu24.04-x86_64.deb \
    && apt-get install -y /tmp/audiveris.deb \
    && rm /tmp/audiveris.deb \
    && rm -rf /var/lib/apt/lists/*

# Belt-and-suspenders: some Java/Swing apps still probe for a display even in
# batch mode. Force headless mode globally so Audiveris never tries to open one.
ENV JAVA_TOOL_OPTIONS="-Djava.awt.headless=true"
ENV AUDIVERIS_PATH="/opt/audiveris/bin/Audiveris"

WORKDIR /app

# --- Python deps ---
# Copy just requirements first so Docker caches this layer between rebuilds
COPY requirements.txt .
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt

# --- App code ---
COPY . .

RUN mkdir -p static/audio static/uploads

EXPOSE 5000

# app.py already runs its own WSGIServer (gevent) on 127.0.0.1:5000 —
# switch that host to 0.0.0.0 (see note below) so it's reachable from
# outside the container.
CMD ["python3", "app.py"]
