import mido 
from mido import Message, MidiFile, MidiTrack
import fluidsynth
import subprocess
import os
import music21

FLUIDSYNTH_PATH = r"C:\Users\ank54\Downloads\fluidsynth-v2.5.4-win10-x64-cpp11\fluidsynth\bin\fluidsynth.exe"

INSTRUMENT_MAP = {
    'piano': 0,
    # 'guitar': 24,
    'trumpet': 56,
}

MIDI_MAP = {
    "C0": 12, "C#0": 13, "Db0": 13, "D0": 14, "D#0": 15, "Eb0": 15,
    "E0": 16, "F0": 17, "F#0": 18, "Gb0": 18, "G0": 19, "G#0": 20, "Ab0": 20,
    "A0": 21, "A#0": 22, "Bb0": 22, "B0": 23,

    "C1": 24, "C#1": 25, "Db1": 25, "D1": 26, "D#1": 27, "Eb1": 27,
    "E1": 28, "F1": 29, "F#1": 30, "Gb1": 30, "G1": 31, "G#1": 32, "Ab1": 32,
    "A1": 33, "A#1": 34, "Bb1": 34, "B1": 35,

    "C2": 36, "C#2": 37, "Db2": 37, "D2": 38, "D#2": 39, "Eb2": 39,
    "E2": 40, "F2": 41, "F#2": 42, "Gb2": 42, "G2": 43, "G#2": 44, "Ab2": 44,
    "A2": 45, "A#2": 46, "Bb2": 46, "B2": 47,

    "C3": 48, "C#3": 49, "Db3": 49, "D3": 50, "D#3": 51, "Eb3": 51,
    "E3": 52, "F3": 53, "F#3": 54, "Gb3": 54, "G3": 55, "G#3": 56, "Ab3": 56,
    "A3": 57, "A#3": 58, "Bb3": 58, "B3": 59,

    "C4": 60, "C#4": 61, "Db4": 61, "D4": 62, "D#4": 63, "Eb4": 63,
    "E4": 64, "F4": 65, "F#4": 66, "Gb4": 66, "G4": 67, "G#4": 68, "Ab4": 68,
    "A4": 69, "A#4": 70, "Bb4": 70, "B4": 71,

    "C5": 72, "C#5": 73, "Db5": 73, "D5": 74, "D#5": 75, "Eb5": 75,
    "E5": 76, "F5": 77, "F#5": 78, "Gb5": 78, "G5": 79, "G#5": 80, "Ab5": 80,
    "A5": 81, "A#5": 82, "Bb5": 82, "B5": 83,

    "C6": 84, "C#6": 85, "Db6": 85, "D6": 86, "D#6": 87, "Eb6": 87,
    "E6": 88, "F6": 89, "F#6": 90, "Gb6": 90, "G6": 91, "G#6": 92, "Ab6": 92,
    "A6": 93, "A#6": 94, "Bb6": 94, "B6": 95,

    "C7": 96, "C#7": 97, "Db7": 97, "D7": 98, "D#7": 99, "Eb7": 99,
    "E7": 100, "F7": 101, "F#7": 102, "Gb7": 102, "G7": 103, "G#7": 104, "Ab7": 104,
    "A7": 105, "A#7": 106, "Bb7": 106, "B7": 107,

    "C8": 108, "C#8": 109, "Db8": 109, "D8": 110, "D#8": 111, "Eb8": 111,
    "E8": 112, "F8": 113, "F#8": 114, "Gb8": 114, "G8": 115, "G#8": 116, "Ab8": 116,
    "A8": 117, "A#8": 118, "Bb8": 118, "B8": 119,

    "C9": 120, "C#9": 121, "Db9": 121, "D9": 122, "D#9": 123, "Eb9": 123,
    "E9": 124, "F9": 125, "F#9": 126, "Gb9": 126, "G9": 127, "G#9": 127, "Ab9": 127
}

def pitch_to_midi(pitch_name):
    return music21.pitch.Pitch(pitch_name).midi

# from mido import MidiFile, MidiTrack, Message

def generate_instrument_midi(events, choice, output_midi_path, reaction_delay):

    midi = MidiFile()
    
    # 1. Initialize Instrument Track
    track = MidiTrack()
    midi.tracks.append(track)

    program_id = INSTRUMENT_MAP.get(choice, 0)
    track.append(Message("program_change", program=program_id, time=0))

    ticks_per_beat = midi.ticks_per_beat
    midi_events = []

    # Strict 4-count lead-in for the music to align perfectly on beat 4
    delay_ticks = int(reaction_delay * ticks_per_beat)

    # Process Instrument Events
    for event in events:
        if event["type"] == "rest":
            continue

        # If you still want the 0.25 reaction delay, add it here explicitly:
        # reaction_delay = 0.25 * ticks_per_beat
        start_tick = int(event["offset"] * ticks_per_beat) + delay_ticks
        end_tick = int((event["offset"] + event["duration"]) * ticks_per_beat) + delay_ticks

        for pitch_struct in event["pitches"]:
            pitch_name = pitch_struct["pitch"]
            midi_pitch = pitch_to_midi(pitch_name)

            midi_events.append({
                "tick": start_tick,
                "type": "note_on",
                "pitch": midi_pitch
            })
            midi_events.append({
                "tick": end_tick,
                "type": "note_off",
                "pitch": midi_pitch
            })

    midi_events.sort(key=lambda x: (x["tick"], 0 if x["type"] == "note_off" else 1))

    previous_tick = 0
    for event in midi_events:
        delta = event["tick"] - previous_tick
        track.append(
            Message(
                event["type"],
                note=event["pitch"],
                velocity=64,
                time=delta
            )
        )
        previous_tick = event["tick"]

    midi.save(output_midi_path)
    print(f"Saved instrumental MIDI to {output_midi_path}")
    
    return midi_events

def generate_metronome_midi(events, output_midi_path, reaction_delay):

    midi = MidiFile()
    
    metronome_track = MidiTrack()
    midi.tracks.append(metronome_track)

    ticks_per_beat = midi.ticks_per_beat

    delay_ticks = int(reaction_delay * ticks_per_beat)

    # Find the maximum tick to know when to stop the metronome
    max_instrument_tick = max([e["tick"] for e in events]) if events else delay_ticks

    midi.tracks.append(metronome_track)
    metronome_channel = 9  # Percussion channel
    strong_click = 76
    weak_click = 77
    
    metronome_events = []
    
    total_beats = int(max_instrument_tick / ticks_per_beat) + 1

    for beat in range(total_beats):
        click_start_tick = int(beat * ticks_per_beat)
        click_end_tick = click_start_tick + 60 

        # Accent the first beat of every 4-bar measure
        note = strong_click if beat % 4 == 0 else weak_click
        velocity = 55 if beat % 4 == 0 else 45

        metronome_events.append({
            "tick": click_start_tick,
            "type": "note_on",
            "pitch": note,
            "velocity": velocity
        })
        metronome_events.append({
            "tick": click_end_tick,
            "type": "note_off",
            "pitch": note,
            "velocity": 0
        })

    # silent "anchor" note at the very end of the metronome track 
    #to perfectly match the exact final tick of the instrument music if it falls between beats
    if max_instrument_tick > metronome_events[-1]["tick"]:
        metronome_events.append({"tick": max_instrument_tick, "type": "note_on", "pitch": weak_click, "velocity": 0})

    # Sort Metronome Events by absolute timeline
    metronome_events.sort(key=lambda x: (x["tick"], 0 if x["type"] == "note_off" else 1))

    # Convert Metronome absolute ticks to delta times
    prev_macro_tick = 0
    for m_event in metronome_events:
        delta = m_event["tick"] - prev_macro_tick
        metronome_track.append(
            Message(
                m_event["type"],
                channel=metronome_channel,
                note=m_event["pitch"],
                velocity=m_event["velocity"],
                time=delta
            )
        )
        prev_macro_tick = m_event["tick"]

    midi.save(output_midi_path)

    print(f"Saved metronome MIDI to {output_midi_path}")
    
#actually plays the music from the midi file matching it to a specific instrument
#and playing from the "instrument sound font" file
def render_midi_to_audio(
    extracted_notes,
    instrument,
    midi_path,
    audio_output_path,
    soundfont_path="FluidR3_GM.sf2"
):

    reaction_delay = 0.25
    normal_midi = midi_path.replace(".mid", "_normal.mid")
    metronome_midi = midi_path.replace(".mid", "_metronome.mid")

    events = generate_instrument_midi(
        extracted_notes,
        instrument,
        normal_midi,
        reaction_delay
    )

    generate_metronome_midi(
        events,
        metronome_midi,
        reaction_delay
    )

    if not os.path.exists(soundfont_path):
        raise FileNotFoundError("Missing SoundFont")

    normal_wav = audio_output_path.replace(".mp3", ".wav")

    metronome_mp3 = audio_output_path.replace(
        ".mp3",
        "_metronome.mp3"
    )

    metronome_wav = metronome_mp3.replace(".mp3", ".wav")

    # Render normal WAV
    subprocess.run([
        FLUIDSYNTH_PATH,
        "-g",
        "1.0",
        "-F",
        normal_wav,
        soundfont_path,
        normal_midi
    ], check=True)

    # Render metronome WAV
    subprocess.run([
        FLUIDSYNTH_PATH,
        "-g",
        "1.0",
        "-F",
        metronome_wav,
        soundfont_path,
        metronome_midi
    ], check=True)

    # Convert normal WAV -> MP3
    subprocess.run([
        "ffmpeg",
        "-i",
        normal_wav,
        audio_output_path,
        "-y"
    ], check=True)

    # Convert metronome WAV -> MP3
    subprocess.run([
        "ffmpeg",
        "-i",
        metronome_wav,
        metronome_mp3,
        "-y"
    ], check=True)

    #clean up temp uploads
    os.remove(normal_wav)
    os.remove(metronome_wav)
    os.remove(normal_midi)
    os.remove(metronome_midi)

    print("Audio rendering complete")