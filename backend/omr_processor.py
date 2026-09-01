import re
import signal
import subprocess 
import os
from typing import Counter 
import music21
from music21 import converter
from music21 import clef
import numpy as np
from PIL import Image
import glob
from image_enhancement import enhance_music
import xml.etree.ElementTree as ET
from gevent import sleep as gevent_sleep
import psutil

AUDIVERIS_PATH = os.getenv("AUDIVERIS_PATH", "/opt/audiveris/bin/Audiveris")

GRID = [0.0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0]

#without this would still fail bc even tho the task is abortted using celery the audiveris 
#process has to be killed when abort is triggered otherwise u can't delete created files bc the 
#process sys is still busy and control isnt returned to the os to manage the files
def kill_process_tree(pid):
    #Recursively kills a process and all of its child processes (Java, shell, etc.).
    try:
        parent = psutil.Process(pid)
        children = parent.children(recursive=True)
        
        # Terminate children first
        for child in children:
            child.kill()
        parent.kill()

        # Block until all processes are gone from OS memory
        gone, alive = psutil.wait_procs(children + [parent], timeout=5)
    except psutil.NoSuchProcess:
        pass
    except Exception as e:
        print(f"[OMR] Error killing process tree: {e}")

def run_audiveris(image_path, output_dir, progress_cb = None):
    command = [
        AUDIVERIS_PATH,
        "-batch",
        "-export",
        "-output", output_dir,
        "-option", "org.audiveris.omr.export.Compressed=false",
        image_path
    ]

    progress_cb("Booting up Audiveris")
    print("Starting Audiveris scan...")

    popen_kwargs = {
        "stdout": subprocess.PIPE,
        "stderr": subprocess.STDOUT,
        "text": True,
        "close_fds": True
    }

    if os.name == 'nt':
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        popen_kwargs["preexec_fn"] = os.setsid

    process = subprocess.Popen(command, **popen_kwargs)

    output_lines = []
    try:
        # stream output line by line as Audiveris produces it
        for line in process.stdout:
            line = line.rstrip()
            if not line:
                continue
            output_lines.append(line)
            print(line)  # keep it visible in the worker's own console too
            if progress_cb:
                cleaned = re.sub(r'^INFO\s*\[.*?\]\s*', '', line, flags=re.IGNORECASE).strip()
                progress_cb(cleaned)

        process.wait()
        if process.returncode != 0:
            # give the last handful of lines as error context, same intent as the old stderr capture
            raise RuntimeError("\n".join(output_lines[-20:]))

        return "\n".join(output_lines)

    finally:
        # Guarantee cleanup runs EVERY time (success, error, or gevent abort)
        if process.poll() is None:
            progress_cb("Killing OMR scan")
            print(f"[OMR] Forcefully stopping process tree PID {process.pid}...")
            kill_process_tree(process.pid)
            gevent_sleep(0.5)  # Yield to gevent hub to release Win32 file locks

def locate_exports(image_path):

    upload_dir = os.path.dirname(image_path)

    base_name = os.path.splitext(
        os.path.basename(image_path)
    )[0]

    patterns = [
        f"{base_name}.musicxml",
        f"{base_name}.xml",
        f"{base_name}.mxl",
        f"{base_name}.mvt*.musicxml",
        f"{base_name}.mvt*.xml",
        f"{base_name}.mvt*.mxl",
    ]

    exported_files = []

    for pattern in patterns:

        full_pattern = os.path.join(
            upload_dir,
            pattern
        )

        matches = glob.glob(full_pattern)

        exported_files.extend(matches)

    exported_files = sorted(set(exported_files))

    print("Discovered exports:")
    for f in exported_files:
        print(f)

    return exported_files

#prevent corrupted exports from crashing music21
def validate_xml(xml_path):

    # Compressed MusicXML (.mxl)
    if xml_path.endswith(".mxl"):
        return True

    try:
        ET.parse(xml_path)
        return True

    except Exception as e:
        print(f"Invalid XML: {e}")
        return False

def snap_to_grid(value):
    return round(round(value * 4) / 4, 3) #snap to the nearest 16th note 

def parse_score(xml_file):
    if not validate_xml(xml_file):
        raise RuntimeError("MusicXML validation failed")

    score = converter.parse(xml_file)

    print(f"Total parts: {len(score.parts)}")
    for i, part in enumerate(score.parts):
        notes = list(part.recurse().notesAndRests)
        actual_notes = [e for e in notes if not e.isRest]
        print(f"  Part {i}: '{part.partName}' — {len(notes)} events, {len(actual_notes)} non-rests")


    extracted_events = []

    for part_index, part in enumerate(score.parts):

        clefs_found = part.recurse().getElementsByClass(clef.Clef)
        first_clef = clefs_found[0] if clefs_found else None

        clef_name = (
            "Treble" if isinstance(first_clef, music21.clef.TrebleClef) else
            "Tenor" if isinstance(first_clef, music21.clef.TenorClef) else
            "Bass" if isinstance(first_clef, music21.clef.BassClef) else
            "Treble"
        )

        for element in part.recurse().notesAndRests:

            #skip tied continuations (i.e. two notes tied together being read as 2 notes instead of one)
            if hasattr(element, 'tie') and element.tie and element.tie.type in ('continue', 'stop'):
                continue

            #skip grace notes - note we might want to make this an option eventually
            # if element.duration.quarterLength == 0:
            #     continue

            # absolute offset from start of piece, not within-measure offset
            abs_offset = snap_to_grid(float(element.getOffsetInHierarchy(part)))
            duration = snap_to_grid(float(element.duration.quarterLength))

            event = {
                "offset": abs_offset,
                "duration": duration,
                "part": part_index,
            }

            if element.isRest:
                event["type"] = "rest"
                event["pitch"] = {"pitch": None, "clef": clef_name}
                extracted_events.append(event)
                continue

            if isinstance(element, music21.note.Note):
                if element.tie and element.tie.type in ('continue', 'stop'):
                    continue
                event["type"] = "note"
                event["pitches"] = [{"pitch": element.pitch.simplifyEnharmonic(mostCommon=True).nameWithOctave, "clef": clef_name}]
                extracted_events.append(event)

            elif isinstance(element, music21.chord.Chord):
                event["type"] = "chord"
                event["pitches"] = [{"pitch": p.nameWithOctave, "clef": clef_name} for p in element.pitches]
                extracted_events.append(event)

    return extracted_events

def clean_extracted_note_chord_errs(extracted_events):
    extracted_events.sort(key=lambda e: e["offset"])
        # deduped = []
        # last_end = -1
        # for event in extracted_events:
        #     if event["type"] == "rest":
        #         deduped.append(event)
        #         continue
        #     if event["offset"] < last_end:
        #         continue  # skip overlapping note
        #     deduped.append(event)
        #     last_end = event["offset"] + event["duration"]

        # return deduped

    return extracted_events

def group_events(events):
    parts = {}

    for event in events:
        if (event['part'] not in parts):
            parts[event['part']] = [event]
        else:
            parts[event['part']].append(event)

    return parts

def clean_offsets(events, beats_per_measure = 4):

    parts = group_events(events)

    total_corrections = 0
    total_notes = 0
    final = []

    for _, part_events in parts.items():
        cleaned_part, corrections, note_count = clean_offsets_single_event(part_events, beats_per_measure)
        final.extend(cleaned_part)
        total_corrections += corrections
        total_notes += note_count    

    qual = "High"
    if total_notes == 0:
        return final, qual

    pct = total_corrections / total_notes

    #1 correction every 32 notes
    if pct <= 1 / 32:
        qual = "High"
    elif pct <= 1 / 16:
        qual = "Medium"
    else:
        qual = "Low"

    return final, qual
        
def clean_offsets_single_event(events, beats_per_measure):

    cursor = 0.0
    result = []

    correction_count = 0
    total_notes = len(events)
    
    for event in events:
        # Check if this note would overflow the current measure
        beat_in_measure = round(cursor % beats_per_measure, 6)
        space_left = round(beats_per_measure - beat_in_measure, 6)
        
        # If note duration overflows the measure, cap it and insert a rest
        # (handles Audiveris misreads that bleed into the next measure)
        if event['duration'] > space_left + 0.001 and beat_in_measure > 0.001:
            correction_count += 1
            # Fill rest of measure with a rest
            result.append({
                'type': 'rest',
                'duration': snap_to_grid(space_left),
                'offset': cursor,
                'part': event['part'], 
                'pitch': {"pitch": None, "clef": (prev_event['pitch']['clef'] if prev_event['type'] == 'rest' else prev_event['pitches'][0]['clef']) if prev_event else 'Treble'}
            })
            cursor = round(cursor + space_left, 6)
        
        event['offset'] = cursor
        cursor = round(cursor + event['duration'], 6)
        result.append(event)
        prev_event = event
    
    return result, correction_count, total_notes

#note structure that comes out of here
#   {
#     "type": "chord",
#     "pitches": ["C4", "E4"],
#     "offset": 0,
#     "duration": 1
#   }

def extract_notes(image_path, preprocess_preset="clean_pdf", progress_cb = None):

    def notify(mssg, pct = None):
        if progress_cb:
            progress_cb(mssg, pct)

    upload_dir = os.path.dirname(image_path)

    base_name = os.path.splitext(os.path.basename(image_path))[0]

    #preprocess
    for preset in ["audiveris_compat", preprocess_preset]:

        notify(f'Prepping image with preset: {preset}')
        enhanced_path = os.path.join(upload_dir, f"enhanced_{base_name}.png")
        enhance_music(image_path, enhanced_path, notify, preset)

        try:
            notify(f"Attempting OMR with preset: {preset}")
            print(f"Attempting OMR with preset: {preset}")
            run_audiveris(enhanced_path, upload_dir, progress_cb=progress_cb)
            exported_files = locate_exports(enhanced_path)

            if exported_files:
                notify(f"Preset '{preset}' succeeded")
                print(f"Preset '{preset}' succeeded")
                break
            else:
                notify(f"Preset '{preset}' produced no exports, trying next")
                print(f"Preset '{preset}' produced no exports, trying next...")

        except Exception as e:
            notify(f"Preset '{preset}' produced no exports, trying next")
            print(f"Preset '{preset}' failed: {e}, trying next...")
            exported_files = []

    if not exported_files:
        raise RuntimeError("Audiveris completed but exported no MusicXML")
    #interpret extracted content 
    all_events = []

    qual = "High"
    for i in range(len(exported_files)):
        xml_file = exported_files[i]
        try:
            notify(f"Cleaning export {i+1} ({xml_file})")
            events = parse_score(xml_file)
            events = clean_extracted_note_chord_errs(events)

            #inserts rests at the end of unsynced measures so that the initial render 
            #aligns both the song derivation based on offsets with the sheetmusic display
            #based on duration (unsynced measures due to user edits will be handled at the frontend)
            #hard coded / defaulted to 4 beats per measure
            events, qual = clean_offsets(events, 4)

            for e in all_events[:10]:
                print(e)

            all_events.extend(events)

        except Exception as e:
            notify(f"Skipping bad export {xml_file}: {e}")
            print(f"Skipping bad export {xml_file}: {e}")

    if not all_events:
        notify("No musical events extracted")
        raise RuntimeError("No musical events extracted")

    notify(f"Extracted {len(all_events)} musical events")
    print(f"Extracted {len(all_events)} musical events")

    return all_events, qual